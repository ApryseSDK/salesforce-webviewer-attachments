import { LightningElement, track, api } from "lwc";

export default class PdftronRedactionContainer extends LightningElement {
  @api recordId;

  @track isModalOpen = false;
  @track isOCR = false;

  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  openOCRModal() {
    this.isOCR = true;
  }

  closeOCRModal() {
    this.isOCR = false;
  }

  switchModal() {
    this.isOCR = false;
    this.isModalOpen = true;
  }
}
