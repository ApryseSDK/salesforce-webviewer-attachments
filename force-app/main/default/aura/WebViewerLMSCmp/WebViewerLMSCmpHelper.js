({
    // This method is used to initialize component.
    getFileLink : function(component, event, helper, fileId) {
        
        // Get folder
        var getFilesAction = component.get("c.getS3Files");
        getFilesAction.setParams({
            "fileId": fileId
        });
        getFilesAction.setCallback(this, function(response) {
            var state = response.getState();
            if (state === "SUCCESS") {
                var options = [];
                var files = response.getReturnValue();
            	var payload = {
                    source: "S3-Link Reciever",
                    messageBody: files[0].NEILON__File_Presigned_URL__c,
                    filename: files[0].Name // Name field from SOQL Query
                };
                component.find("webViewerChannel").publish(payload);
                
            } else if(state == 'ERROR'){
                var errors = response.getError();
                if(errors){
                    if(errors[0] && errors[0].message){
                        console.log(errors[0].message);
                    }
                }
            }
        });
        $A.enqueueAction(getFilesAction); 
        
        component.set("v.refreshWebViewer", true);
        component.set("v.refreshWebViewer", false);
    }
})