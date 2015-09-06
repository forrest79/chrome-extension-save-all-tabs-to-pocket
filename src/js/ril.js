/*
 * Pocket API module
 */

var ril = (function() {

    var baseURL = "https://getpocket.com/v3";

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
        setSetting("oauth_token", undefined);

        // Clear legacy
        setSetting("token", undefined); // Clean old token value
    }

    function getRequestToken(callbacks) {
        callbacks = callbacks || {};

        var redirectUri = '/extension-savealltabs-login-success';

        apiRequest({
            path: '/oauth/request ',
            data: {
                redirect_uri: redirectUri
            },
            success: function(data) {

                var code = data["code"];
                setSetting("token", code);

                if (callbacks.success) { callbacks.success(code, redirectUri); }
            },
            error: function(data, textStatus, jqXHR) {
                console.log("Get request token Error:");
                console.log(data.error);

                if (callbacks.error) {
                    callbacks.error.apply(callbacks, Array.apply(null, arguments));
                }
            }
        });
    }

    /**
     * Login the user with cookie information we got from the login successfull
     * page
     * @param  {Object} info      Info object with userId and token for the user
     * @param  {Object} callbacks Optional object to get the successs or error
     *                            callback
     */
    function login(callbacks) {
        callbacks = callbacks || {};

        apiRequest({
            path: '/oauth/authorize',
            data: {
                code: getSetting('token')
            },
            success: function(data) {

                var accessToken = data["access_token"];
                var username = data["username"];

                setSetting("username", username);
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
        apiRequest({
            path: "/add",
            data: {
                url: action.url,
                title: action.title,
                access_token: getSetting("oauth_token")
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
     * Public functions
     */
    return {
        isAuthorized: isAuthorized,
        getRequestToken: getRequestToken,
        login: login,
        logout: logout,
        add: add,
        isValidToken: isValidToken
    };
}());
