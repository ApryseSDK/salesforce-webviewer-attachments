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
  lookupAccess = false;

  @track value = "";
  @track picklistOptions = [];
  @track isSaving = false;
  documentsRetrieved = false;
  @api recordId;
  @track attachments = [];
  @wire(CurrentPageReference) pageRef;

  files;
  multi_selection;

  renderedCallback() {
    this.hasRecord = this.recordId ? true : false;
    if (!this.recordId) {
      return;
    }
    if (!this.documentsRetrieved) {
      getAttachments({ recordId: this.recordId })
        .then((data) => {
          this.attachments = data;
          this.initLookupDefaultResults();
          this.error = undefined;
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
    registerListener("finishLoad", this.finishLoad, this);
    this.initLookupDefaultResults();
  }

  disconnectedCallback() {
    unregisterAllListeners(this);
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

  handleRemoveSelection(event) {
    console.log(event.detail);
    fireEvent(this.pageRef, "removeSelected", event.detail);
    console.log("remove");
  }

  handleSingleSelectionChange(event) {
    if (event.detail.length === 0) {
      this.handleClose();
      return;
    } else {
      this.getFile(event.detail[event.detail.length - 1]);
    }
    console.log("select");
  }

  getFile(recId) {
    this.lookupAccess = true;
    console.log(recId);
    getFileDataFromId({ Id: recId })
      .then((result) => {
        fireEvent(this.pageRef, "filesSelected", result);
      })
      .catch((error) => {
        // TODO: handle error
        this.error = error;
        console.error(error);
        let def_message =
          "We have encountered an error while handling your file. ";

        this.showNotification(
          "Error",
          def_message + error.body.message,
          "error"
        );
      });
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
    if (this.recordId) {
      getAttachments({ recordId: this.recordId })
        .then((data) => {
          this.attachments = data;
          this.initLookupDefaultResults();

          this.error = undefined;
          this.documentsRetrieved = true;
        })
        .catch((error) => {
          console.error(error);
          this.showNotification("Error", error, "error");
          this.error = error;
        });
    }
  }

  finishLoad() {
    this.lookupAccess = false;
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
