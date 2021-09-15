public with sharing class PDFTron_ContentVersionController {
    @AuraEnabled
    public static string getUser() {
        try {
            User currentUser = [SELECT FirstName,LastName
            From User
            WHERE username = :UserInfo.getUsername()];

            return currentUser.FirstName + ' ' +  currentUser.LastName;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static ContentVersionWrapper getBase64FromCv(String recordId) {
        try {
            ContentVersion cv = [SELECT Id, Title,FileExtension, VersionData FROM ContentVersion WHERE Id = :recordId AND IsLatest = true LIMIT 1];
            return new ContentVersionWrapper(cv, true);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static List<ContentVersionWrapper> getAttachments(String recordId){
        try {
            List<String> cdIdList = new List<String> ();
            List<ContentVersionWrapper> cvwList = new List<ContentVersionWrapper> ();

            //Define supported file extensions
            Set<String> fileFormats = new Set<String> {
                    'pdf', 
                    'xfdf',
                    'fdf',
                    'doc',
                    'docx', 
                    'xlsx',
                    'ppt',
                    'pptx',
                    'jpg',
                    'jpeg',
                    'png',
                    'mov',
                    'tif',
                    'xls',
                    'xlsx'
            };
            //Find links between record & document
            for(ContentDocumentLink cdl : 
                    [   SELECT id, ContentDocumentId, ContentDocument.LatestPublishedVersionId 
                        FROM ContentDocumentLink 
                        WHERE LinkedEntityId = :recordId    ]) {
                cdIdList.add(cdl.ContentDocumentId);
            }
            //Use links to get attachments
            for(ContentVersion cv : 
                    [   SELECT Id, Title,FileExtension, VersionData, ContentDocumentId 
                        FROM ContentVersion 
                        WHERE ContentDocumentId IN :cdIdList 
                        AND IsLatest = true ]) {
                if(fileFormats.contains(cv.FileExtension.toLowerCase())) {
                    cvwList.add(new ContentVersionWrapper(cv, false));
                }
            }
            return cvwList;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static String saveDocument(String json, String recordId, String cvId) {
        try {
            //parse annotated document payload and create new ContentVersion
            PDFTron_ContentVersionPayload pl = new PDFTron_ContentVersionPayload(json);
            ContentVersion annotatedCv = new ContentVersion();

            //retrieve original document before annotation
            List<ContentVersion> cvList = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cvId];

            if(cvList.size() == 1) {
                //retrieve and delete original document
                List<ContentDocument> originalDocument = [SELECT Id FROM ContentDocument WHERE Id = :cvList[0].ContentDocumentId];
                
                if(originalDocument.size() > 0) delete originalDocument;
            } else {
                System.debug('Could not retrieve record for ' + cvId);
            }
            //build document blob
            annotatedCv.VersionData = EncodingUtil.base64Decode(pl.base64Data);
            annotatedCv.Title = pl.title;
            annotatedCv.PathOnClient = pl.filename;

            insert annotatedCv; 

            if(annotatedCv.ContentDocumentId == null && String.isNotBlank(recordId)) {
                //get the content version since ContentDocumentId is defined after insert
                List<ContentVersion> contentVersions = [SELECT Id, ContentDocumentId FROM ContentVersion WHERE Id =: annotatedCv.Id LIMIT 1];

                //link record with document
                ContentDocumentLink contentDocumentLink = new ContentDocumentLink(LinkedEntityId = recordId, ContentDocumentId = contentVersions[0].ContentDocumentId, ShareType = 'V');
                insert contentDocumentLink;
            }

            return annotatedCv.Id;
        } catch (Exception e) {
            system.debug('### ERROR: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }

    public class ContentVersionWrapper {
        @AuraEnabled
        public String name {get; set;}
        @AuraEnabled
        public String body {get; set;} 
        @AuraEnabled
        public ContentVersion cv;
        
        public ContentVersionWrapper(ContentVersion contentVer, Boolean encode) {
            this.cv = contentVer;
            this.name = contentVer.Title + '.' + contentVer.FileExtension;
            if(encode) {
                this.body = EncodingUtil.base64Encode(contentVer.VersionData);
            }
        }
    }

    public class PDFTron_ContentVersionPayload {
        public String title {get; set;}
        public String filename {get; set;}
        public String base64Data {get; set;}
        public String contentDocumentId {get; set;}

        public PDFTron_ContentVersionPayload(String json) {
            PDFTron_ContentVersionPayload pl = (PDFTron_ContentVersionPayload) System.JSON.deserialize(json, PDFTron_ContentVersionPayload.class);
            this.title = pl.title;
            this.filename = pl.filename;
            this.base64Data = pl.base64Data;
            this.contentDocumentId = pl.contentDocumentId;
        }
    }
}