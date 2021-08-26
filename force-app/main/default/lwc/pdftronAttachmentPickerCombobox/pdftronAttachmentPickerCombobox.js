import { LightningElement, track, wire, api } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import { fireEvent,registerListener, unregisterAllListeners } from 'c/pubsub';
import getAttachments from "@salesforce/apex/PDFTron_ContentVersionController.getAttachments";
import getBase64FromCv from "@salesforce/apex/PDFTron_ContentVersionController.getBase64FromCv";
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class PdftronAttachmentPickerCombobox extends LightningElement {
    error;
    @track isModalOpen = false;

    @track value = '';
    @track picklistOptions = [];
    @track isSaving = false;
    @track loadFinished = false;
    documentsRetrieved = false;
    @api recordId;
    @wire(CurrentPageReference) pageRef;

    renderedCallback() {
        if(!this.documentsRetrieved) {
            getAttachments({recordId: this.recordId})
            .then((data) => {
                console.log('data', data);
                
                data.forEach((attachmentRecord) => {
                    console.log(JSON.stringify(attachmentRecord));
                    var name = attachmentRecord.cv.Title + "." + attachmentRecord.cv.FileExtension;
                    const option = {
                        label: name,
                        value: attachmentRecord.cv.Id
                    };
                    console.log('option', option);
                    this.picklistOptions = [ ...this.picklistOptions, option ];
                });
                this.error = undefined;
                this.loadFinished = true; 
                this.documentsRetrieved = true;
            })
            .catch((error) => {
                console.error(error)
                this.showNotification('Error', error, 'error');
                this.error = error;
            }); 
        }
    }

    connectedCallback() {
        registerListener('refreshOnSave', this.refreshOnSave, this)
    }

    disconnectedCallback() {
        unregisterAllListeners(this);
    }

    showNotification(title, message, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(evt);
    }
    handleUploadFinished() {
        this.picklistOptions = [];
        let temp = this.value;
        getAttachments({recordId: this.recordId})
        .then((data) => {
            console.log('data', data);
            
            data.forEach((attachmentRecord) => {
                console.log(JSON.stringify(attachmentRecord));
                var name = attachmentRecord.cv.Title + "." + attachmentRecord.cv.FileExtension;
                const option = {
                    label: name,
                    value: attachmentRecord.cv.Id
                };
                console.log('option', option);
                this.picklistOptions = [ ...this.picklistOptions, option ];
            });
            this.value = temp;
            this.error = undefined;
            this.loadFinished = true; 
        })
        .catch((error) => {
            console.error(error)
            this.showNotification('Error', error, 'error');
            this.error = error;
        }); 
    }

    refreshOnSave(docId) {
        this.picklistOptions = [];
        this.loadFinished = false;
        getAttachments({recordId: this.recordId})
        .then((data) => {
            console.log('data', data);
            
            data.forEach((attachmentRecord) => {
                console.log(JSON.stringify(attachmentRecord));
                var name = attachmentRecord.cv.Title + "." + attachmentRecord.cv.FileExtension;
                const option = {
                    label: name,
                    value: attachmentRecord.cv.Id
                };
                console.log('option', option);
                this.picklistOptions = [ ...this.picklistOptions, option ];
            });
            this.value = docId;
            this.error = undefined;
            this.loadFinished = true; 
        })
        .catch((error) => {
            console.error(error)
            this.showNotification('Error', error, 'error');
            this.error = error;
        }); 
        
    }

    handleChange(event) {
        this.loadFinished = false;
        this.value = event.detail.value;
        getBase64FromCv({recordId: this.value})
            .then((result) => {
                console.log('result', result);
                fireEvent(this.pageRef, 'blobSelected', result);
                this.error = undefined;
                this.loadFinished = true;
            })
            .catch((error) => {
                console.error(error)
                this.showNotification('Error', error.body.message, 'error');
                this.error = error;
                this.loadFinished = true;
            });
    }

    submitDetails() {
        this.isSaving = true;
        this.saveData();
    }

    saveData() {
        //saves current file
        const data = new FormData();
        data.append('mydoc.pdf', blob, 'mydoc.pdf');
    }

    //handle modal
    openModal() {
        // to open modal set isModalOpen tarck value as true
        this.isModalOpen = true;
    }
    closeModal() {
        // to close modal set isModalOpen tarck value as false
        this.isModalOpen = false;
    }
    submitDetails() {
        // to close modal set isModalOpen tarck value as false
        //Add your code to call apex method or do some processing
        this.isModalOpen = false;
    }
}
