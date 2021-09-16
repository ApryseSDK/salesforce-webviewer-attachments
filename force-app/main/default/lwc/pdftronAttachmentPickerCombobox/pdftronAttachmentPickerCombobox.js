import { LightningElement, track, wire, api } from 'lwc'
import { CurrentPageReference } from 'lightning/navigation'
import { fireEvent, registerListener, unregisterAllListeners } from 'c/pubsub'
import getAttachments from '@salesforce/apex/PDFTron_ContentVersionController.getExistingAttachments'
import getBase64FromCv from '@salesforce/apex/PDFTron_ContentVersionController.getBase64FromCv'
import { ShowToastEvent } from 'lightning/platformShowToastEvent'
import apexSearch from '@salesforce/apex/PDFTron_ContentVersionController.search'

export default class PdftronAttachmentPickerCombobox extends LightningElement {
  error

  @track value = ''
  @track picklistOptions = []
  @track isSaving = false
  @track loadFinished = false
  documentsRetrieved = false
  @api recordId
  @track attachments = []
  @wire(CurrentPageReference) pageRef

  renderedCallback () {
    if (!this.documentsRetrieved) {
      getAttachments({ recordId: this.recordId })
        .then(data => {
          console.log('data', data)
          this.attachments = data;
          this.initLookupDefaultResults();

          this.error = undefined
          this.loadFinished = true
          this.documentsRetrieved = true
        })
        .catch(error => {
          console.error(error)
          this.showNotification('Error', error, 'error')
          this.error = error
        })
    }
  }

  connectedCallback () {
    registerListener('refreshOnSave', this.refreshOnSave, this);
    this.initLookupDefaultResults();
  }

  disconnectedCallback () {
    unregisterAllListeners(this)
  }

  showNotification (title, message, variant) {
    const evt = new ShowToastEvent({
      title: title,
      message: message,
      variant: variant
    })
    this.dispatchEvent(evt)
  }

  initLookupDefaultResults () {
    // Make sure that the lookup is present and if so, set its default results
    const lookup = this.template.querySelector('c-lookup')
    if (lookup) {
      lookup.setDefaultResults(this.attachments);
    }
  }

  handleSearch (event) {
    const lookupElement = event.target
    apexSearch(event.detail)
      .then(results => {
        console.log('searchResults', results)
        lookupElement.setSearchResults(results)
      })
      .catch(error => {
        // TODO: handle error
        this.error = error
        console.error(error)
        let def_message =
          'We have encountered an error while searching for your file  ' +
          event.detail +
          '\n'

        this.showNotification(
          'Error',
          def_message + error.body.message,
          'error'
        )
      })
  }

  handleSingleSelectionChange (event) {
    console.log(event.detail[0])
    this.checkForErrors()

    if (event.detail.length < 1) {
      return
    }

    this.isLoading = true

    getFileDataFromId({ Id: event.detail[0] })
      .then(result => {
        fireEvent(this.pageRef, 'blobSelected', result)
        this.isLoading = false
      })
      .catch(error => {
        // TODO: handle error
        this.error = error
        console.error(error)
        this.isLoading = false
        let def_message =
          'We have encountered an error while handling your file. '

        this.showNotification(
          'Error',
          def_message + error.body.message,
          'error'
        )
      })
  }

  handleUploadFinished (event) {
    this.showNotification(
      'Done!...',
      `Successfully uploaded your file(s)`,
      'success'
    )
  }

  handleUploadFinished () {
    this.picklistOptions = []
    let temp = this.value
    getAttachments({ recordId: this.recordId })
      .then(data => {
        console.log('data', data)

        data.forEach(attachmentRecord => {
          console.log(JSON.stringify(attachmentRecord))
          var name =
            attachmentRecord.cv.Title + '.' + attachmentRecord.cv.FileExtension
          const option = {
            label: name,
            value: attachmentRecord.cv.Id
          }
          console.log('option', option)
          this.picklistOptions = [...this.picklistOptions, option]
        })
        this.value = temp
        this.error = undefined
        this.loadFinished = true
      })
      .catch(error => {
        console.error(error)
        this.showNotification('Error', error, 'error')
        this.error = error
      })
  }

  refreshOnSave (docId) {
    this.picklistOptions = []
    this.loadFinished = false
    getAttachments({ recordId: this.recordId })
      .then(data => {
        console.log('data', data)

        data.forEach(attachmentRecord => {
          console.log(JSON.stringify(attachmentRecord))
          var name =
            attachmentRecord.cv.Title + '.' + attachmentRecord.cv.FileExtension
          const option = {
            label: name,
            value: attachmentRecord.cv.Id
          }
          console.log('option', option)
          this.picklistOptions = [...this.picklistOptions, option]
        })
        this.value = docId
        this.error = undefined
        this.loadFinished = true
      })
      .catch(error => {
        console.error(error)
        this.showNotification('Error', error, 'error')
        this.error = error
      })
  }

  handleChange (event) {
    this.value = event.detail.value
    getBase64FromCv({ recordId: this.value })
      .then(result => {
        console.log('result', result)
        fireEvent(this.pageRef, 'blobSelected', result)
        this.error = undefined
      })
      .catch(error => {
        console.error(error)
        this.showNotification('Error', error.body.message, 'error')
        this.error = error
      })
  }

  submitDetails () {
    this.isSaving = true
    this.saveData()
  }

  saveData () {
    //saves current file
    const data = new FormData()
    data.append('mydoc.pdf', blob, 'mydoc.pdf')
  }
}
