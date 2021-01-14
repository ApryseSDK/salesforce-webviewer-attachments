import { LightningElement, track, wire, api } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import { fireEvent } from 'c/pubsub';
import getAttachments from "@salesforce/apex/ContentVersionController.getAttachments";

export default class AttachmentPickerCombobox extends LightningElement {
    error;

    @track value = '';
    @track picklistOptions = [];
    @track isSaving = false;
    @track loadFinished = false;
    fileNameFieldVisible = false;
    fileName = '';
    selectedRadioValue = '';
    @api recordId;
    @wire(CurrentPageReference) pageRef;

    @wire(getAttachments, {recordId: "$recordId"}) 
    attachments({error, data}) {
        if(data) {
            data.forEach((attachmentRecord) => {
                console.log(JSON.stringify(attachmentRecord));
                var name = attachmentRecord.cv.Title + "." + attachmentRecord.cv.FileExtension;
                const option = {
                    label: name,
                    value: JSON.stringify(attachmentRecord)
                };
                this.picklistOptions = [ ...this.picklistOptions, option ];
            });
            error = undefined;
            this.loadFinished = true;
        } else if (error) {
            console.error(error);
            this.error = error;
            this.picklistOptions = undefined;
        }
    };

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
