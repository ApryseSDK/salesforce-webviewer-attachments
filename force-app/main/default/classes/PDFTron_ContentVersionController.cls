public with sharing class PDFTron_ContentVersionController {
  static Set<String> supportedFileFormats = new Set<String>{
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
    'tiff',
    'xls',
    'xlsx'
  };

  @AuraEnabled
  public static string getUser() {
    try {
      User currentUser = [
        SELECT FirstName, LastName
        FROM User
        WHERE username = :UserInfo.getUsername()
      ];

      return currentUser.FirstName + ' ' + currentUser.LastName;
    } catch (Exception e) {
      throw new AuraHandledException(e.getMessage());
    }
  }

  @AuraEnabled
  public static ContentVersionWrapper getBase64FromCv(String recordId) {
    try {
      ContentVersion cv = [
        SELECT Id, Title, FileExtension, VersionData
        FROM ContentVersion
        WHERE Id = :recordId AND IsLatest = TRUE
        LIMIT 1
      ];
      return new ContentVersionWrapper(cv, true);
    } catch (Exception e) {
      throw new AuraHandledException(e.getMessage());
    }
  }

  @AuraEnabled
  public static String saveDocument(String json, String recordId, String cvId) {
    try {
      //parse annotated document payload and create new ContentVersion
      PDFTron_ContentVersionPayload pl = new PDFTron_ContentVersionPayload(
        json
      );
      ContentVersion annotatedCv = new ContentVersion();

      //retrieve original document before annotation
      List<ContentVersion> cvList = [
        SELECT ContentDocumentId
        FROM ContentVersion
        WHERE Id = :cvId
      ];

      if (cvList.size() == 1) {
        //retrieve and delete original document
        List<ContentDocument> originalDocument = [
          SELECT Id
          FROM ContentDocument
          WHERE Id = :cvList[0].ContentDocumentId
        ];

        if (originalDocument.size() > 0)
          delete originalDocument;
      } else {
        System.debug('Could not retrieve record for ' + cvId);
      }
      //build document blob
      annotatedCv.VersionData = EncodingUtil.base64Decode(pl.base64Data);
      annotatedCv.Title = pl.title;
      annotatedCv.PathOnClient = pl.filename;

      insert annotatedCv;

      if (
        annotatedCv.ContentDocumentId == null && String.isNotBlank(recordId)
      ) {
        //get the content version since ContentDocumentId is defined after insert
        List<ContentVersion> contentVersions = [
          SELECT Id, ContentDocumentId
          FROM ContentVersion
          WHERE Id = :annotatedCv.Id
          LIMIT 1
        ];

        //link record with document
        ContentDocumentLink contentDocumentLink = new ContentDocumentLink(
          LinkedEntityId = recordId,
          ContentDocumentId = contentVersions[0].ContentDocumentId,
          ShareType = 'V'
        );
        insert contentDocumentLink;
      }

      return annotatedCv.Id;
    } catch (Exception e) {
      system.debug('### ERROR: ' + e.getMessage());
      throw new AuraHandledException(e.getMessage());
    }
  }

  @AuraEnabled
  public static List<Map<String, String>> getAnnotations(String documentId) {
    try {
      List<PDFTronAnnotations__c> temp = [
        SELECT Id, Content_Version_Id__c, Annotation_Id__c, xfdfString__c
        FROM PDFTronAnnotations__c
        WHERE Content_Version_Id__c = :documentId
      ];
      List<Map<String, String>> annotations = new List<Map<String, String>>();
      for (Integer i = 0; i < temp.size(); i++) {
        Map<String, String> annot = new Map<String, String>();
        annot.put('xfdfString', temp[i].xfdfString__c);
        annot.put('Annotation_Id', temp[i].Annotation_Id__c);
        annot.put('ContentVersion_Id', temp[i].Content_Version_Id__c);
        annotations.add(annot);
      }
      return annotations;
    } catch (Exception e) {
      throw new AuraHandledException(e.getMessage());
    }
  }

  @AuraEnabled
  public static List<ContentVersionWrapper> getAttachments(String recordId) {
    try {
      List<String> cdIdList = new List<String>();
      List<ContentVersionWrapper> cvwList = new List<ContentVersionWrapper>();

      //Find links between record & document
      for (ContentDocumentLink cdl : [
        SELECT id, ContentDocumentId, ContentDocument.LatestPublishedVersionId
        FROM ContentDocumentLink
        WHERE LinkedEntityId = :recordId
      ]) {
        cdIdList.add(cdl.ContentDocumentId);
      }
      //Use links to get attachments
      for (ContentVersion cv : [
        SELECT Id, Title, FileExtension, VersionData, ContentDocumentId
        FROM ContentVersion
        WHERE ContentDocumentId IN :cdIdList AND IsLatest = TRUE
      ]) {
        if (checkFileExtension(cv.FileExtension)) {
          cvwList.add(new ContentVersionWrapper(cv, false));
        }
      }
      return cvwList;
    } catch (Exception e) {
      throw new AuraHandledException(e.getMessage());
    }
  }

  @AuraEnabled
  public static String saveAnnotations(
    String action,
    String documentId,
    String annotationId,
    String xfdfString
  ) {
    System.debug('annotationId: ' + annotationId);
    System.debug('documentId: ' + documentId);
    System.debug('action: ' + action);
    System.debug('xfdf: ' + xfdfString);

    try {
      PDFTronAnnotations__c[] annots = [
        SELECT Id, Content_Version_Id__c, Annotation_Id__c, xfdfString__c
        FROM PDFTronAnnotations__c
        WHERE Annotation_Id__c = :annotationId
      ];

      System.debug('annots: ' + annots);
      Pattern MyPattern = Pattern.compile('<delete>(.*)</delete>');
      Matcher MyMatcher = MyPattern.matcher(xfdfString);

      Schema.DescribeSObjectResult scDescription = PDFTronAnnotations__c.sObjectType.getDescribe();

      if (action == 'delete') {
        if (!scDescription.isDeletable()) {
          throw new PDFTronException('Insufficient delete access');
        }

        String result = '';
        for (PDFTronAnnotations__c annot : annots) {
          result += annot.Id + ', ';
        }

        result = result.left(result.length() - 2) + result.right(1);

        // Delete record
        delete annots;
        return 'Successfully deleted: ' + result;
      } else if (annots.size() == 0) {
        if (!scDescription.isCreateable()) {
          throw new PDFTronException('Insufficient insert access');
        }

        // Create new record
        PDFTronAnnotations__c newAnnot = new PDFTronAnnotations__c(
          Content_Version_Id__c = documentId,
          Annotation_Id__c = annotationId,
          xfdfString__c = xfdfString
        );
        insert newAnnot;
        return newAnnot.Id + '';
      } else {
        if (!scDescription.isUpdateable()) {
          throw new PDFTronException('Insufficient update access');
        }

        // Update record
        annots[0].xfdfString__c = xfdfString;
        update annots;
        return annots[0].Id + '';
      }
    } catch (Exception e) {
      throw new AuraHandledException(e.getMessage());
    }
  }

  //get single file from Id
  @AuraEnabled(Cacheable=true)
  public static ContentVersionWrapper getFileDataFromId(String Id) {
    try {
      Long max = 1024 * 1024 * 25; // kb - mb - 6 MB
      ContentVersion cv = [
        SELECT
          Title,
          FileExtension,
          ContentSize,
          VersionData,
          ContentDocumentId,
          LastModifiedDate
        FROM ContentVersion
        WHERE Id = :Id
      ];
      if (cv.ContentSize > max) {
        throw new PDFTronException(
          'Your file size must not exceed ' +
          convertBytesToFormattedString(max) +
          ' - current file size: ' +
          convertBytesToFormattedString(cv.ContentSize)
        );
      }
      return new ContentVersionWrapper(cv, true);
    } catch (Exception e) {
      throw new AuraHandledException(e.getMessage());
    }
  }

  @AuraEnabled
  public static List<LookupSearchResult> getExistingAttachments(
    String recordId
  ) {
    try {
      List<String> cdIdList = new List<String>();
      List<LookupSearchResult> results = new List<LookupSearchResult>();

      //Find links between record & document for attachments
      for (ContentDocumentLink cdl : [
        SELECT id, ContentDocumentId, ContentDocument.LatestPublishedVersionId
        FROM ContentDocumentLink
        WHERE LinkedEntityId = :recordId
      ]) {
        cdIdList.add(cdl.ContentDocumentId);
      }
      //Use links to get attachments
      for (ContentVersion cv : [
        SELECT
          Id,
          Title,
          FileExtension,
          VersionData,
          ContentDocumentId,
          LastModifiedDate,
          LastModifiedBy.Alias,
          ContentSize
        FROM ContentVersion
        WHERE ContentDocumentId IN :cdIdList AND IsLatest = TRUE
        ORDER BY LastModifiedDate DESC
        LIMIT 10
      ]) {
        if (checkFileExtension(cv.FileExtension)) {
          String subtitle =
            'Modified ' +
            cv.LastModifiedDate +
            ' by ' +
            cv.LastModifiedBy.Alias;
          results.add(
            new LookupSearchResult(
              cv.Id,
              'ContentVersion',
              getFileLogo(cv.FileExtension),
              cv.Title +
              '.' +
              cv.FileExtension +
              ' (' +
              convertBytesToFormattedString(cv.ContentSize) +
              ')',
              subtitle
            )
          );
        }
      }
      return results;
    } catch (Exception e) {
      throw new AuraHandledException(e.getMessage());
    }
  }

  @AuraEnabled(Cacheable=true)
  public static List<LookupSearchResult> search(
    String searchTerm,
    List<String> selectedIds
  ) {
    searchTerm = '%' + searchTerm + '%';

    // Prepare results
    List<LookupSearchResult> results = new List<LookupSearchResult>();

    for (ContentVersion cv : [
      SELECT
        Title,
        FileExtension,
        LastModifiedDate,
        ContentSize,
        LastModifiedBy.Alias
      FROM ContentVersion
      WHERE Title LIKE :searchTerm
      ORDER BY LastModifiedDate DESC
    ]) {
      System.debug(cv);
      if (checkFileExtension(cv.FileExtension)) {
        String subtitle =
          'Modified ' +
          cv.LastModifiedDate +
          ' by ' +
          cv.LastModifiedBy.Alias;
        results.add(
          new LookupSearchResult(
            cv.Id,
            'ContentVersion',
            getFileLogo(cv.FileExtension),
            cv.Title +
            '.' +
            cv.FileExtension +
            ' (' +
            convertBytesToFormattedString(cv.ContentSize) +
            ')',
            subtitle
          )
        );
      }
    }

    //results.sort();
    return results;
  }

  public static String getFileLogo(String extension) {
    String logo = 'doctype:unknown';

    if (extension == 'pdf') {
      logo = 'doctype:pdf';
    } else if (extension == 'docx' || extension == 'doc') {
      logo = 'doctype:word';
    } else if (extension == 'xlsx' || extension == 'xls') {
      logo = 'doctype:excel';
    } else if (
      extension == 'tif' ||
      extension == 'jpg' ||
      extension == 'jpeg' ||
      extension == 'png'
    ) {
      logo = 'doctype:image';
    }
    return logo;
  }

  //only process blobs from below file formats
  public static Boolean checkFileExtension(String extension) {
    return supportedFileFormats.contains(extension.toLowerCase()); //compare set of valid extensions with lower case input string
  }

  //take long value and output readable string
  public static String convertBytesToFormattedString(Long Value) {
    if (Value < 1024) {
      //no conversion needed
      return string.valueOf(Value) + ' Bytes';
    } else if (Value >= 1024 && Value < (1024 * 1024)) {
      //KB
      Decimal kb = Decimal.valueOf(Value);
      kb = kb.divide(1024, 2);
      return string.valueOf(kb) + ' KB';
    } else if (Value >= (1024 * 1024) && Value < (1024 * 1024 * 1024)) {
      //MB
      Decimal mb = Decimal.valueOf(Value);
      mb = mb.divide((1024 * 1024), 2);
      return string.valueOf(mb) + ' MB';
    } else {
      //GB
      Decimal gb = Decimal.valueOf(Value);
      gb = gb.divide((1024 * 1024 * 1024), 2);
      return string.valueOf(gb) + ' GB';
    }
  }

  public class ContentVersionWrapper {
    @AuraEnabled
    public String name { get; set; }
    @AuraEnabled
    public String body { get; set; }
    @AuraEnabled
    public ContentVersion cv;

    public ContentVersionWrapper(ContentVersion contentVer, Boolean encode) {
      this.cv = contentVer;
      this.name = contentVer.Title + '.' + contentVer.FileExtension;
      if (encode) {
        this.body = EncodingUtil.base64Encode(contentVer.VersionData);
      }
    }
  }

  public class PDFTron_ContentVersionPayload {
    public String title { get; set; }
    public String filename { get; set; }
    public String base64Data { get; set; }
    public String contentDocumentId { get; set; }

    public PDFTron_ContentVersionPayload(String json) {
      PDFTron_ContentVersionPayload pl = (PDFTron_ContentVersionPayload) System.JSON.deserialize(
        json,
        PDFTron_ContentVersionPayload.class
      );
      this.title = pl.title;
      this.filename = pl.filename;
      this.base64Data = pl.base64Data;
      this.contentDocumentId = pl.contentDocumentId;
    }
  }

  public class PDFTronException extends Exception {
  }
}
