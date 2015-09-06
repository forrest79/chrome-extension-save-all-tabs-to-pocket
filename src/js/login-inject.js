/*
    Injected in the Pocket login successfull page to get the user credentials
    from the cookie we need to login the user into the extension
 */

(function() {

    // Wait a second and send the login successfull page
    setTimeout(function() {
        // Let the background know that the user successfully logged in
        sendMessage({action: "loginSuccessfull"}, function(response) {});
    }, 500);

}());
