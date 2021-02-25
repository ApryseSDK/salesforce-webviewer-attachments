({
    handleClick: function(component, event, helper) {
        let myMessage = component.get("v.myMessage");
        const payload = {
            source: "Aura Component",
            messageBody: myMessage
        };
        component.find("lmsWebViewerChannel").publish(payload);
    },
    handleReceiveMessage: function (component, event, helper) {
        if (event != null) {
            const message = event.getParam('messageBody');
            const source = event.getParam('source');

            component.set("v.receivedMessage", 'Message: ' + message + '. Sent From: ' + source);
        }
    },
    handleChange: function (component, event) {
        const payload = {
            source: "Aura Component",
            link: event.getParam('value')
        };

        component.find("lmsWebViewerChannel").publish(payload);
    }
})