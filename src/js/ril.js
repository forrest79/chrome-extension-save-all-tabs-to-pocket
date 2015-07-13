/*
 * Pocket API module
 */

var ril = (function() {

    var baseURL = "https://getpocket.com/v3";
    // var baseURL = "https://admin:s3krit@nick1.dev.readitlater.com/v3";

    /**
     * Auth keys for the API requests
     */
    var oAuthKey = "##CONSUMER_KEY##";

    /**
     * Helper method for api requests
     */
    function apiRequest(options) {
        var url = baseURL + options.path;
        var data = options.data || {};
        data.consumer_key = oAuthKey;
        $.ajax({
            url: url,
            type: "POST",
            headers: {
                "X-Accept" : "application/json"
            },
            data: data,
            dataType: "json",
            success: options.success,
            error: options.error
        });
    }

    /**
     * Check if a token is still valid or if the user refused the extension key
     */
    function isValidToken(callback) {
        apiRequest({
            path: "/oauth/is_valid_token",
            data: {
                access_token: getSetting("oauth_token")
            },
            success: function(data) {
                if (callback) { callback(true); }
            },
            error: function(xhr) {
                if (callback) { callback(false); }
            }
        });
    }


    /**
     * Interface
     */

    /**
     * Check if the user is authorized
     * @return {Boolean} Boolean if the user is logged in or not
     */
    function isAuthorized() {
        return (typeof getSetting("username") !== "undefined") &&
               (typeof getSetting("oauth_token") !== "undefined");
    }

    /**
     * If we logout we clean all settings we saved before
     */
    function logout() {
        // Clear user login information
        setSetting("username", undefined);
        setSetting("email", undefined);
        setSetting("firstName", undefined);
        setSetting("lastName", undefined);
        setSetting("oauth_token", undefined);

        // Clear legacy
        setSetting("password", undefined);
        setSetting("token", undefined); // Clean old token value

        // Clear heartbeat references
        setSetting("guid", undefined);
        setSetting("heartbeatTimestamp", undefined);
        setSetting("alreadyLoggedIn", undefined);

        setupHeartbeat(function(time) {
            setSetting("guid", undefined);
            setSetting("heartbeatTimestamp",undefined);
        });
    }

    /**
     * Login the user with cookie information we got from the login successfull
     * page
     * @param  {Object} info      Info object with userId and token for the user
     * @param  {Object} callbacks Optional object to get the successs or error
     *                            callback
     */
    function login(info, callbacks) {
        callbacks = callbacks || {};

        var self = this;

        apiRequest({
            path: '/oauth/authorize',
            data: {
                guid: getSetting('guid'),
                token: info.token,
                user_id: info.userId,
                account: "1",
                grant_type: "extension"
            },
            success: function(data) {

                var username = data["username"];
                var accessToken = data["access_token"];
                var account = data["account"];
                var email = account["email"];
                var firstName = account["first_name"] || "";
                var lastName = account["last_name"] || "";

                setSetting("username", username);
                setSetting("email", email);
                setSetting("firstName", firstName);
                setSetting("lastName", lastName);
                setSetting("oauth_token", accessToken);
                setSetting("token", undefined);

                if (callbacks.success) { callbacks.success(); }
            },
            error: function(data, textStatus, jqXHR) {
                console.log("Login Error:");
                console.log(data.error);

                if (callbacks.error) {
                    callbacks.error.apply(callbacks, Array.apply(null, arguments));
                }
            }
        });
    }

    /**
     * Add a new link to Pocket
     * @param {string} title   Title of the link
     * @param {string} url     URL of the link
     * @param {Object} options Object with success and error callbacks
     */
    function add(title, url, options) {
        var action = {
            action: "add",
            url: url,
            title: title
        };
        sendAction(action, options);
    }

    /**
     * General function to send all kinds of actions like adding of links or
     * removing of items via the API
     */
    function sendAction(action, options) {

        // Options can have an 'actionInfo' object. This actionInfo object
        // get passed through to the action object that we send to the API
        if (typeof options.actionInfo !== 'undefined') {
            action = $.extend(action, options.actionInfo);
        }

        apiRequest({
            path: "/send",
            data: {
                access_token: getSetting("oauth_token"),
                actions: JSON.stringify([action])
            },
            success: function(data) {
                if (options.success) options.success(data);
            },
            error: function(xhr) {
                if (xhr.status === 401) {
                    logout();
                }

                if (options.error) options.error(xhr.status, xhr);
            }
        });
    }

    /**
     * Setup heartbeat
     */
    function setupHeartbeat(callback) {
        var time = getSetting('heartbeatTimestamp');
        var now = Date.now();
        // time differential is just 10 to ensure we send it every time for testing, change to msInDay for later
        var msInDay = 86400 * 1000;
        if (typeof time == 'undefined' || ((now-time) > msInDay)) {
            var guid = getSetting('guid');
            if (typeof guid == 'undefined')
            {
                ril.getGuid(function(data)
                {
                    if (data.tests)
                    {
                        if (data.tests.extension_install_signup_v1)
                        {
                            setSetting("experimentVariant",data.tests.extension_install_signup_v1.option);
                        }
                    }
                    if (data.guid)
                    {
                        setSetting('guid',data.guid);
                        setupHeartbeat();
                    }
                    else 
                    {
                        setTimeout(setupHeartbeat,3600000);
                    }
                });
                return;
            }

            chrome.windows.getAll({populate:true},function(windows) {
                var tabcount = 0;
                for (var i = 0; i < windows.length; i++)
                {
                    tabcount += windows[i].tabs.length;
                }
                
                ril.sendHeartbeat(guid,tabcount,windows.length,function(success) {
                    if (success)
                    {
                        setSetting('heartbeatTimestamp',now);
                        if (callback)
                        {
                            callback(now);
                        }
                    }
                    else
                    {
                        setTimeout(setupHeartbeat,3600000);
                    }
                });
            });
        }
        else
        {
            // regardless of the scenario, for experiment purposes, check to see if guid exists, if not grab one
            var guid = getSetting('guid');
            if (typeof guid == 'undefined')
            {
                ril.getGuid(function(data)
                {
                    if (data.guid)
                    {
                        setSetting('guid',data.guid);
                    }
                    if (data.tests)
                    {
                        if (data.tests.extension_install_signup_v1)
                        {
                            setSetting("experimentVariant",data.tests.extension_install_signup_v1.option);
                        }
                    }
                });
            }
        }
    }

    /**
     * Send heartbeat detail
     * @param {string}   guid     user guid
     * @param {integer}  tabs     number of tabs open 
     * @param {integer}  windows  number of windows open
     * @param {function} callback return boolean on success status or not
     */
    function sendHeartbeat(guid,tabs,windows,callback) {
        if (typeof guid == 'undefined' || !guid)
        {
            if (callback)
            {
                callback(false);
            }
            return;
        }
        apiRequest({
            path: "/pv",
            data: {
                access_token: getSetting("oauth_token"),
                guid: guid,
                actions: JSON.stringify([{view: 'ext_heartbeat',cxt_t: tabs,cxt_w: windows}])
            },
            success: function(data) {
                if (callback) { 
                    callback(true); 
                }
            },
            error: function(xhr) {
                if (callback) { 
                    callback(false); 
                }
            }
        });
    }

    /**
     * Get user guid
     * @param {function} callback return guid, other data on success, false on not
     */
    function getGuid(callback) {
        apiRequest({
            path: "/guid",
            data: {
                abt: 1
            },
            success: function(data) {
                if (callback) { 
                    if (data.status) {
                        callback(data);
                    }
                    else {
                        callback(false); 
                    }
                }
            },
            error: function(xhr) {
                if (callback) { 
                    callback(false); 
                }
            }
        });
    }

    /**
     * Public functions
     */
    return {
        isAuthorized: isAuthorized,
        login: login,
        logout: logout,
        add: add,
        setupHeartbeat: setupHeartbeat,
        sendHeartbeat: sendHeartbeat,
        getGuid: getGuid,
        isValidToken: isValidToken
    };
}());
