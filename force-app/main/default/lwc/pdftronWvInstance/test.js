window.CoreControls.forceBackendType("ems");
// PDF workers
window.CoreControls.setPDFWorkerPath("/resource");
window.CoreControls.setPDFResourcePath("/resource/pdftron_resource");
window.CoreControls.setPDFAsmPath("/resource/pdftron_asm");
let customObj; //used to pass custom data to the viewer
let imgW, imgH;
//////////////////////////////////////////////////////////////////////////////////////
// Event listeners
window.addEventListener("viewerLoaded", viewerLoaded, false);
window.addEventListener("documentLoaded", documentLoaded, false);
window.addEventListener("message", receiveMessage, false);
//////////////////////////////////////////////////////////////////////////////////////
// Constants
const RECVDT = "RECEIVED_DATE";
const PASSPORT = "PASSPORT";
const PHOTO = "PHOTO";
//////////////////////////////////////////////////////////////////////////////////////
// Receive incoming viewer messages
function receiveMessage(event) {
  customObj = JSON.parse(readerControl.getCustomData());
  if (event.isTrusted && typeof event.data === "object") {
    switch (event.data.type) {
      case customObj.event_open_doc:
        openDocument(event.data.file);
        break;
      case customObj.event_download_doc:
        event.target.readerControl.docViewer
          .getDocument()
          .getFileData()
          .then(function (data) {
            var arr = new Uint8Array(data);
            var blob = new Blob([arr], { type: "application/pdf" });
            window.saveAs(blob, "downloaded.pdf");
          });
        break;
      default:
        break;
    }
  }
}
//////////////////////////////////////////////////////////////////////////////////////
// Send outgoing viewer messages
function sendMessage(event) {
  //console.error("Outgoing Message from Viewer: ", event.msg + " -- " + event.payload)
  if (event.msg === customObj.event_ready) {
    setTimeout(function () {}, 2000);
  }
  window.parent.postMessage(
    { msg: event.msg, payload: event.payload },
    window.parent.location
  );
}
//////////////////////////////////////////////////////////////////////////////////////
// Event after the viewer is loaded
async function viewerLoaded() {
  customObj = JSON.parse(readerControl.getCustomData()); //get passed-in data from the parent window
  const docViewer = readerControl.docViewer;
  if (customObj.imageUrl) {
    const tool = docViewer.getTool("AnnotationCreateRubberStamp");
    tool.setStandardStamps([customObj.imageUrl]);
    tool.on("annotationAdded", (annotation) => {
      annotation.NoResize = true;
    });
  }
  await updateToolbar();

  await updateRedactionPopupMenu();
  readerControl.enableFeatures(readerControl.Feature.MultipleViewerMerging); //allows drag-n-drop of pages
  sendMessage({ msg: customObj.event_ready, payload: true });
}
//////////////////////////////////////////////////////////////////////////////////////
// Update Toolbar (buttons, etc)
async function updateToolbar() {
  customObj = JSON.parse(readerControl.getCustomData()); //get passed-in data from the parent window
  //string to boolean
  let enableSaving = customObj.saving === "true";
  let enableThumbButtons = customObj.thumbbuttons === "true";
  if (customObj.enableStampOnly === "true") {
    readerControl.disableElements(["toolbarGroup-Shapes"]);
    readerControl.disableElements(["toolbarGroup-Edit"]);
    readerControl.disableElements(["toolbarGroup-Annotate"]);
    readerControl.disableElements(["signatureToolGroupButton"]);
    readerControl.disableElements(["fileAttachmentToolGroupButton"]);
    readerControl.disableElements(["stampToolGroupButton"]);
    readerControl.disableElements(["calloutToolGroupButton"]);
  }
  if (enableSaving) {
    addActionButton("save.svg", saveDocument, "Save document", "saveButton"); //add save button
  }
  if (!enableThumbButtons) {
    readerControl.disableElements(["thumbnailControl"]); //disable thumbnail buttons (rotate, delete)
  }
  /*
  let enableRedact = customObj.redaction === "true";
  let enableAnnot = customObj.annotation === "true";
  //if annotations are enabled, show custom annotation buttons
  if (enableAnnot) {
    //hideToolbarButtons();
    addDivider();
    addActionButton(
      "star.svg",
      addCustAnno,
      "Add custom annotation",
      "annotButton"
    ); //add custom annotation button
    addActionButton(
      "printwithout.svg",
      printWithoutAnno,
      "Print without annotations",
      "printWOAnnoButton"
    ); //add print without annotations button
    addActionButton(
      "printwith.svg",
      printWithAnno,
      "Print with annotations",
      "printWAnnoButton"
    ); //add print with annotations button 
  }
*/
}
//////////////////////////////////////////////////////////////////////////////////////
// Update Redaction Popup Menu
async function updateRedactionPopupMenu() {
  await readerControl.disableElements([
    "applyAllButton",
    "annotationCommentButton",
    "annotationStyleEditButton"
  ]);
  await readerControl.updateElement("annotationRedactButton", {
    onClick: () => {
      const annotManager = readerControl.docViewer.getAnnotationManager();
      const redactionList = annotManager
        .getAnnotationsList()
        .filter((annot) => annot instanceof Annotations.RedactionAnnotation);
      annotManager.applyRedactions(redactionList[0]);
      sendMessage({ msg: customObj.event_redact_applied, payload: true });
    }
  });
}
//////////////////////////////////////////////////////////////////////////////////////
// Event after the document is loaded
async function documentLoaded() {
  await readerControl.openElements(["thumbnailsPanel"]); //open thumbnail panel
  await readerControl.setFitMode("fitPage");
  //sendMessage({msg:customObj.event_doc_loaded});
}
//////////////////////////////////////////////////////////////////////////////////////
// Hide default toolbar buttons [Search, Fullscreen, Download and Print]
async function hideToolbarButtons() {
  await readerControl.setHeaderItems((header) => {
    const items = header.getItems().slice(0, -3);
    header.update(items);
  });
}
//////////////////////////////////////////////////////////////////////////////////////
// Add a divider to separate buttons
async function addDivider() {
  await readerControl.setHeaderItems((header) => {
    header.push({
      type: "divider",
      hidden: ["mobile"]
    });
  });
}
//////////////////////////////////////////////////////////////////////////////////////
// Add a generic action button to the toolbar
async function addActionButton(imgName, funcName, titleName, elemName) {
  await readerControl.setHeaderItems((header) => {
    header.push({
      type: "actionButton",
      img: imgName,
      onClick: () => {
        funcName();
      },
      title: titleName,
      dataElement: elemName
    });
  });
}
//////////////////////////////////////////////////////////////////////////////////////
// Save document or image
async function saveDocument() {
  try {
    //check if we have a document to save
    const docViewer = await readerControl.docViewer;
    const annotManager = await docViewer.getAnnotationManager();
    const documentHasStampAnnotation = annotManager
      .getAnnotationsList()
      .some((annotation) => annotation instanceof Annotations.StampAnnotation);
    sendMessage({
      msg: "viewer_seal_applied",
      payload: documentHasStampAnnotation
    });
    const doc = await docViewer.getDocument();
    if (!doc) {
      throw Error("No document to save.");
    }
    let assetType = customObj.assettype.toUpperCase();
    let savedDocument;
    if (assetType === PASSPORT || assetType === PHOTO) {
      savedDocument = await PDFNet.runWithoutCleanup(saveAsImage);
    } else {
      savedDocument = await saveAsPdf();
    }
    sendMessage({ msg: customObj.event_save_doc, payload: savedDocument });
  } catch (error) {
    console.error(error);
  }
}
//////////////////////////////////////////////////////////////////////////////////////
// Save image
async function saveAsImage() {
  try {
    const docViewer = await readerControl.docViewer;
    const doc = await docViewer.getDocument();
    const pdfdoc = await doc.getPDFDoc();
    //initilize pdfdrawer and set size based on original image
    const pdfdraw = await PDFNet.PDFDraw.create();
    if (typeof imgW !== "undefined") {
      pdfdraw.setImageSize(imgW, imgH);
    } else {
      pdfdraw.setDpi = 92;
    }
    //get current page
    const itr = await pdfdoc.getPageIterator(1);
    const currPage = await itr.current();
    //set encoder to 90 quality; 100 bloats the image by 50% - need more testing
    const objSet = await PDFNet.ObjSet.create();
    const encoderQual = await objSet.createDict();
    encoderQual.putNumber("Quality", 90);
    //convert pdf to jpeg
    const imgBuffer = await pdfdraw.exportStream(currPage, "JPEG", encoderQual);
    let binary = "";
    for (let i = 0; i < imgBuffer.byteLength; i++) {
      binary += String.fromCharCode(imgBuffer[i]);
    }
    const fileContents = window.btoa(binary);
    return fileContents;
  } catch (error) {
    throw "Error: Saving file as JPEG.\n" + error;
  }
}
//////////////////////////////////////////////////////////////////////////////////////
// Save document
async function saveAsPdf() {
  //get document size
  //const pageIdx = docViewer.getCurrentPage() - 1;
  //const pageInfo = document.getPageInfo(pageIdx);
  //console.log("pdf width x height: ", pageInfo.width + " x " + pageInfo.height);
  const docViewer = await readerControl.docViewer;
  const doc = await docViewer.getDocument();
  const annotManager = await docViewer.getAnnotationManager();
  const xfdfString = await annotManager.exportAnnotations();
  //const options = { xfdfString, flatten: true }; burn-in annotations
  const options = { xfdfString, finishedWithDocument: false };
  const data = await doc.getFileData(options); // saves the document with annotations
  return new Promise((resolve, reject) => {
    let arr = new Uint8Array(data);
    let blob = new Blob([arr], { type: "application/pdf" });
    let reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = function () {
      let fileContents = reader.result;
      let base64 = "base64,";
      let content = fileContents.indexOf(base64) + base64.length;
      fileContents = fileContents.substring(content);
      resolve(fileContents);
    };
    reader.onerror = function () {
      reject("Error: Saving file as PDF.\n" + reader.error);
    };
  });
}
//////////////////////////////////////////////////////////////////////////////////////
// Print without annotations
async function printWithoutAnno() {
  await setPrintable(false);
  readerControl.print();
}
//////////////////////////////////////////////////////////////////////////////////////
// Print with annotations
async function printWithAnno() {
  await setPrintable(true);
  readerControl.print();
}
//////////////////////////////////////////////////////////////////////////////////////
// Initialize custom stamp
async function addCustAnno() {
  await addCustomStamp(customObj.stamp, {}, { width: 150, height: 150 });
}
//////////////////////////////////////////////////////////////////////////////////////
// Set printable flag for all annotations
async function setPrintable(value) {
  const docViewer = readerControl.docViewer;
  const annotManager = await docViewer.getAnnotationManager();
  const annotations = await annotManager.getAnnotationsList();
  annotations.forEach((annot) => {
    if (annot.Subject === RECVDT) {
      // "received date" annotation should always be printable
      annot.Printable = true;
    } else {
      annot.Printable = value;
    }
  });
}
//////////////////////////////////////////////////////////////////////////////////////
// Create custom annotation stamp
async function addCustomStamp(img, point, rect) {
  const docViewer = readerControl.docViewer;
  const annotManager = docViewer.getAnnotationManager();
  point = point || {};
  rect = rect || {};
  const doc = docViewer.getDocument();
  const displayMode = docViewer.getDisplayModeManager().getDisplayMode();
  const page = displayMode.getSelectedPages(point, point);
  if (!!point.x && page.first == null) {
    return; // don't add to an invalid page location
  }
  const pageIdx =
    page.first !== null ? page.first : docViewer.getCurrentPage() - 1;
  const pageInfo = doc.getPageInfo(pageIdx);
  const pagePoint = displayMode.windowToPage(point, pageIdx);
  const zoom = docViewer.getZoom();
  const stampAnnot = new Annotations.StampAnnotation();
  stampAnnot.PageNumber = pageIdx + 1;
  const rotation = docViewer.getCompleteRotation(pageIdx + 1) * 90;
  stampAnnot.Rotation = rotation;
  if (rotation === 270 || rotation === 90) {
    stampAnnot.Width = rect.height / zoom;
    stampAnnot.Height = rect.width / zoom;
  } else {
    stampAnnot.Width = rect.width / zoom;
    stampAnnot.Height = rect.height / zoom;
  }
  stampAnnot.X = (pagePoint.x || pageInfo.width / 2) - stampAnnot.Width / 2;
  stampAnnot.Y = (pagePoint.y || pageInfo.height / 2) - stampAnnot.Height / 2;
  //to display received date, we need to change the annotation type to FreeText and setContents - more research needed
  //const datetime = new Date().toLocaleString());
  //console.log("datetime: ", datetime);
  //stampAnnot.ImageData = "data:text/plain;base64," + datetime;
  stampAnnot.ImageData = "data:image/png;base64," + img; //encodeURI("data:image/svg+xml," + svgElement);
  stampAnnot.Author = annotManager.getCurrentUser();
  stampAnnot.Subject = RECVDT;
  annotManager.registerAnnotationType("customStamp", stampAnnot);
  annotManager.deselectAllAnnotations();
  annotManager.addAnnotation(stampAnnot);
  annotManager.redrawAnnotation(stampAnnot);
  annotManager.selectAnnotation(stampAnnot);
}
//////////////////////////////////////////////////////////////////////////////////////
// Open document
async function openDocument(file) {
  let signature;
  let options = { extension: null };
  try {
    //check if a file() object was passed in; don't do this for url
    if (typeof file.name == "string") {
      if (window.FileReader && window.Blob) {
        signature = await getFileSignature(file);
      }
      let result = await stageDocument(file, signature); //covert tiffs or set dimensions for image
      options.extension = result.ext;
      await readerControl.loadDocument(result.file, options); //load document
    } else {
      //load url
      await readerControl.loadDocument(file);
    }
  } catch (error) {
    console.error(error);
  }
}
//////////////////////////////////////////////////////////////////////////////////////
// Return the first 4 bytes of the file as a hex string
async function getFileSignature(file) {
  const blob = file.slice(0, 4);
  let contentBuffer = await readFileAsync(blob);
  const uint = new Uint8Array(contentBuffer);
  let bytes = [];
  uint.forEach((byte) => {
    bytes.push(byte.toString(16));
  });
  const sig = bytes.join("").toUpperCase();
  console.log("doc-viewer-file-signature: ", sig); //delete me
  return sig;
}
//////////////////////////////////////////////////////////////////////////////////////
// Stage document for viewing
async function stageDocument(file, signature) {
  console.log("doc-viewer-mime-type: ", getMimeType(signature)); //delete me
  let extension = "pdf";
  switch (getMimeType(signature)) {
    case "image/tiff":
      file = await convertTiffToPdf(file);
      break;
    case "image/jpeg":
      extension = "jpeg";
      setImageDimensions(file);
      break;
    case "image/png":
      extension = "png";
      setImageDimensions(file);
      break;
    default:
      break;
  }

  return { file: file, ext: extension };
}
//////////////////////////////////////////////////////////////////////////////////////
// Get mime type based on file signature
function getMimeType(signature) {
  let type;
  switch (signature) {
    case "492049":
    case "49492A0":
    case "4D4d002A":
    case "4D4d002B":
      type = "image/tiff";
      break;
    case "FFD8FFE0":
    case "FFD8FFE1":
    case "FFD8FFE2":
    case "FFD8FFDB":
      type = "image/jpeg";
      break;
    case "25504446":
      type = "application/pdf";
      break;
    case "89504E47":
      type = "image/png";
      break;
    case "47494638":
      type = "image/png";
      break;
    default:
      type = "unknown";
      break;
  }
  return type;
}
//////////////////////////////////////////////////////////////////////////////////////
// Convert Tiff file to Pdf as it's not supported by PDFTron
async function convertTiffToPdf(file) {
  let contentBuffer = await readFileAsync(file);
  return PDFNet.runWithoutCleanup(async () => {
    let newDoc = await PDFNet.PDFDoc.create();
    newDoc.initSecurityHandler();
    newDoc.lock();
    let tiffDoc = await PDFNet.Filter.createFromMemory(contentBuffer);
    await PDFNet.Convert.fromTiff(newDoc, tiffDoc);
    newDoc.unlock();
    return newDoc;
  });
}
//////////////////////////////////////////////////////////////////////////////////////
// Set image dimensions
function setImageDimensions(file) {
  var _URL = window.URL || window.webkitURL;
  var img = new Image();
  var objectUrl = _URL.createObjectURL(file);
  img.src = objectUrl;
  img.onload = function () {
    imgW = this.width;
    imgH = this.height;
    _URL.revokeObjectURL(objectUrl);
  };
}
//////////////////////////////////////////////////////////////////////////////////////
// Read file as array buffer
function readFileAsync(file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
