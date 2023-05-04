let resourceURL = '/resource/';
const VIEWER_READY_EVENT = 'VIEWER_READY';
const START_COMPARE_EVENT = 'START_COMPARE';
const SYSTEM_RUN_IN_DEMO_MODE_EVENT = 'SYSTEM_RUN_IN_DEMO_MODE_EVENT';
const FILES_LOAD_STARTED_EVENT = 'FILES_LOAD_STARTED';
const FILES_LOADED_EVENT = 'FILES_LOADED';
const COMPARISON_STARTED_EVENT = 'COMPARISON_STARTED';
const COMPARISON_COMPLETED_EVENT = 'COMPARISON_COMPLETED';
const COMPARISON_FAILED_EVENT = 'COMPARISON_FAILED';
const CONNECTION_LOST_EVENT = 'CONNECTION_LOST';
const DEFAULT_CLOSE_BUTTON_LABEL = 'Close Document';
const ENGLISH_LANGUAGE = 'en';
const LEFT_VIEWER_NUMBER = 1;
const DOCUMENT_MARGIN_BOTTOM = '30px';
const Core = window.Core;
const urlSearch = new URLSearchParams(location.hash);
const custom = JSON.parse(urlSearch.get('custom'));
const USER_LANGUAGE_TO_TRON_LANGUAGE = {'fr': 'fr', 'ja': 'ja', 'zh-Hans-CN': 'zh_cn'};
const USER_LANGUAGE_TO_CLOSE_BUTTON_LABEL = {
    'fr': 'Fermer le document',
    'ja': 'ドキュメントを閉じる',
    'zh-Hans-CN': '关闭文档'
};

resourceURL = resourceURL + custom.namespacePrefix + 'honey_';

Core.forceBackendType('ems');
// pdf workers
Core.setPDFResourcePath(resourceURL + 'resource')
if (custom.fullAPI) {
    Core.setPDFWorkerPath(resourceURL + 'pdf_full')
    Core.setPDFAsmPath(resourceURL + 'asm_full');
} else {
    Core.setPDFWorkerPath(resourceURL + 'pdf_lean')
    Core.setPDFAsmPath(resourceURL + 'asm_lean');
}
Core.setExternalPath(resourceURL + 'external')

window.addEventListener("message", handleMessage, false);

window.addEventListener('viewerLoaded', function () {
    sendMessageToLwc(VIEWER_READY_EVENT);

    // instance.UI.disableElements(['panToolButton', 'markReplaceTextToolButton'])

    let filesData = {
        data: {
            firstDocumentUrl: 'https://sf-webviewer.s3.ca-central-1.amazonaws.com/file-example_PDF_1MB.pdf',
            firstFileName: 'file1.pdf',
            secondDocumentUrl: 'https://sf-webviewer.s3.ca-central-1.amazonaws.com/file_4545_1.pdf',
            secondFileName: 'file2.pdf'
        }
    }
    compareDocuments(filesData);
    disableDividers();
    setPDFTronLanguage();
});

window.onunhandledrejection = (message) => {
    sendMessageToLwc(COMPARISON_FAILED_EVENT);
};

window.onerror = (message) => {
    sendMessageToLwc(COMPARISON_FAILED_EVENT);
};

function handleMessage(message) {
    switch (message.data.type) {
        case START_COMPARE_EVENT:
            compareDocuments(message.data);
            break;

        default:
            break;
    }
}

function sendMessageToLwc(messageType, data) {
    const messageBody = {type: messageType};

    if (data) {
        messageBody.data = data;
    }
    parent.postMessage(messageBody);
}

function setPDFTronLanguage() {
    const language = isCustomUserLanguage() ? USER_LANGUAGE_TO_TRON_LANGUAGE[custom.userLanguage] : ENGLISH_LANGUAGE;

    instance.UI.setLanguage(language);
}

function isCustomUserLanguage() {
    return USER_LANGUAGE_TO_TRON_LANGUAGE.hasOwnProperty(custom.userLanguage);
}

function initFeatures(UI) {
    UI.enableFeatures([UI.Feature.MultiViewerMode]);
    UI.enableElements(['comparePanelToggleButton']);
    UI.setLayoutMode(UI.LayoutMode.Continuous);
}

