import { LightningElement, track, wire, api } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import { fireEvent, registerListener, unregisterAllListeners } from 'c/pubsub';
import getAttachments from "@salesforce/apex/PDFTron_ContentVersionController.getAttachments";
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

export default class PdftronAttachmentPickerCombobox extends LightningElement {
    error;

    @track value = '';
    @track picklistOptions = [];
    @track isSaving = false;
    @track loadFinished = false;
    @api recordId;
    @wire(CurrentPageReference) pageRef;
    wireData;

    @wire(getAttachments, {recordId: "$recordId"}) 
    attachments({error, data}) {
        if(data) {
            this.wireData = data;
            data.forEach((attachmentRecord) => {
                console.log(JSON.stringify(attachmentRecord));
                var name = attachmentRecord.cv.Title + "." + attachmentRecord.cv.FileExtension;
                const option = {
                    label: name,
                    value: JSON.stringify(attachmentRecord)
                };
                this.picklistOptions = [ ...this.picklistOptions, option ];
            });
            this.error = undefined;
            this.loadFinished = true;
        } else if (error) {
            console.error(error);
            this.error = error;
            this.picklistOptions = undefined;
            let def_message = 'We have encountered an error while loading up your document. '

            this.showNotification('Error', def_message + error.body.message, 'error');
        }
    };

    connectedCallback() {
        registerListener('refreshApex', this.refreshApexWire, this);
    }

    disconnectedCallback() {
        unregisterAllListeners();
    }

    showNotification(title, message, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(evt);
    }

    handleAttachments(currentRecordId) {
        getAttachments({recordId: currentRecordId})
            .then((data) => {
                console.log("data", data);
                this.error = undefined;
                
                data.forEach((attachmentRecord) => {
                    console.log(JSON.stringify(attachmentRecord));
                    var name = attachmentRecord.cv.Title + "." + attachmentRecord.cv.FileExtension;
                    console.log(name);
                    const option = {
                        label: name,
                        value: JSON.stringify(attachmentRecord)
                    };
                    this.picklistOptions = [ ...this.picklistOptions, option ];
                });
                this.loadFinished = true;
            })
            .catch((error) => {
                console.error(error);
                this.error = error;
                this.picklistOptions = undefined;
                let def_message = 'We have encountered an error please refresh the page. '
    
                this.showNotification('Error', def_message + error.body.message, 'error');
            });
    }

    refreshApexWire() {
        console.log('refresh apex wire');
        //this.loadFinished = false;
        this.picklistOptions = [];

        this.handleAttachments(this.recordId);
    }

    handleChange(event) {
        this.value = event.detail.value;
        fireEvent(this.pageRef, 'blobSelected', this.value);
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
}
