/*
    Injected in the Pocket logout page to logout the user if the user logged
    out of the web app
 */

(function() {
    // Let the background know that the user successfully logged out
    sendMessage({action: "logout"}, function(response) {});
}());