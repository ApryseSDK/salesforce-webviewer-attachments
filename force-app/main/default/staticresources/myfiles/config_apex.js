var resourceURL = '/resource/'
window.Core.forceBackendType('ems');

var urlSearch = new URLSearchParams(location.hash)
var custom = JSON.parse(urlSearch.get('custom'));
resourceURL = resourceURL + custom.namespacePrefix;

/**
 * The following `window.Core.set*` functions point WebViewer to the
 * optimized source code specific for the Salesforce platform, to ensure the
 * uploaded files stay under the 5mb limit
 */
// office workers
window.Core.setOfficeWorkerPath(resourceURL + 'office')
window.Core.setOfficeAsmPath(resourceURL + 'office_asm');
window.Core.setOfficeResourcePath(resourceURL + 'office_resource');

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

let currentDocId = '';

function loadxfdfStrings() {
  parent.postMessage({type: 'LOAD_ANNOTATIONS' }, '*');
}

function savexfdfString(payload) {
  parent.postMessage({type: 'SAVE_ANNOTATIONS', payload }, '*');
}

function drawAnnotations(data) {
  const annotationManager = instance.Core.documentViewer.getAnnotationManager();
  const currentAnnots = annotationManager.getAnnotationsList();
  
  //annotationManager.deleteAnnotations(currentAnnots);
  data.forEach(async (col) => {
    const annotations = await annotationManager.importAnnotCommand(col.xfdfString);
    annotationManager.drawAnnotationsFromList(annotations);
  });
}

async function saveDocument() {
  const doc = instance.Core.documentViewer.getDocument();
  if (!doc) {
    return;
  }
  instance.openElement('loadingModal');

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

  const payload = {
    title: filename.replace(/\.[^/.]+$/, ""),
    filename,
    base64Data,
    contentDocumentId: currentDocId
  }
  // Post message to LWC
  parent.postMessage({ type: 'SAVE_DOCUMENT', payload }, '*');
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
  currentDocId = ''
  parent.postMessage({ type: 'VIEWER_LOADED' }, '*');

  // When the viewer has loaded, this makes the necessary call to get the
  // pdftronWvInstance code to pass User Record information to this config file
  // to invoke annotManager.setCurrentUser
  instance.Core.documentViewer.getAnnotationManager().setCurrentUser(custom.username);
});

window.addEventListener('documentLoaded', () => {  
  const annotationManager = instance.Core.documentViewer.getAnnotationManager();

  annotationManager.addEventListener('annotationChanged', (annotations, action, { imported }) => {
    if(imported) {
      //skip imported annotations
      return;
    }
    annotationManager.exportAnnotCommand().then(function(xfdfString) {
      annotations.forEach(function(annot) {
        savexfdfString({
          action,
          documentId: currentDocId,
          annotationId: annot.Id,
          xfdfString
        });
      });
    });
  });
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
        currentDocId = documentId;
        instance.loadDocument(blob, { extension, filename, documentId })
        instance.Core.documentViewer.addEventListener('documentLoaded', function(e) {
          // Save contentDocuemntId to use later during saving
          instance.Core.documentViewer.getDocument().__contentDocumentId = documentId;

          //initial load
          if(currentDocId !== '') {
            loadxfdfStrings();
            setInterval(loadxfdfStrings(), 5000);
          }
        });
        break;
      case 'FLATTEN_DOC':
        saveDocument();
        break;
      case 'DOCUMENT_SAVED':
        instance.showErrorMessage('Document saved ')
        setTimeout(() => {
          instance.closeElements(['errorModal', 'loadingModal'])
        }, 2000)
        break;
      case 'LOAD_ANNOTATIONS_FINISHED':
        drawAnnotations(event.data.result);
        break;
      case 'CLEAN_UP':
        instance.Core.documentViewer.getAnnotationManager().off('annotationChanged', annotationChanged);
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
        currentDocId = ''
        instance.closeDocument()
        break;
      default:
        break;
    }
  }
}