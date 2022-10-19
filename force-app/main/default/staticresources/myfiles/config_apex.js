var resourceURL = '/resource/'
window.Core.forceBackendType('ems');

var urlSearch = new URLSearchParams(location.hash)
var custom = JSON.parse(urlSearch.get('custom'));
resourceURL = resourceURL + custom.namespacePrefix +'V89_';

var global_document;
/**
 * The following `window.Core.set*` functions point WebViewer to the
 * optimized source code specific for the Salesforce platform, to ensure the
 * uploaded files stay under the 5mb limit
 */

// office workers
window.Core.setOfficeWorkerPath(resourceURL + 'office')
window.Core.setOfficeAsmPath(resourceURL + 'office_asm');
window.Core.setOfficeResourcePath(resourceURL + 'office_resource');

// // // content edit workers
Core.ContentEdit.setWorkerPath(resourceURL + 'content_edit');
Core.ContentEdit.setResourcePath(resourceURL + 'content_edit_resource');

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
window.Core.setCustomFontURL('https://pdftron.s3.amazonaws.com/custom/ID-zJWLuhTffd3c/vlocity/webfontsv20/');

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

window.addEventListener('documentLoaded', () => {
  // select content edit tool on doc load
  // instance.UI.setToolMode(instance.Core.Tools.ToolNames.CONTENT_EDIT);
})

window.addEventListener('viewerLoaded', async function () {
  // show content edit button in the UI
  instance.UI.enableElements(['contentEditButton']);

  instance.hotkeys.on('ctrl+s, command+s', e => {
    e.preventDefault();
    saveDocument();
  });

  // Create a button, with a disk icon, to invoke the saveDocument function
  instance.setHeaderItems(function (header) {
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

  
  const annotationManager = await instance.Core.documentViewer.getAnnotationManager();

  //pass user info from Salesforce to WebViewer
  console.table(custom.userData) // log current user info

  annotationManager.setCurrentUser(custom.userData.name); //set user name

  // set user permissions
  if(custom.userData.permission === 'admin') {
    console.log(`Promoting ${custom.userData.name} to admin`);
    annotationManager.promoteUserToAdmin();
  } else if (custom.userData.permission === 'guest') {
    console.log(`Setting ${custom.userData.name} to guest/read only`);
    annotationManager.enableReadOnlyMode();
  } else { // standard user, edit your own annotations/view all
    annotationManager.demoteUserFromAdmin();
    annotationManager.disableReadOnlyMode();
  }
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
        instance.loadDocument(blob, { extension, filename, documentId})
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
      case 'LOAD_ANNOTATIONS_FINISHED':
        if(event.data.result !== '') {
          const annotManager = instance.Core.documentViewer.getAnnotationManager();
          annotManager.importAnnotations(event.data.result);
        }
        break;
      case 'CLOSE_DOCUMENT':
        instance.closeDocument()
        break;
      default:
        break;
    }
  }
}

async function editDocument(){
  // Grabs originsl document loaded
  let doc = documentViewer.getDocument();

  // Retrieve the buffer information for the officeToPDFBuffer call
  let buffer = await doc.getFileData();

  // Simulates applyTemplateValues but retrieves arraybuffer
  let item = await Core.officeToPDFBuffer(buffer, {
    extension: 'docx',
    officeOptions: {
      templateValues: {
        'first_name': 'Jon',
        'last_name': 'Jones',
        'dob': '01-01-1900',
        'phone': '604-123-1234',
        'email': 'jjones@mail.com'
      }
    }});

  // loads the array buffer
  instance.loadDocument(item)
}