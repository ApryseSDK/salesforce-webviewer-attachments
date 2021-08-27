({
    
    getFileLink: function (component, event, helper) {
        if(event != null) {
            var message = event.getParam('messageBody');
            var source = event.getParam('source');
            component.set("v.refreshWebViewer", true);
            helper.getFileLink(component, event, helper, message);
        }
    },
    
    showPDFWebViwerMessage : function (component, event, helper) {
    }
})