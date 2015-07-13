 /* globals ril, sendMessageToTab, broadcastMessageToAllTabs, executeScriptInTab, isValidURL, getAllTabs, addMessageListener, getSetting, setSetting, openTabWithURL, isGoogleReaderURL, executeScriptFromURLInTabWithCallback, isMac */
/* jslint vars: true */

var backgroundPage = (function () {

    /**
     * Module Variables
     */
    var saving = false;
    var saved = 0;
    var toSave = 0;
    var listenerReady = false;
    var messageWaiting = "";
    var delayedMessageData = {};

    /**
     * Helper methods
     */
    function getVersionNumber() {
        // Check if we can get it without any xhr request.
        // Works starting with Safari 6 and Chrome 13
        var versionNumber = chrome.app.getDetails().version;
        if (typeof versionNumber !== 'undefined') { return versionNumber; }

        // Seems like we are on an older browser try to get it from the settings files
        appSettingsPath = chrome.extension.getURL('manifest.json');

        // Synchronous request to get the settings file
        var xhr = new XMLHttpRequest();
        xhr.open('GET', appSettingsPath, false);
        xhr.send(null);

        // Extract version number. In Safari we get back an xml response in Chrome json.
        var manifestJSON = JSON.parse(xhr.responseText);
        versionNumber = manifestJSON.version;


        return versionNumber;
    }

    /**
     * Notifications
     */
    function loadNotificationUIIntoPage(tab, callback) {
        executeScriptInTabWithCallback(tab, 'window.___PKT__INJECTED;', function(results) {
            if (!results || typeof results[0] == 'object')
            {
                executeScriptFromURLInTab(tab, 'js/jquery-2.1.1.min.js');
                executeStyleFromURLInTab(tab, 'css/notification.css');
            }
        });

        // First insert localization for Pocket overlay
        executeScriptFromURLInTabWithCallback(tab, pkt.i18n.getFilePathForPocketOverlayLocalization(), function() {
            // Insert the Pocket overlay
            executeScriptFromURLInTabWithCallback(tab, 'js/r.js', callback);
        });
    }


    /**
     * Toolbar icon changes in Chrome
     */
    function showToolbarIcon(tabId, iconName) {
        // Change toolbar icon to new icon
        var smallIconPath = "../img/" + iconName + "-19.png";
        var bigIconPath = "../img/" + iconName + "-38.png";
        chrome.browserAction.setIcon({
            tabId: tabId,
            path: {
                "19": smallIconPath,
                "38": bigIconPath
            }
        });
    }

    function showSavedToolbarIcon(tabId) {
        showToolbarIcon(tabId, 'browser-action-icon-added');
    }

    function processSave(callback) {
        if (++saved === toSave) {
            saving = false;
            saved = 0;
            toSave = 0;

            if (callback) {
                callback();
            }

            return true;
        }

        return false;
    }


    /**
     * Handle API action call responses
     */
    function onSaveSuccess(tab) {
        if (!saving) {
            return;
        }

        var message = 'add';
        if (processSave(function() {showSavedToolbarIcon(tab.id);})) {
            message = 'success';
        }

        if (listenerReady) {
            messageWaiting = '';
            delayedMessageData = {};
            sendMessageToTab(tab, {status: message});
        }
        else {
            delayedMessageData = {
                tab: tab,
                status: message
            };
            messageWaiting = message;
        }
    }

    function onSaveError(tab, xhr) {
        if (!saving) {
            return;
        }

        processSave();

        // Handle error message
        var errorMessage = xhr.getResponseHeader("X-Error");
        if (errorMessage === null || typeof errorMessage === 'undefined') {
            errorMessage = pkt.i18n.getMessage("background_save_url_error_no_message");
        }
        else {
            errorMessage = pkt.i18n.getMessagePlaceholder("background_save_url_error_message", [errorMessage]);
        }
        if (listenerReady) {
            messageWaiting = '';
            delayedMessageData = {};
            sendMessageToTab(tab, { status: 'error', message: errorMessage });
        }
        else {
            delayedMessageData = {
                tab: tab,
                status: 'error',
                message: errorMessage
            };
            messageWaiting = 'error';
        }
    }

    /**
     * Listen to general messages
     */
    addMessageListener(function messageListenerCallback(request, sender, sendResponse) {
        if (request.action === "getSetting") {
            sendResponse({"value": getSetting(request.key)});
            return false;
        }
        else if (request.action === "setSetting") {
            setSetting(request.key, request.value);

            broadcastMessageToAllTabs({
                action:"settingChanged",
                key: request.key,
                value:request.value
            });

            sendResponse({});
            return false;
        }
        else if (request.action === "getDisplayUsername") {
            sendResponse({"value": getDisplayUsername()});
            return false;
        }
        else if (request.action === "isValidToken") {
            ril.isValidToken(function(isValid) {
                sendResponse({value: isValid});
            });
            return true;
        }
        else if (request.action === "openTab") {
            var inBackground = typeof request.inBackground !== "undefined" ? request.inBackground : true;
            openTabWithURL(request.url, inBackground);
            sendResponse({});
            return false;
        }
        else if (request.action === "listenerReady") {
            listenerReady = true;
            if ((messageWaiting == 'add') || messageWaiting == 'success') {
                messageWaiting = '';
                setTimeout(function() {
                    sendMessageToTab(delayedMessageData.tab,{status: delayedMessageData.status});

                    delayedMessageData = {};
                },50);
            }
            else if (messageWaiting == 'error') {
                messageWaiting = '';
                setTimeout(function() {
                    sendMessageToTab(delayedMessageData.tab,{status: delayedMessageData.status, message: delayedMessageData.message});
                    delayedMessageData = {};
                },50);
            }

            return true;
        }
    });


    /**
     * General method to save links to Pocket
     * @param  {Tab}    tab        The tab that shows the page we want to save to Pocket
     */
    var saveTabsToPocket = function(tab) {
        if (saving) {
            return;
        }

        saving = true;

        // Login before, if not authorized
        if (!ril.isAuthorized()) {
            authentication.showLoginWindow(function() {
                saveTabsToPocket(tab);
            });
            return;
        }

        // Load the notification UI in the page to show the overlay
        loadNotificationUIIntoPage(tab, function() {

            getAllTabs(function(tabs) {
                var processedTabs = [];
                tabs.forEach(function(item) {
                    var title = item.title;
                    var url = item.url;

                    // Check for valid url and skip bad urls
                    if (!isValidURL(url)) {
                        return true;
                    }

                    processedTabs.push({
                        title: title,
                        url: url
                    })
                });

                toSave = processedTabs.length;

                processedTabs.forEach(function(item) {
                    var title = item.title;
                    var url = item.url;

                    // Add the url to Pocket
                    ril.add(title, url, {
                        success: function() {
                            onSaveSuccess(tab);
                        },
                        error: function(status, xhr) {
                            onSaveError(tab, xhr);
                        }
                    });
                });
            });
        });
    };


    /**
     * Handles clicks on the browser action in Chrome and in Safari's
     * toolbar item
     */
    (function setupToolbarItems() {

        /**
         *  Handle the browser action that get's executed if the user pushes
         *  the toolbar icon in Chrome
         */
        chrome.browserAction.onClicked.addListener(function(tab) {
            // Try to save all tabs
            saveTabsToPocket(tab);

        });
    }());


    /**
     * Initialize the extension
     */
    (function initialize() {

        // Settings
        var appVersionNumber = getVersionNumber();

        // Check for first time installation and show an installed page
        if (!boolFromString(getSetting("installed"))) {
            setSetting("installed", "true");
        }

        // Update last installed version in setting
        setSetting("lastInstalledVersion", appVersionNumber);

    }());


    /**
     * Public Methods
     */
    return {
    };
})();
