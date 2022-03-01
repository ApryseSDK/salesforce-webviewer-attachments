(function() {
    function init() {
        console.log('hello from helloModule.js');
        
    }

    // this makes the sayHello function available in the window namespace
    // so we can call window.sayHello from any LWC JS file
    window.init = init;
})();