# How to View, Edit, Annotate and Redact Salesforce Record Attachment Files in a Lightning Web Component

## Guide
This repository serves as the code-along sample for this [guide](https://www.pdftron.com/blog/webviewer/view-edit-annotate-and-redact-salesforce-record-attachments/).

## Project Structure
[WebViewer](https://www.pdftron.com/webviewer/) integrates with Salesforce by using WebViewer's source files in Salesforce's /staticresources/ - we leverage LWC to contain WebViewer UI inside of an iframe. We can use your browser's [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) API and leverage the main LWC component to communicate with other LWC components and use Apex to retrieve files, user information and other data from Salesforce to build a fully custom document workflow.

## Documentation
You can find more information on [www.pdftron.com/salesforce](www.pdftron.com/salesforce) which includes documentation, use cases, and more information. For technical inquiries reach out to support@pdftron.com - for information on licensing you can contact sales@pdftron.com
