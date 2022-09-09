var resourceURL = '/resource/'
window.Core.forceBackendType('ems');

var urlSearch = new URLSearchParams(location.hash)
var custom = JSON.parse(urlSearch.get('custom'));
resourceURL = resourceURL + custom.namespacePrefix +'V87_';

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

// // content edit workers
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

window.addEventListener('documentLoaded', () => {
  // select content edit tool on doc load
  instance.UI.setToolMode(instance.Core.Tools.ToolNames.CONTENT_EDIT);
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
        editDocument();
      }
    }
    header.get('viewControlsButton').insertBefore(myCustomButton);
  });

  // When the viewer has loaded, this makes the necessary call to get the
  // pdftronWvInstance code to pass User Record information to this config file
  // to invoke annotManager.setCurrentUser
  instance.Core.documentViewer.getAnnotationManager().setCurrentUser(custom.username);

  const annotationManager = await instance.Core.documentViewer.getAnnotationManager();
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
        'first_name': 'Joshua',
        'last_name': 'Lore',
        'dob': '04-07-1999',
        'phone': '604-771-4497',
        'email': 'jplore4@gmail.com'
      }
    }});

  // loads the array buffer
  instance.loadDocument(item)
}