function compareDocuments(filesData) {
    let isLeftViewerReady = false;
    let isRightViewerReady = false;
    const {UI, Core} = instance;

    initFeatures(UI);

    const [documentLeftViewer, documentRightViewer] = Core.getDocumentViewers();

    const leftViewerReady = () => {
        isLeftViewerReady = true;
        startCompare();
    }

    const rightViewerReady = () => {
        isRightViewerReady = true;
        startCompare();
    }

    const handleAnnotationsLoaded = () => {
        instance.UI.removeEventListener(UI.Events.COMPARE_ANNOTATIONS_LOADED, handleAnnotationsLoaded);
        sendMessageToLwc(COMPARISON_COMPLETED_EVENT);
        UI.openElements(['comparePanel']);
    }

    const startCompare = async () => {
        if (isRightViewerReady && isLeftViewerReady) {
            setDocumentsMarginBottom();

            const filesData = await (getFilesSize(documentLeftViewer, documentRightViewer));

            sendMessageToLwc(FILES_LOADED_EVENT, filesData);
            instance.UI.addEventListener(UI.Events.COMPARE_ANNOTATIONS_LOADED, handleAnnotationsLoaded);
            createAnnotations();
            documentLeftViewer.getAnnotationManager().enableReadOnlyMode();
            documentRightViewer.getAnnotationManager().enableReadOnlyMode();
            documentLeftViewer.displayFirstPage();
            documentRightViewer.displayFirstPage();
            UI.enableMultiViewerSync(LEFT_VIEWER_NUMBER);
            if (Core.isDemoMode()) {
                sendMessageToLwc(SYSTEM_RUN_IN_DEMO_MODE_EVENT);
            }
        }
    }

    documentLeftViewer.addEventListener('annotationsLoaded', leftViewerReady, {once: true});
    documentRightViewer.addEventListener('annotationsLoaded', rightViewerReady, {once: true});

    loadDocuments(documentLeftViewer, documentRightViewer, filesData.data);
    disableButtons();
    disableHotKeys();
}

async function getFilesSize(documentLeftViewer, documentRightViewer) {
    const leftViewerFileSize = await documentLeftViewer.getDocument().getFileSize();
    const rightViewerFileSize = await documentRightViewer.getDocument().getFileSize();
    const filesInfo = {
        'sourceFileSize': leftViewerFileSize,
        'revisedFileSize': rightViewerFileSize
    }
    return filesInfo;
}
//This is a method to click on a native 'Start compare' button
function createAnnotations() {
    const comparisonButton = document.querySelector('[data-element="comparisonToggleButton"] button');
    if (comparisonButton) {
        sendMessageToLwc(COMPARISON_STARTED_EVENT);
        comparisonButton.click();
    }
}

function loadDocuments(documentLeftViewer, documentRightViewer, filesData) {
    sendMessageToLwc(FILES_LOAD_STARTED_EVENT);
    documentLeftViewer.loadDocument(filesData.firstDocumentUrl, {filename: filesData.firstFileName}).catch(
        () => sendMessageToLwc(CONNECTION_LOST_EVENT)
    );
    documentRightViewer.loadDocument(filesData.secondDocumentUrl, {filename: filesData.secondFileName}).catch(
        () => sendMessageToLwc(CONNECTION_LOST_EVENT)
    );
}

function disableButtons() {
    const label = USER_LANGUAGE_TO_CLOSE_BUTTON_LABEL.hasOwnProperty(custom.userLanguage)
        ? USER_LANGUAGE_TO_CLOSE_BUTTON_LABEL[custom.userLanguage]
        : DEFAULT_CLOSE_BUTTON_LABEL;

    const closeButtons = document.querySelectorAll(`[aria-label="${label}"]`);
    closeButtons.forEach(element => element.style.display = 'none');
    const comparisonToggleButton = document.querySelector('[data-element="comparisonToggleButton"]');
    comparisonToggleButton.style.visibility = 'hidden';
}

function disableDividers() {
    const dividers = document.querySelectorAll('div.HeaderItems .divider');
    dividers.forEach(divider => divider.style.display = 'none');
}

function disableHotKeys() {
    for (const key in instance.UI.hotkeys.Keys) {
        instance.UI.hotkeys.off(instance.UI.hotkeys.Keys[key]);
    }
}

function setDocumentsMarginBottom() {
    const documentContainers = document.querySelectorAll('div#virtualListContainer');
    documentContainers.forEach((document => document.style.marginBottom = DOCUMENT_MARGIN_BOTTOM));
}