/**
 * The authentication module
 */
var authentication = (function () {

    var afterLoginCallback;
    var loginRedirectUri;

    // If we are not able to show the login popup from the toolbar
    // we show a login window. This is especially important for Chrome as
    // in Safari we can trigger open the login popup but within Chrome that's
    // not possible
    var showLoginWindow = function(callback) {

        afterLoginCallback = callback;

        // Open a new window for the login signup page
        ril.getRequestToken({
            success: function(requestToken, redirectUri) {
                loginRedirectUri = redirectUri;
                window.open('https://getpocket.com/auth/authorize?request_token=' + requestToken + '&redirect_uri=' + redirectUri);
            }
        });
    };

    /**
     * If the login process was successfully this function needs to be
     * called to cleanup and further steps that are after login necesary
     * @param  {Function} loginSuccessCallback Callback after login cleanup was successfully
     */
    var onLoginSuccess = function(loginSuccessCallback) {
        // Search the extension login success window and close it
        getAllTabs(function(tabs) {
            tabs.forEach(function(tab) {
                var url = tab.url;
                if (url.indexOf(loginRedirectUri) !== -1) {
                    chrome.tabs.remove(tab.id, function() {});
                }
            });
        });

        // Send message to all tabs to update the option page
        // this will add the username to the options page if
        // it's one of the open tabs
        broadcastMessageToAllTabs({action: "updateOptions"});

        // If no afterLogin action declared try to save the actual
        // loaded page
        if (afterLoginCallback) {
            afterLoginCallback();
            afterLoginCallback = undefined;
        }

        if (loginSuccessCallback) { loginSuccessCallback(); }
    };

    /**
     * Handle messages related to authentifications
     */
    addMessageListener(function(request, sender, sendResponse) {

        if (request.action === "showLoginWindow") {
            showLoginWindow(undefined);

            sendResponse({});
            return false;
        }
        else if (request.action === "loginSuccessfull") {
            // Handle successfull login. This message is sent from the
            // login successfull page
            ril.login({
                success: function() {
                    // Handle login success
                    onLoginSuccess();
                },
                error: function() {
                    // TODO: Add error handling
                }
            });

            sendResponse({});
            return true;
        }
        else if (request.action === "logout") {
            // Logout the extension
            ril.logout();

            // Update options in case the option page is open
            broadcastMessageToAllTabs({action: "updateOptions"});

            sendResponse({});
            return false;
        }
    });

    return {
        showLoginWindow: showLoginWindow
    };
}());
