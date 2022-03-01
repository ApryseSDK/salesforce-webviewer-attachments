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

var currentDocId;

async function saveDocument() {
  // SF document file size limit
  const docLimit = 5 * Math.pow(1024, 2);
  const doc = instance.Core.documentViewer.getDocument();
  if (!doc) {
    return;
  }
  instance.openElement('loadingModal');
  const fileSize = await doc.getFileSize();
  const fileType = doc.getType();
  const filename = doc.getFilename();
  const xfdfString = await instance.Core.documentViewer.getAnnotationManager().exportAnnotations();
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

  let timestamp = '_Redacted_' + Date.now()

  const payload = {
    title: filename.replace(/\.[^/.]+$/, "") + timestamp,
    filename,
    base64Data,
    contentDocumentId: currentDocId
  }
  // Post message to LWC
  fileSize < docLimit ? parent.postMessage({ type: 'SAVE_DOCUMENT', payload }, '*') : downloadWebViewerFile();
}

const downloadWebViewerFile = async () => {
  const doc = instance.Core.documentViewer.getDocument();

  if (!doc) {
    return;
  }

  const data = await doc.getFileData();
  const arr = new Uint8Array(data);
  const blob = new Blob([arr], { type: 'application/pdf' });

  const filename = doc.getFilename();

  downloadFile(blob, filename)
}

const downloadFile = (blob, fileName) => {
  const link = document.createElement('a');
  // create a blobURI pointing to our Blob
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  // some browser needs the anchor to be in the doc
  document.body.append(link);
  link.click();
  link.remove();
  // in case the Blob uses a lot of memory
  setTimeout(() => URL.revokeObjectURL(link.href), 7000);
};

window.addEventListener('viewerLoaded', async function () {
  parent.postMessage({ type: 'VIEWER_LOADED' }, '*')
    
  instance.UI.setToolbarGroup("toolbarGroup-Edit");
  instance.UI.setToolMode(Tools.ToolNames.REDACTION);

  // When the viewer has loaded, this makes the necessary call to get the
  // pdftronWvInstance code to pass User Record information to this config file
  // to invoke annotManager.setCurrentUser
  instance.Core.documentViewer.getAnnotationManager().setCurrentUser(custom.username);
});

window.addEventListener('documentLoaded', () => {
  instance.UI.setZoomLevel('100%');
  
  instance.UI.setToolMode(Tools.ToolNames.REDACTION);
})

window.addEventListener("message", receiveMessage, false);

