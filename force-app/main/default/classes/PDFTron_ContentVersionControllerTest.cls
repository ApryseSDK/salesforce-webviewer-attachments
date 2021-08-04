@isTest
private class PDFTron_ContentVersionControllerTest {
    @TestSetup
    static void setupTestData(){
        Account a = new Account();
        a.Name = 'Test Account';

        insert a;

        ContentVersion contentVersion_1 = new ContentVersion(
            Title = 'some test title',
            PathOnClient = 'some title'+'.txt',
            VersionData = Blob.valueOf('some content to access later on'),
            IsMajorVersion = false /*so that can be updated later on*/
            );
        insert contentVersion_1;
    }
    @isTest static void testGetUser() {
        String userFullName = PDFTron_ContentVersionController.getUser();
        System.assertNotEquals(userFullName, null);
        User currentUser = [SELECT FirstName,LastName
            From User
            WHERE username = :UserInfo.getUsername()];
        System.assertEquals(currentUser.FirstName + ' ' +  currentUser.LastName, userFullName);
    }

    @isTest static void testGetBase64FromCv() {
        ContentVersion contentVersion_1 = [SELECT Id,Title,FileExtension, VersionData  FROM ContentVersion WHERE Title = 'some test title' LIMIT 1];
        System.assertNotEquals(contentVersion_1.Id, null);
        PDFTron_ContentVersionController.ContentVersionWrapper cvw = new PDFTron_ContentVersionController.ContentVersionWrapper(contentVersion_1, true);
        System.assertEquals(EncodingUtil.base64Encode(contentVersion_1.VersionData), cvw.body);
    }

    @isTest static void testGetAttachments() {

        ContentVersion contentVersion_1 = [SELECT Id,Title,FileExtension, VersionData, ContentDocumentId  FROM ContentVersion WHERE Title = 'some test title' LIMIT 1];
        Account a = [SELECT Id FROM Account WHERE Name = 'Test Account'];
        ContentDocumentLink contentDocumentLink = new ContentDocumentLink(LinkedEntityId = a.Id, ContentDocumentId = contentVersion_1.ContentDocumentId, ShareType = 'V');
        insert contentDocumentLink;

        List<PDFTron_ContentVersionController.ContentVersionWrapper> cvwList = PDFTron_ContentVersionController.getAttachments(a.Id);

        System.assertEquals(cvwList.size(), 1);
    }

    @isTest static void testSaveDocument() {
        String payload =  '{"title": "file-sample_150kB test", "filename": "file-sample_150kB test.pdf", "contentDocumentId": "0685Y00000QUaQGQA1"';
        payload += ', "base64": ' + EncodingUtil.base64Encode(Blob.valueof('dongneeeem!!!!')) + '}';
        ContentVersion contentVersion_1 = [SELECT Id,Title,FileExtension, VersionData  FROM ContentVersion WHERE Title = 'some test title' LIMIT 1];
        Account a = [SELECT Id FROM Account WHERE Name = 'Test Account'];
        String cvId = PDFTron_ContentVersionController.saveDocument(payload, a.Id, contentVersion_1.Id);

        List<ContentVersion> savedDocuments = [SELECT Id FROM ContentVersion WHERE Id = :cvId];
        System.assertEquals(savedDocuments.size(), 1);
    }
}