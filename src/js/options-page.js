(function() {

    var baseHost = "getpocket.com";
    // var baseHost = "admin:s3krit@nick1.dev.readitlater.com";

    function checkForValidToken () {
        // Check if the user has still a valid token
        if (!navigator.onLine) { return; }

        // Check if we have a valid token for the user
        sendMessage({action:"isValidToken"}, function(resp) {
            if (resp.value === true) { return; }

            // If the token is not valid check if the username is set
            sendMessage({action: "getSetting", key: "username"}, function(response) {
                if (response.value === "") { return; }

                // Username is set but the token is not valid, logout user
                sendMessage({action: "logout"}, function(rsp) {
                    updateUI();
                });
            });
        });
    }

    function updateUI() {
        var usernameField = document.getElementById("username-field");
        var logoutLinkWrapper = document.getElementById("logout-link-wrapper");
        var loginLinkWrapper = document.getElementById("login-link-wrapper");

        sendMessage({action: "getSetting", key: "username"}, function(response) {
            var username = response.value;
            if (username) {
                sendMessage({action: "getDisplayUsername"}, function(response) {
                    usernameField.innerHTML = response.value;
                    logoutLinkWrapper.style.display = "inline";
                    usernameField.style.display = "inline";
                    loginLinkWrapper.style.display = "none";
                });
            }
            else {
                usernameField.style.display = "none";
                logoutLinkWrapper.style.display = "none";
                loginLinkWrapper.style.display = "inline";
            }
        });
    }



    /**
     * Initialization
     */
    function initDocumentTitle() {
        // "Pocket for {$0} Options";
        document.title = pkt.i18n.getMessagePlaceholder("options_title", ['Chrome']);
    }

    function init() {

        (function initLinks() {
            $('#logout-link').on('click', function() {
                // Logout the user from the web app and trigger logout of the
                // extension
                sendMessage({action: "openTab", url: "http://" + baseHost + "/lo", inBackground: false});

            });

            $('#login-link').on('click', function() {
                sendMessage({action: "showLoginWindow"});
            });

        }());

        pkt.i18n.initLocalization();
        initDocumentTitle();
        updateUI();

        checkForValidToken();
    }

    window.onload = init;


    /**
     * Message handling
     */
    addMessageListener(function(request, sender, response) {
        if (request.action === "updateOptions") {
            updateUI();
        }
    });

}());