function receiveMessage(event) {
  if (event.isTrusted && typeof event.data === 'object') {
    switch (event.data.type) {
      case 'OPEN_DOCUMENT':
        instance.loadDocument(event.data.file)
        break;
      case 'SAVE_FILE':
        saveDocument();
        break;
      case 'APPLY_REDACTIONS':
        if(confirm('This action will permanently remove all items selected for redaction. It cannot be undone once the document is saved.')) {
          instance.showErrorMessage("Applying redactions");
          instance.Core.documentViewer.getAnnotationManager().applyRedactions();setTimeout(() => {
            instance.closeElements(["errorModal", "loadingModal"]);
          }, 1500);
        }
        break;
      case 'DRAW_REDACTIONS':
        instance.showErrorMessage("Placing automatic redaction");
          instance.Core.documentViewer.getAnnotationManager().applyRedactions();setTimeout(() => {
            instance.closeElements(["errorModal", "loadingModal"]);
          }, 1500);
        let xfdf = `<?xml version="1.0" encoding="UTF-8" ?><xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve"><pdf-info xmlns="http://www.pdftron.com/pdfinfo" version="2" import-version="3" /><fields /><annots><link page="0" rect="92,355.7,189.9,371.4" name="2bccea04a7673646-2224ceec69aedadc" width="0" style="solid"><OnActivation><Action Trigger="U"><URI Name="https://products.office.com/en-us/word"/></Action></OnActivation></link><redact page="0" rect="56.800,654.046,516.430,698.794" color="#FF0000" flags="print" name="d4cdfa05-5b67-94ac-6fc4-d63ba8cb650d" title="Thomas Winter" subject="Redact" date="D:20220225155742-05'00'" interior-color="#000000" width="1.5" creationdate="D:20220225155739-05'00'" coords="74.8,698.7940000000001,516.43,698.7940000000001,74.8,674.7460000000001,516.43,674.7460000000001,56.8,678.094,289.54,678.094,56.8,654.046,289.54,654.046"><contents>Lorem ipsum dolor sit amet, consectetur adipiscing
        elit. Nunc ac faucibus odio.</contents><defaultappearance>1 0 0 RG /Helvetica 17.25 Tf</defaultappearance></redact><redact page="0" rect="56.800,565.543,538.244,596.927" color="#FF0000" flags="print" name="d1463603-623a-8654-85e2-16abb6853f82" title="Thomas Winter" subject="Redact" date="D:20220225155748-05'00'" interior-color="#000000" width="1.5" creationdate="D:20220225155745-05'00'" coords="142.3,596.927,538.2444999999999,596.927,142.3,580.2425000000001,538.2444999999999,580.2425000000001,56.8,582.227,434.45349999999996,582.227,56.8,565.5425,434.45349999999996,565.5425"><contents>Vivamus dapibus sodales ex, vitae malesuada ipsum cursus
        convallis. Maecenas sed egestas nulla, ac condimentum orci.</contents><defaultappearance>1 0 0 RG /Helvetica 11.25 Tf</defaultappearance></redact><redact page="0" rect="260.091,506.743,392.296,523.343" color="#FF0000" flags="print" name="0b5bffd4-bc6b-4be3-0421-a832a4593af5" title="Thomas Winter" subject="Redact" date="D:20220225155751-05'00'" interior-color="#000000" width="1.5" creationdate="D:20220225155750-05'00'" coords="260.0905000000001,523.3430000000001,392.29600000000016,523.3430000000001,260.0905000000001,506.7425,392.29600000000016,506.7425"><contents>Morbi in ullamcorper elit.</contents><defaultappearance>1 0 0 RG /Helvetica 11.25 Tf</defaultappearance></redact><redact page="0" rect="92.800,439.342,376.541,456.027" color="#FF0000" flags="print" name="f3c385ff-f239-5a50-2141-6ec3bd134d71" title="Thomas Winter" subject="Redact" date="D:20220225155753-05'00'" interior-color="#000000" width="1.5" creationdate="D:20220225155753-05'00'" coords="92.8,456.027,376.54149999999987,456.027,92.8,439.3425,376.54149999999987,439.3425"><contents>Maecenas non lorem quis tellus placerat varius.</contents><defaultappearance>1 0 0 RG /Helvetica 11.25 Tf</defaultappearance></redact></annots><pages><defmtx matrix="1,0,0,-1,0,842" /></pages></xfdf>`
        
        const annotationManager = documentViewer.getAnnotationManager()
        annotationManager.importAnnotations(xfdf)
        break;
      case 'OPEN_DOCUMENT_BLOB':
        const { blob, extension, filename, documentId } = event.data.payload;
        console.log("documentId", documentId);
        currentDocId = documentId;
        instance.loadDocument(blob, { extension, filename, documentId })
        break;
      case 'DOCUMENT_SAVED':
        console.log(`${JSON.stringify(event.data)}`);
        instance.showErrorMessage('Document saved ')
        setTimeout(() => {
          instance.closeElements(['errorModal', 'loadingModal'])
        }, 2000)
        break;
      case 'LMS_RECEIVED':  
        instance.loadDocument(event.data.payload.message, {
          filename: event.data.payload.filename,
          withCredentials: false
        });
        break;
      case 'DOWNLOAD_DOCUMENT':
        downloadWebViewerFile();
        break;
      case 'CLOSE_DOCUMENT':
        instance.closeDocument()
        break;
      default:
        break;
    }
  }
}