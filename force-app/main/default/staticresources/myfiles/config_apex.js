var resourceURL = '/resource/'
window.Core.forceBackendType('ems');

var urlSearch = new URLSearchParams(location.hash)
var custom = JSON.parse(urlSearch.get('custom'));
resourceURL = resourceURL + custom.namespacePrefix + 'V87';

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

var currentDocId;

window.addEventListener('documentLoaded', () => {
  console.log('document loaded!');
});

async function saveDocument(filename) {
  // SF document file size limit
  const docLimit = 5 * Math.pow(1024, 2);
  const doc = instance.Core.documentViewer.getDocument();
  if (!doc) {
    return;
  }
  instance.openElement('loadingModal');
  const fileSize = await doc.getFileSize();
  const fileType = doc.getType();
  // const filename = doc.getFilename();
  // const filename = doc.getFilename();
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
  fileSize < docLimit ? parent.postMessage({ type: 'SAVE_DOCUMENT', payload }, window.origin) : downloadWebViewerFile();
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

window.addEventListener('viewerLoaded', async function () {
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

  // When the viewer has loaded, this makes the necessary call to get the
  // pdftronWvInstance code to pass User Record information to this config file
  // to invoke annotManager.setCurrentUser
  instance.UI.setCustomModal(modal);
  instance.Core.documentViewer.getAnnotationManager().setCurrentUser(custom.username);

  // createSavedModal(instance);
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
        instance.loadDocument(blob, { extension, filename, documentId })
        break;
      case 'DOCUMENT_SAVED':
        console.log(`${JSON.stringify(event.data)}`);
        instance.UI.openElements(['savedModal']);
        setTimeout(() => {
          instance.closeElements(['savedModal', 'loadingModal'])
        }, 2000)
        break;
      case 'MULTI_FILES':
        instance.openElement('loadingModal');
        const { item } = event.data;
        loadMultipleDocuments(item);
        break
      case 'REMOVE_FILES':
        const { file } = event.data;
        removeDocuments(file);
        break
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

var loaded_files = [];
var initialDoc;

const loadMultipleDocuments = async (item) => {
  let doc = documentViewer.getDocument();
  //PDFNet needs to be initialized before usage
  if(!initialDoc){
    currentDocId = item.documentId;
    initialDoc = await Core.createDocument(
      item.blob,
      {
          extension: item.extension,
          docId: item.documentId,
          filename: item.filename,
          loadAsPDF: true
      }
    );

    loaded_files.push({
      docId: item.documentId,
      pages: pageRange(1, initialDoc.getPageCount())
    })
    instance.loadDocument(initialDoc, {
      extension: item.extension
    });
  } else {
    
    let file_added = await Core.createDocument(
      item.blob,
      {
        extension: item.extension,
        docId: item.documentId,
        filename: item.filename,
        loadAsPDF: true
      }
    )
    loaded_files.push({
      docId: item.documentId,
      pages: pageRange(initialDoc.getPageCount() + 1, initialDoc.getPageCount() + file_added.getPageCount())
    })

    await doc.insertPages(file_added);

  }
  instance.closeElements(['loadingModal']);
  parent.postMessage({ type: 'FINISH_LOAD' }, window.origin)
}

function pageRange(start, end){
  return [...Array(end - start + 1).keys()].map(x => x + start);
}


const removeDocuments = (file) => {
  let deleted_pages;
  let update;

  if (loaded_files.length > 1){
    update = loaded_files.filter((item, index) => {
                if (item.docId == file) {
                  initialDoc.removePages(item.pages);
                  deleted_pages = {
                    length: item.pages.length,
                    index: index
                  };
                  return false;
                }
                return true;
              });


    update.forEach((item, index) => {
      if (index >= deleted_pages.index) {
        item.pages.forEach((element, index) => {
          item.pages[index] = element - deleted_pages.length;
        })
        update[index].pages = item.pages;
      }
    })
  } else {
    currentDocId = undefined;
    update = [];
    instance.closeDocument();
    initialDoc = undefined;
  }
  
  loaded_files = update;
  console.log(loaded_files);
}

function altogetherSave(filename){
  if (!filename){
    let d = new Date();
    let sub_filename = 'redacted_file' + '(' + d.toLocaleDateString() + '_' + d.toLocaleTimeString() + ')';
    saveDocument(sub_filename + '.pdf');
  } else {
    saveDocument(filename + '.pdf');
  }
  
  instance.UI.closeElements(['saveDocumentModal']);
}

const modal = {
  dataElement: 'saveDocumentModal',
  render: function renderCustomModal(){
    var separate_save = false;
    var div = document.createElement("div");
    div.style.color = '#666c72';
    div.style.backgroundColor = 'white';
    div.style.padding = '10px 10px';
    div.style.borderRadius = '5px';

    var title = document.createElement("h3");
    title.innerText = "File Save Options";
    title.style.marginTop = '0px';

    var file_group_div = document.createElement("div");   
    var file_group = document.createElement("input");
    file_group.type = 'radio';
    file_group.value = 'separate';
    file_group.id = 'file_group';
    file_group.name = 'file_save';
    file_group.checked = 'checked';
    file_group.addEventListener('click', function(){
      separate_save = false;
      file_input.disabled = false;
    });
    var file_group_label = document.createElement("label");
    file_group_label.for = 'file_group';
    file_group_label.innerHTML = 'Save in one file';


    var file_sep_div = document.createElement("div"); 
    var file_sep = document.createElement("input");
    file_sep.type = 'radio';
    file_sep.value = 'separate';
    file_sep.id = 'file_sep';
    file_sep.name = 'file_save';
    file_sep.addEventListener('click', function(){
      separate_save = true;
      file_input.disabled = true;
    });

    var file_sep_label = document.createElement("label");
    file_sep_label.for = 'file_sep';
    file_sep_label.innerHTML = 'Save in separate files';

    var file_input = document.createElement("input");
    file_input.type = "text";

    var file_button = document.createElement("button");
    file_button.innerHTML = "Save";
    file_button.type = "button";
    file_button.className = "button";
    file_button.onclick = function() {
      if (separate_save){
        separateSave();
      } else {
        altogetherSave(file_input.value);
      }
    }




    var form = document.createElement("form");
    file_group_div.appendChild(file_group);
    file_group_div.appendChild(file_group_label);
    file_sep_div.appendChild(file_sep);
    file_sep_div.appendChild(file_sep_label);
    form.appendChild(file_group_div);
    // form.appendChild(file_sep_div);
    var head = document.createElement("div");
    var body = document.createElement("div");
    
    head.appendChild(title);
    body.appendChild(form);
    body.appendChild(file_input);
    body.appendChild(file_button);
    div.appendChild(head);
    div.appendChild(body)

    return div
  }
}