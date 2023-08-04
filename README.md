# How to View, Edit, Annotate and Redact Salesforce Record Attachment Files in a Lightning Web Component

## Quick Installation
Required tools: [VS Code](https://code.visualstudio.com/download) + [Salesforce Extension](https://developer.salesforce.com/tools/vscode/en/vscode-desktop/install)

* Clone the repository to your local and open it in VS Code with the [Salesforce Extension](https://developer.salesforce.com/tools/vscode/en/vscode-desktop/install) installed.
* Authenticate your environment (you can follow this [example](https://trailhead.salesforce.com/content/learn/projects/quickstart-vscode-salesforce/use-vscode-for-salesforce))
* Right-click on the `force-app` folder and select `SFDX: Deploy Source To Org`
* Once deployed, navigate to a Lightning page, click Setup > `Edit Page` and drag and drop the `pdftronWvContainer` into the desired location of your Lightning page

## Note on Salesforce deployment size limits
Please note that maximum deployment size is capped to ~39MB - in some cases the WebViewer worker files stored in `/staticresources/` exceed that file size limit. If you are facing this error, please split up your deployments in multiple parts to adhere to this size limit.

### Example 1
Your `/staticresources/` exceeds the 39MB limit - please deploy worker files one by one.

### Example 2
Your `/staticresources/` do not exceed the 39MB limit, but your total project is above the limit - you can deploy staticresources first, then deploy the other metadata types like so:

1. Deploy only StaticResource type
`sf project deploy start -m StaticResource`

2. Deploy other Metadata types
`sf project deploy start -m AuraDefinitionBundle ApexClass LightningComponentBundle LightningMessageChannel`

## Guide
This repository serves as the code-along sample for this [guide](https://www.pdftron.com/blog/webviewer/view-edit-annotate-and-redact-salesforce-record-attachments/).

## Project Structure
[WebViewer](https://www.pdftron.com/webviewer/) integrates with Salesforce by using WebViewer's source files in Salesforce's /staticresources/ - we leverage LWC to contain WebViewer UI inside of an iframe. We can use your browser's [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) API and leverage the main LWC component to communicate with other LWC components and use Apex to retrieve files, user information and other data from Salesforce to build a fully custom document workflow.

## Documentation
You can find more information on [www.pdftron.com/salesforce](www.pdftron.com/salesforce) which includes documentation, use cases, and more information. For technical inquiries reach out to support@pdftron.com - for information on licensing you can contact sales@pdftron.com
