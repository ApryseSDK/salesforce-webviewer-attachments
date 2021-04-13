public without sharing class WebViewerLMSCmpController {
    @AuraEnabled(Cacheable=true)
    public static List<NEILON__File__c> getS3Files(String fileId){
        return [Select Id, Name, NEILON__File_Presigned_URL__c From NEILON__File__c Where Id = :fileId];
    }
}