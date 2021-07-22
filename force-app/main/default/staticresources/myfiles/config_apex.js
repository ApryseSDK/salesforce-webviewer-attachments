var resourceURL = '/resource/'
window.CoreControls.forceBackendType('ems');

var urlSearch = new URLSearchParams(location.hash)
var custom = JSON.parse(urlSearch.get('custom'));
resourceURL = resourceURL + custom.namespacePrefix;

/**
 * The following `window.CoreControls.set*` functions point WebViewer to the
 * optimized source code specific for the Salesforce platform, to ensure the
 * uploaded files stay under the 5mb limit
 */
// office workers
window.CoreControls.setOfficeWorkerPath(resourceURL + 'office')
window.CoreControls.setOfficeAsmPath(resourceURL + 'office_asm');
window.CoreControls.setOfficeResourcePath(resourceURL + 'office_resource');

// pdf workers
window.CoreControls.setPDFResourcePath(resourceURL + 'resource')
if (custom.fullAPI) {
  window.CoreControls.setPDFWorkerPath(resourceURL + 'pdf_full')
  window.CoreControls.setPDFAsmPath(resourceURL + 'asm_full');
} else {
  window.CoreControls.setPDFWorkerPath(resourceURL + 'pdf_lean')
  window.CoreControls.setPDFAsmPath(resourceURL + 'asm_lean');
}

// external 3rd party libraries
window.CoreControls.setExternalPath(resourceURL + 'external')
window.CoreControls.setCustomFontURL('https://pdftron.s3.amazonaws.com/custom/ID-zJWLuhTffd3c/vlocity/webfontsv20/');

async function saveDocument() {
  const doc = docViewer.getDocument();
  if (!doc) {
    return;
  }
  readerControl.openElement('loadingModal');

  const fileType = doc.getType();
  const filename = doc.getFilename();
  const xfdfString = await docViewer.getAnnotationManager().exportAnnotations();
  const data = await doc.getFileData({
    // Saves the document with annotations in it
    xfdfString
  });

  let binary = '';
  const bytes = new Uint8Array(data);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  const base64Data = window.btoa(binary);

  const payload = {
    title: filename.replace(/\.[^/.]+$/, ""),
    filename,
    base64Data,
    contentDocumentId: doc.__contentDocumentId
  }
  // Post message to LWC
  parent.postMessage({ type: 'SAVE_DOCUMENT', payload }, '*');
}

window.addEventListener('documentLoaded', async function() {
  const { docViewer } = readerControl;
  const stamp_path = resourceURL + 'myfiles/draft.png' //upload draft.png to staticresources/myfiles/ - use transparent png
  
  await PDFNet.initialize();
  const doc = await docViewer.getDocument().getPDFDoc();

  // Run PDFNet methods with memory management
  await PDFNet.runWithCleanup(async () => {

    // lock the document before a write operation
    // runWithCleanup will auto unlock when complete
    doc.lock();
    const s = await PDFNet.Stamper.create(PDFNet.Stamper.SizeType.e_relative_scale, 1, 1); // 1,1 => 100% width, height - 0.5, 0.5 => 50%

    const img = await PDFNet.Image.createFromURL(doc, stamp_path);
    s.setAsBackground(false); //put in foreground since some layers are not transparent
    s.setOpacity(0.5); //use opacity to simulate watermark
    const pgSetImage = await PDFNet.PageSet.createRange(1,4); //stamp pages 1-4
    await s.setAlignment(PDFNet.Stamper.HorizontalAlignment.e_horizontal_center, PDFNet.Stamper.VerticalAlignment.e_vertical_center);
    await s.stampImage(doc, img, pgSetImage);
  });

  const data = await doc.getFileData();
  const arr = new Uint8Array(data);
  const blob = new Blob([arr], { type: 'application/pdf' });

  //use blob to post to LWC/Apex for emailing the watermarked doc
})
// WebViewer 7.3.2 fullAPI = true => in your staticresources/myfiles/config_apex.js 
const waterMarkDocument = 

window.addEventListener('viewerLoaded', async function () {
  /**
   * On keydown of either the button combination Ctrl+S or Cmd+S, invoke the
   * saveDocument function
   */
  readerControl.hotkeys.on('ctrl+s, command+s', e => {
    e.preventDefault();
    saveDocument();
  });

  // Create a button, with a disk icon, to invoke the saveDocument function
  readerControl.setHeaderItems(function (header) {
    var myCustomButton = {
      type: 'actionButton',
      dataElement: 'saveDocumentButton',
      title: 'tool.SaveDocument',
      img: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>',
      onClick: function () {
        saveDocument();
      }
    }
    header.get('viewControlsButton').insertBefore(myCustomButton);
  });

  // When the viewer has loaded, this makes the necessary call to get the
  // pdftronWvInstance code to pass User Record information to this config file
  // to invoke annotManager.setCurrentUser
  console.log(`Setting user to ${custom.username}`);
  readerControl.docViewer.getAnnotationManager().setCurrentUser(custom.username);
});

window.addEventListener("message", receiveMessage, false);

function receiveMessage(event) {
  if (event.isTrusted && typeof event.data === 'object') {
    switch (event.data.type) {
      case 'OPEN_DOCUMENT':
        event.target.readerControl.loadDocument(event.data.file)
        break;
      case 'OPEN_DOCUMENT_BLOB':
        const { blob, extension, filename, documentId } = event.data.payload;
        event.target.readerControl.loadDocument(blob, { extension, filename, documentId })
        break;
      case 'DOCUMENT_SAVED':
        readerControl.showErrorMessage('Document saved!')
        setTimeout(() => {
          readerControl.closeElements(['errorModal', 'loadingModal'])
        }, 2000)
        break;
      case 'CLOSE_DOCUMENT':
        event.target.readerControl.closeDocument()
        break;
      default:
        break;
    }
  }
}
