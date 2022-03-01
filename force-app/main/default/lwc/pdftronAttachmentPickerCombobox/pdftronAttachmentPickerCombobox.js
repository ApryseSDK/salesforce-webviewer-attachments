import { LightningElement, track, wire, api } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import { fireEvent, registerListener, unregisterAllListeners } from "c/pubsub";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getAttachments from "@salesforce/apex/PDFTron_ContentVersionController.getExistingAttachments";
import getBase64FromCv from "@salesforce/apex/PDFTron_ContentVersionController.getBase64FromCv";
import apexSearch from "@salesforce/apex/PDFTron_ContentVersionController.search";
import getFileDataFromId from "@salesforce/apex/PDFTron_ContentVersionController.getFileDataFromId";

export default class PdftronAttachmentPickerCombobox extends LightningElement {
  error;

  @track isModalOpen = false;
  @track areButtonsDisabled = false;

  @track value = "";
  @track picklistOptions = [];
  @track isSaving = false;
  @api isScan = false;
  @track loadFinished = false;
  documentsRetrieved = false;
  @api recordId;
  @track attachments = [];
  @wire(CurrentPageReference) pageRef;

  renderedCallback() {
    if (!this.documentsRetrieved) {
      getAttachments({ recordId: this.recordId })
        .then((data) => {
          this.attachments = data;
          this.initLookupDefaultResults();

          this.error = undefined;
          this.loadFinished = true;
          this.documentsRetrieved = true;
        })
        .catch((error) => {
          console.error(error);
          this.showNotification("Error", error, "error");
          this.error = error;
        });
    }
  }

  connectedCallback() {
    registerListener("refreshOnSave", this.refreshOnSave, this);
    registerListener("viewerLoaded", this.handleInitialLoad, this);
    this.initLookupDefaultResults();
  }

  disconnectedCallback() {
    unregisterAllListeners(this);
  }

  handleInitialLoad() {
    if (this.isScan) {
      //show pre-OCR document for SCAN OCR modal
      this.openFile("0688c0000083SkbAAE"); // 0688c0000083SkbAAE
    } else {
      //show first attachment for redaction modal
      this.openFile(this.attachments[0].id);
    }
  }

  showNotification(title, message, variant) {
    const evt = new ShowToastEvent({
      title: title,
      message: message,
      variant: variant
    });
    this.dispatchEvent(evt);
  }

  initLookupDefaultResults() {
    // Make sure that the lookup is present and if so, set its default results
    const lookup = this.template.querySelector("c-lookup");
    if (lookup) {
      lookup.setDefaultResults(this.attachments);
    }
  }

  handleApply() {
    fireEvent(this.pageRef, "applyRedactions", "*");
  }

  handleSave() {
    fireEvent(this.pageRef, "saveFile", "*");
  }

  handleDraw() {
    fireEvent(this.pageRef, "drawRedact", "*");
  }

  handleSearch(event) {
    const lookupElement = event.target;
    apexSearch(event.detail)
      .then((results) => {
        lookupElement.setSearchResults(results);
      })
      .catch((error) => {
        // TODO: handle error
        this.error = error;
        console.error(error);
        let def_message =
          "We have encountered an error while searching for your file  " +
          event.detail +
          "\n";

        this.showNotification(
          "Error",
          def_message + error.body.message,
          "error"
        );
      });
  }

  handlePlace() {
    //swap demo doc
    this.openFile("0688c0000083SkWAAU");
  }

  openFile(fileid) {
    this.isLoading = true;
    this.template.querySelector("c-lookup").selection = this.attachments[0];
    getFileDataFromId({ Id: fileid })
      .then((result) => {
        fireEvent(this.pageRef, "blobSelected", result);
        this.isLoading = false;
      })
      .catch((error) => {
        // TODO: handle error
        this.error = error;
        console.error(error);
        this.isLoading = false;
        let def_message =
          "We have encountered an error while handling your file. ";

        this.showNotification(
          "Error",
          def_message + error.body.message,
          "error"
        );
      });
  }

  handleSingleSelectionChange(event) {
    this.checkForErrors();

    if (event.detail.length < 1) {
      this.handleClose();
      return;
    }

    this.openFile(event.detail[0]);
  }

  //check for errors on selection
  checkForErrors() {
    this.errors = [];
    const selection = this.template.querySelector("c-lookup").getSelection();
    // Custom validation rule
    if (this.isMultiEntry && selection.length > this.maxSelectionSize) {
      this.errors.push({
        message: `You may only select up to ${this.maxSelectionSize} items.`
      });
    }
    // Enforcing required field
    if (selection.length === 0) {
      this.errors.push({ message: "Please make a selection." });
    }
  }

  handleUploadFinished() {
    this.showNotification(
      "Success",
      "Your file has been attached to " + this.recordId,
      "success"
    );
    this.refreshOnSave();
  }

  refreshOnSave() {
    this.loadFinished = false;
    getAttachments({ recordId: this.recordId })
      .then((data) => {
        this.attachments = data;
        this.initLookupDefaultResults();

        this.error = undefined;
        this.loadFinished = true;
        this.documentsRetrieved = true;
      })
      .catch((error) => {
        this.loadFinished = true;
        console.error(error);
        this.showNotification("Error", error, "error");
        this.error = error;
      });
  }

  handleDownload() {
    fireEvent(this.pageRef, "downloadDocument", "*");
  }

  handleClose() {
    fireEvent(this.pageRef, "closeDocument", "*");
  }

  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }
}
