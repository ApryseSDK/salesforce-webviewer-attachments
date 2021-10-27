import { LightningElement, api, wire, track } from "lwc";
import { fireEvent, registerListener, unregisterAllListeners } from "c/pubsub";
import { CurrentPageReference } from "lightning/navigation";

export default class PdftronFlowFileFlattener extends LightningElement {
  @api flattenfile = false;
  @api recordId;
  @track docLoaded = false;
  @track isLoading = false;

  @wire(CurrentPageReference)
  pageRef;

  handleFlatten() {
    this.isLoading = true;
    fireEvent(this.pageRef, "flattenfile", "*");
    this.isLoading = false;
  }
}
