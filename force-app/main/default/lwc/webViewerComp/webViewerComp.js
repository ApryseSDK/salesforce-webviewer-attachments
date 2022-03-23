import { LightningElement, track, wire } from "lwc";
import { loadScript } from "lightning/platformResourceLoader";
import libUrl from "@salesforce/resourceUrl/lib";
import myfilesUrl from "@salesforce/resourceUrl/myfiles";

var url = myfilesUrl + "/webviewer-demo-annotated.pdf";

var clientSidePdfGenerationConfig = {
  cs_pdftron_lean: "/resource",
  cs_pdftron_office: "/resource/office",
  cs_pdftron_resource: "/resource/resource",
  cs_pdftron_asm: "/resource/asm",
  cs_pdftron_external: "/resource/external",
  // cs_vlocity_webfonts_main: '/resource/webfonts',
  cs_pdftron_officeasm: "/resource/officeAsm",
  cs_pdftron_officeresource: "/resource/officeResource",

  core_contorls: libUrl + "/core/CoreControls.js",
  url: url
};

export default class WebViewerComp extends LightningElement {
  connectedCallback() {
    window.addEventListener(
      "message",
      this.handleReceiveMessage.bind(this),
      false
    );
  }

  disconnectedCallback() {
    window.removeEventListener("message", this.handleReceiveMessage, true);
  }

  handleReceiveMessage(event) {
    if (event.isTrusted && typeof event.data === "object") {
      switch (event.data.type) {
        case "MESSAGE_FOR_LWC_COMPONENT":
          console.log(
            `%c LWC Parent received message payload: ${event.data.payload}`,
            "background: red; color: white;"
          );
          break;
        case "REQUEST_PARAMS":
          console.log(`%c REQUEST_PARAMS `, "background: green; color: white;");
          this.iframeWindow.postMessage(
            {
              type: "LOAD_CORE_CONTROLS",
              params: clientSidePdfGenerationConfig
            },
            "*"
          );
          break;
        default:
          break;
      }
    }
  }

  handleFileSelected(file) {
    this.iframeWindow.postMessage({ type: "OPEN_DOCUMENT", file: file }, "*");
  }

  renderedCallback() {
    if (this.uiInitialized) {
      return;
    }

    this.uiInitialized = true;

    Promise.all([
      // loadScript(this, libUrl + '/webviewer.min.js'),
    ])
      .then(() => {
        this.initUI();
      })
      .catch(console.error);
  }

  async initUI() {
    const viewerElement = this.template.querySelector("div");

    var queryParameter = `#param=${JSON.stringify(
      clientSidePdfGenerationConfig
    )}`;

    var rcFrame = document.createElement("iframe");
    rcFrame.src = `${myfilesUrl}/noviewer.html${queryParameter}`;
    // rcFrame.frameBorder = 0;​
    viewerElement.appendChild(rcFrame);
    // console.log(rcFrame.contentWindow)
    this.iframeWindow = rcFrame.contentWindow;
    // viewerElement.addEventListener('message', function(event) {
    //   this.iframeWindow = viewerElement.querySelector('iframe').contentWindow;
    //   console.log(`%c  viewerElement.addEventListener message`, 'background: red; color: white;', event);
    // });
  }
}
