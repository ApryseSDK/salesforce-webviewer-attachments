import { LightningElement, wire, track, api } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import { loadScript } from "lightning/platformResourceLoader";
import libUrl from "@salesforce/resourceUrl/lib";
import myfilesUrl from "@salesforce/resourceUrl/myfiles";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import mimeTypes from "./mimeTypes";
import { fireEvent, registerListener, unregisterAllListeners } from "c/pubsub";
import saveDocument from "@salesforce/apex/PDFTron_ContentVersionController.saveDocument";
import getUser from "@salesforce/apex/PDFTron_ContentVersionController.getUser";
import asm_full from "@salesforce/resourceUrl/V87asm_full";
import external from "@salesforce/resourceUrl/V87external";
import legacyOffice_asm from "@salesforce/resourceUrl/V87legacyOffice_asm";
import legacyOffice_resource from "@salesforce/resourceUrl/V87legacyOffice_resource";
import legacyOffice from "@salesforce/resourceUrl/V87legacyOffice";
import office_asm from "@salesforce/resourceUrl/V87office_asm";
import office_resource from "@salesforce/resourceUrl/V87office_resource";
import office from "@salesforce/resourceUrl/V87office";
import pdf_full from "@salesforce/resourceUrl/V87pdf_full";
import resource from "@salesforce/resourceUrl/V87resource";

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

  username;

  connectedCallback() {
    registerListener("blobSelected", this.handleBlobSelected, this);
    registerListener("closeDocument", this.closeDocument, this);
    registerListener("downloadDocument", this.downloadDocument, this);
    window.addEventListener("message", this.handleReceiveMessage);
  }

  disconnectedCallback() {
    unregisterAllListeners(this);
    window.removeEventListener("message", this.handleReceiveMessage);
  }

  handleBlobSelected(record) {
    const blobby = new Blob([_base64ToArrayBuffer(record.body)], {
      type: mimeTypes[record.FileExtension]
    });

    const payload = {
      blob: blobby,
      extension: record.cv.FileExtension,
      filename: record.cv.Title + "." + record.cv.FileExtension,
      documentId: record.cv.Id
    };
    console.log("payload", payload);
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
      username: this.username,
      myfilesUrl: myfilesUrl,
      workers: {
        asm_full: asm_full,
        external: external,
        legacyOffice_asm: legacyOffice_asm,
        legacyOffice_resource: legacyOffice_resource,
        legacyOffice: legacyOffice,
        office_asm: office_asm,
        office_resource: office_resource,
        office: office,
        pdf_full: pdf_full,
        resource: resource
      }
    };

    var url = myfilesUrl + "/webviewer-demo-annotated.pdf";

    const viewerElement = this.template.querySelector("div");
    // eslint-disable-next-line no-unused-vars
    const viewer = new WebViewer(
      {
        path: libUrl, // path to the PDFTron 'lib' folder on your server
        custom: JSON.stringify(myObj),
        backendType: "ems",
        config: myfilesUrl + "/config_apex.js",
        fullAPI: this.fullAPI,
        initialDoc: url,
        enableFilePicker: this.enableFilePicker,
        enableRedaction: this.enableRedaction,
        enableMeasurement: this.enableMeasurement,
        enableOptimizedWorkers: false,
        loadAsPDF: true
        // enableOfficeEditing: true
        // l: 'YOUR_LICENSE_KEY_HERE',
      },
      viewerElement
    );

    viewerElement.addEventListener("ready", () => {
      this.iframeWindow = viewerElement.querySelector("iframe").contentWindow;
    });
  }

  handleReceiveMessage = (event) => {
    const me = this;
    if (event.isTrusted && typeof event.data === "object") {
      switch (event.data.type) {
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
  };

  downloadDocument() {
    this.iframeWindow.postMessage({ type: "DOWNLOAD_DOCUMENT" }, "*");
  }

  @api
  closeDocument() {
    this.iframeWindow.postMessage({ type: "CLOSE_DOCUMENT" }, "*");
  }
}
