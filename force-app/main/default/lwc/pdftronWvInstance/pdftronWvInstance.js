import { LightningElement, wire, track, api } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import { loadScript } from 'lightning/platformResourceLoader';
import libUrl from '@salesforce/resourceUrl/lib';
import myfilesUrl from '@salesforce/resourceUrl/myfiles';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import mimeTypes from './mimeTypes'
import { registerListener, unregisterAllListeners } from 'c/pubsub';
import saveDocument from '@salesforce/apex/PDFTron_ContentVersionController.saveDocument';
import Id from '@salesforce/user/Id';
import { getRecord } from 'lightning/uiRecordApi';

function _base64ToArrayBuffer(base64) {
  var binary_string =  window.atob(base64);
  var len = binary_string.length;
  var bytes = new Uint8Array( len );
  for (var i = 0; i < len; i++)        {
      bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export default class PdftronWvInstance extends LightningElement {
  //initialization options
  fullAPI = true;
  enableRedaction = true;
  enableFilePicker = true;

  source = 'My file';
  @api recordId;

  @wire(CurrentPageReference)
  pageRef;

  userRecord;

  @wire(getRecord, { recordId: Id, fields: ['User.FirstName', 'User.LastName']})
  getUserRecord({ error, data }) {
    if (data) {
      this.userRecord = data;
    } else if (error) {
      console.error(error);
      this.showNotification('Error', error.body.message, 'error');
    }
  }


  connectedCallback() {
    registerListener('blobSelected', this.handleBlobSelected, this);
    window.addEventListener('message', this.handleReceiveMessage.bind(this), false);
  }

  disconnectedCallback() {
    unregisterAllListeners(this);
    window.removeEventListener('message', this.handleReceiveMessage, true);
  }

  handleBlobSelected(record) {
    record = JSON.parse(record);

    var blobby = new Blob([_base64ToArrayBuffer(record.body)], {
      type: mimeTypes[record.FileExtension]
    });

    const payload = {
      blob: blobby,
      extension: record.cv.FileExtension,
      filename: record.cv.Title + "." + record.cv.FileExtension,
      documentId: record.cv.Id
    };
    this.iframeWindow.postMessage({type: 'OPEN_DOCUMENT_BLOB', payload} , '*');
  }

  renderedCallback() {
    var self = this;
    if (this.uiInitialized) {
        return;
    }
    this.uiInitialized = true;

    Promise.all([
        loadScript(self, libUrl + '/webviewer.min.js')
    ])
    .then(() => this.initUI())
    .catch(console.error);
  }

  initUI() {
    const firstName = this.userRecord.fields.FirstName.value;
    const lastName = this.userRecord.fields.LastName.value;
    const username = `${firstName} ${lastName}`;
    var myObj = {
      libUrl: libUrl,
      fullAPI: this.fullAPI || false,
      namespacePrefix: '',
      username,
    };
    var url = myfilesUrl + '/webviewer-demo-annotated.pdf';

    const viewerElement = this.template.querySelector('div')
    // eslint-disable-next-line no-unused-vars
    const viewer = new PDFTron.WebViewer({
      path: libUrl, // path to the PDFTron 'lib' folder on your server
      custom: JSON.stringify(myObj),
      backendType: 'ems',
      config: myfilesUrl + '/config_apex.js',
      fullAPI: this.fullAPI,
      enableFilePicker: this.enableFilePicker,
      enableRedaction: this.enableRedaction,
      enableMeasurement: this.enableMeasurement,
      // l: 'YOUR_LICENSE_KEY_HERE',
    }, viewerElement);

    viewerElement.addEventListener('ready', () => {
      this.iframeWindow = viewerElement.querySelector('iframe').contentWindow;
    })

  }

  handleReceiveMessage(event) {
    const me = this;
    if (event.isTrusted && typeof event.data === 'object') {
      switch (event.data.type) {
        case 'SAVE_DOCUMENT':
          saveDocument({ json: JSON.stringify(event.data.payload), recordId: this.recordId }).then((response) => {
            me.iframeWindow.postMessage({ type: 'DOCUMENT_SAVED', response }, '*')
          }).catch(error => {
            console.error(JSON.stringify(error));
          });
          break;
        default:
          break;
      }
    }
  }
	
	handleCallout(endpoint, token){
		fetch(endpoint,
		{
			method : "GET",
			headers : {
				"Content-Type": "application/pdf",
				"Authorization": token
			}
		}).then(function(response) {
			return response.json();
		})
		.then((myJson) =>{
			// console.log('%%%%'+JSON.stringify(myJson));
			let doc_list = [];
			for(let v of Object.values(myJson.results)){
				console.log('%%%%'+JSON.stringify(v));
				// console.log('$$$$'+v.title);
				doc_list.push();
			}
			
			// console.log('*****'+JSON.stringify(movies_list));
			
			this.documents = doc_list;
			
		})
		.catch(e=>console.log(e));
	}

  @api
  openDocument() {
  }

  @api
  closeDocument() {
    this.iframeWindow.postMessage({type: 'CLOSE_DOCUMENT' }, '*')
  }
}