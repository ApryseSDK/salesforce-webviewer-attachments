import { LightningElement, wire, track, api } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import { loadScript } from "lightning/platformResourceLoader";
import libUrl from "@salesforce/resourceUrl/V87_lib";
import myfilesUrl from "@salesforce/resourceUrl/myfiles";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import mimeTypes from "./mimeTypes";
import { fireEvent, registerListener, unregisterAllListeners } from "c/pubsub";
import saveDocument from "@salesforce/apex/PDFTron_ContentVersionController.saveDocument";
import getUser from "@salesforce/apex/PDFTron_ContentVersionController.getUser";
import getAnnotations from "@salesforce/apex/PDFTron_ContentVersionController.getAnnotations";
import saveAnnotations from "@salesforce/apex/PDFTron_ContentVersionController.saveAnnotations";

function _base64ToArrayBuffer(base64) {
  var binary_string = window.atob(base64);
  var len = binary_string.length;
  var bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export default class PdftronWvInstance extends LightningElement {
  //initialization options
  fullAPI = true;
  enableRedaction = true;
  enableFilePicker = true;

  uiInitialized = false;

  source = "My file";
  @api recordId;

  @wire(CurrentPageReference)
  pageRef;

  @track currentDocId = "";
  username;

  connectedCallback() {
    registerListener("blobSelected", this.handleBlobSelected, this);
    registerListener("closeDocument", this.closeDocument, this);
    registerListener("downloadDocument", this.downloadDocument, this);
    window.addEventListener(
      "message",
      this.handleReceiveMessage.bind(this),
      false
    );
  }

  disconnectedCallback() {
    unregisterAllListeners(this);
    window.removeEventListener("message", this.handleReceiveMessage, true);
  }

  handleBlobSelected(record) {
    this.currentDocId = record.cv.Id;

    const blobby = new Blob([_base64ToArrayBuffer(record.body)], {
      type: mimeTypes[record.FileExtension]
    });

    const payload = {
      blob: blobby,
      extension: record.cv.FileExtension,
      filename: record.cv.Title + "." + record.cv.FileExtension,
      documentId: record.cv.Id
    };

    this.iframeWindow.postMessage({ type: "OPEN_DOCUMENT_BLOB", payload }, "*");
  }

  renderedCallback() {
    var self = this;

    if (this.uiInitialized) {
      return;
    }

    Promise.all([loadScript(self, libUrl + "/webviewer.min.js")])
      .then(() => this.handleInitWithCurrentUser())
      .catch(console.error);
  }

  handleInitWithCurrentUser() {
    getUser()
      .then((result) => {
        this.username = result;
        this.error = undefined;

        this.initUI();
      })
      .catch((error) => {
        console.error(error);
        this.showNotification("Error", error.body.message, "error");
      });
  }

  initUI() {
    var myObj = {
      libUrl: libUrl,
      fullAPI: this.fullAPI || false,
      namespacePrefix: "",
      username: this.username
    };
    var url = myfilesUrl + "/webviewer-demo-annotated.pdf";

    const viewerElement = this.template.querySelector("div");
    // eslint-disable-next-line no-unused-vars
    const viewer = new WebViewer(
      {
        preloadWorker: WebViewer.WorkerTypes.CONTENT_EDIT, // preload content edit worker
        path: libUrl, // path to the PDFTron 'lib' folder on your server
        custom: JSON.stringify(myObj),
        backendType: "ems",
        config: myfilesUrl + "/config_apex.js",
        fullAPI: this.fullAPI,
        enableOptimizedWorkers: false, // no optimized workers were deployed
        enableFilePicker: this.enableFilePicker,
        enableRedaction: this.enableRedaction,
        enableMeasurement: this.enableMeasurement
        // loadAsPDF: true, // auto-convert MS Office to PDF for text editing
        // l: 'YOUR_LICENSE_KEY_HERE',
      },
      viewerElement
    );

    viewerElement.addEventListener("ready", () => {
      this.iframeWindow = viewerElement.querySelector("iframe").contentWindow;
    });
  }

  handleReceiveMessage(event) {
    const me = this;
    if (event.isTrusted && typeof event.data === "object") {
      switch (event.data.type) {
        case "SAVE_ANNOTATIONS":
          console.log(">>" + JSON.stringify(event.data.payload));
          saveAnnotations(event.data.payload)
            .then((response) => {
              console.log("Saving annotations", response);
            })
            .catch((error) => {
              console.error(error);
              this.showErrorMessage(error);
            });
          break;
        case "LOAD_ANNOTATIONS":
          console.log("this.currentDocId", this.currentDocId);
          getAnnotations({ currentDocId: this.currentDocId })
            .then((result) => {
              //console.log(`Loaded annotations: ${JSON.stringify(result)}`);
              fireEvent(this.pageRef, "lastRefresh", "*");
              console.log("result", result);
              me.iframeWindow.postMessage(
                { type: "LOAD_ANNOTATIONS_FINISHED", result },
                window.location.origin
              );
            })
            .catch(this.showErrorMessage);
          break;
        case "SAVE_DOCUMENT":
          let cvId = event.data.payload.contentDocumentId;
          saveDocument({
            json: JSON.stringify(event.data.payload),
            recordId: this.recordId ? this.recordId : "",
            cvId: cvId
          })
            .then((response) => {
              me.iframeWindow.postMessage(
                { type: "DOCUMENT_SAVED", response },
                "*"
              );
              fireEvent(this.pageRef, "refreshOnSave", response);
            })
            .catch((error) => {
              me.iframeWindow.postMessage(
                { type: "DOCUMENT_SAVED", error },
                "*"
              );
              fireEvent(this.pageRef, "refreshOnSave", error);
              console.error(event.data.payload.contentDocumentId);
              console.error(JSON.stringify(error));
              this.showNotification("Error", error.body, "error");
            });
          break;
        default:
          break;
      }
    }
  }

  downloadDocument() {
    this.iframeWindow.postMessage({ type: "DOWNLOAD_DOCUMENT" }, "*");
  }

  @api
  closeDocument() {
    this.iframeWindow.postMessage({ type: "CLOSE_DOCUMENT" }, "*");
  }
}
