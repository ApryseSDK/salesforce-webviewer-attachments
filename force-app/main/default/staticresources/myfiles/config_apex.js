var resourceURL = '/resource/'
window.Core.forceBackendType('ems');

var documentViewer = instance.Core.documentViewer;

var urlSearch = new URLSearchParams(location.hash)
var custom = JSON.parse(urlSearch.get('custom'));
var version = ''
resourceURL = resourceURL + custom.namespacePrefix + version;

/**
 * The following `window.Core.set*` functions point WebViewer to the
 * optimized source code specific for the Salesforce platform, to ensure the
 * uploaded files stay under the 5mb limit
 */
// office workers
window.Core.setOfficeWorkerPath(resourceURL + 'office')
window.Core.setOfficeAsmPath(resourceURL + 'office_asm');
window.Core.setOfficeResourcePath(resourceURL + 'office_resource');

//office editing
window.Core.setOfficeEditorWorkerPath(resourceURL + 'office_edit');

// pdf workers
window.Core.setPDFResourcePath(resourceURL + 'resource')
if (custom.fullAPI) {
  window.Core.setPDFWorkerPath(resourceURL + 'pdf_full')
  window.Core.setPDFAsmPath(resourceURL + 'asm_full');
} else {
  window.Core.setPDFWorkerPath(resourceURL + 'pdf_lean')
  window.Core.setPDFAsmPath(resourceURL + 'asm_lean');
}

// external 3rd party libraries
window.Core.setExternalPath(resourceURL + 'external')

var currentDocId;

window.addEventListener('documentLoaded', () => {
  console.log('document loaded!');
});

async function saveDocument() {
  // SF document file size limit
  const docLimit = 5 * Math.pow(1024, 2);
  const doc = instance.Core.documentViewer.getDocument();
  if (!doc) {
    return;
  }
  instance.UI.openElement('loadingModal');
  const fileSize = await doc.getFileSize();
  const fileType = doc.getType();
  let filename = doc.getFilename();

  if (fileType == 'image'){
    filename = filename.replace(/\.[^/.]+$/, ".pdf")
  }
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

  const payload = {
    title: filename.replace(/\.[^/.]+$/, ""),
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

function createSavedModal(instance) {
  const divInput = document.createElement('div');
  divInput.innerText = 'File saved successfully.';
  const modal = {
    dataElement: 'savedModal',
    body: {
      className: 'myCustomModal-body',
      style: {
        'text-align': 'center'
      },
      children: [divInput]
    }
  }
  instance.UI.addCustomModal(modal);
}

instance.UI.addEventListener('viewerLoaded', async function () {
  instance.UI.hotkeys.on('ctrl+s, command+s', e => {
    e.preventDefault();
    saveDocument();
  });

  // Create a button, with a disk icon, to invoke the saveDocument function
  instance.UI.setHeaderItems(function (header) {
    var saveButton = {
      type: 'actionButton',
      dataElement: 'saveDocumentButton',
      title: 'Save Document to Salesforce',
      img: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>',
      onClick: function () {
        saveDocument();
      }
    }

    var extractPagesButton = {
      type: 'actionButton',
      dataElement: 'extractPagesButton',
      title: 'Extract Pages to New Document',
      img: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path class="cls-1" d="M16.49,13.54h1.83V9.25s0,0,0-.06a.59.59,0,0,0,0-.23.32.32,0,0,0,0-.09.8.8,0,0,0-.18-.27l-5.5-5.5a.93.93,0,0,0-.26-.18l-.09,0a1,1,0,0,0-.24,0l-.05,0H5.49A1.84,1.84,0,0,0,3.66,4.67V19.33a1.84,1.84,0,0,0,1.83,1.84H11V19.33H5.49V4.67H11V9.25a.92.92,0,0,0,.92.92h4.58Z"/><path class="cls-1" d="M20.21,17.53,17.05,15a.37.37,0,0,0-.6.29v1.6H12.78v1.84h3.67v1.61a.37.37,0,0,0,.6.29l3.16-2.53A.37.37,0,0,0,20.21,17.53Z"/></svg>`,
      onClick: async() => {
          let pagesToExtract = instance.UI.ThumbnailsPanel.getSelectedPageNumbers(); // get pages selected by user on the Left Panel
          //pagesToExtract is an array of page numbers
          //sample dummy data: pagesToExtract = [2, 3]; // extracts pages 2 and 3 of a document
          const { documentViewer, annotationManager } = instance.Core;

          const doc = documentViewer.getDocument();
          const fileType = doc.getType();
          
          let filename = window.prompt(`Extracting pages ${JSON.stringify(pagesToExtract)} - Add a file name `, "Extracted_Document_"+new Date().toJSON());
          filename += '.'+fileType; // add filetype to path, for example title.pdf

          // only include annotations on the pages to extract
          const annotList = annotationManager.getAnnotationsList().filter(annot => pagesToExtract.indexOf(annot.PageNumber) > -1);
          const xfdfString = await annotationManager.exportAnnotations({ annotList });
          const data = await doc.extractPages(pagesToExtract, xfdfString);

          let binary = '';
          const bytes = new Uint8Array(data);
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }

          const base64Data = window.btoa(binary);

          const payload = {
            title: filename.replace(/\.[^/.]+$/, ""), //title for document needed for ContentVersion
            filename,
            base64Data,
            contentDocumentId: currentDocId
          }

          alert(JSON.stringify(payload))
          // Post message to LWC
          parent.postMessage({ type: 'EXTRACT_DOCUMENT', payload }, '*');
      }
    }

    header.push(saveButton);
    header.push(extractPagesButton);
  });

  // When the viewer has loaded, this makes the necessary call to get the
  // pdftronWvInstance code to pass User Record information to this config file
  // to invoke annotManager.setCurrentUser
  instance.Core.documentViewer.getAnnotationManager().setCurrentUser(custom.username);

  createSavedModal(instance);
});

window.addEventListener("message", receiveMessage, false);



function receiveMessage(event) {
  if (event.isTrusted && typeof event.data === 'object') {
    switch (event.data.type) {
      case 'OPEN_DOCUMENT':
        instance.loadDocument(event.data.file)
        break;
      case 'OPEN_DOCUMENT_BLOB':
        const { blob, extension, filename, documentId } = event.data.payload;
        console.log("documentId", documentId);
        currentDocId = documentId;
        instance.UI.loadDocument(blob, { extension, filename, documentId })
        break;
      case 'DOCUMENT_SAVED':
        console.log(`${JSON.stringify(event.data)}`);
        instance.UI.openElements(['savedModal']);
        setTimeout(() => {
          instance.UI.closeElements(['savedModal', 'loadingModal'])
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
        instance.UI.closeDocument()
        break;
      default:
        break;
    }
  }
}
