// Shared and Utility functions between all browser extensions. Injected in
// any site and used by the background page

// Utility functions
function isValidURL(s) {
	return (/^https?\:/i).test(s);
}


// User

function getDisplayUsername() {
	var username = getSetting("username");
	if (typeof username !== "undefined" && username.length > 0 && username.charAt(0) !== "*") {
		return username;
	}

	var email = getSetting("email");
	if (typeof email !== "undefined" && email !== "") {
		return email;
	}

	return "Pocket User";
}

// Localization

/**
 * Supported Language Code
 * @return {string} Supported language code
 */
var getCurrentLanguageCode = function() {
    var language = navigator.language;
    language = (typeof language !== "undefined" ? language.toLowerCase() : 'en');

    if (language.indexOf('en') === 0) return 'en'; // English
    if (language.indexOf('de') === 0) return 'de'; // German
    if (language.indexOf('fr') === 0) return 'fr'; // French
    if (language.indexOf('it') === 0) return 'it'; // Italian
    if (language.indexOf('es_419') === 0) return 'es_419'; // Spanish (Latin America and Caribbean)
    if (language.indexOf('es') === 0) return 'es'; // Spanish
    if (language.indexOf('ja') === 0) return 'ja'; // Japanese
    if (language.indexOf('ru') === 0) return 'ru'; // Russian
    if (language.indexOf('ko') === 0) return 'ko'; // Korean
    if (language.indexOf('nl') === 0) return 'nl'; // Dutch
    if (language.indexOf('pl') === 0) return 'pl'; // Polish
    if (language.indexOf('pt_BR') === 0) return 'pt_BR'; // Portuguese Brazil
    if (language.indexOf('pt_PT') === 0) return 'pt_PT'; // Portuguese Portugal
    if (language.indexOf('zh_CN') === 0) return 'zh_CN'; // Chinese Simplified
    if (language.indexOf('zh_TW') === 0) return 'zh_TW'; // Chinese Traditional
    return 'en'; // Default is English
};


// Abstract browser specific funtionality

function getAllTabs(cb) {
	chrome.tabs.query({}, cb);
}

function executeScriptInTabWithCallback(tab, script, callback) {
	chrome.tabs.executeScript(tab.id, {code: script}, callback);
}

function executeScriptFromURLInTab(tab, scriptURL) {
	chrome.tabs.executeScript(tab.id, {file: scriptURL});
}

function executeScriptFromURLInTabWithCallback(tab, scriptURL, callback) {
	chrome.tabs.executeScript(tab.id, {file: scriptURL}, callback);
}

function executeStyleFromURLInTab(tab, scriptURL) {
	chrome.tabs.insertCSS(tab.id, {file: scriptURL});
}

function broadcastMessageToAllTabs(msg) {
    getAllTabs(function(tabs) {
		for (var i = 0; i < tabs.length; i++) {
			var tab = tabs[i];
			sendMessageToTab(tab, msg);
		}
    });
}

function openTabWithURL(url, inBackground) {
	// Be sure we have a value for background
	if (typeof inBackground === 'undefined') { inBackground = false; }

	chrome.tabs.create({url: url, active: !inBackground});
}


// Settings

// Helper methods because localStorage can't save bools -.-
function boolFromString(str) {
	if (typeof str === "string") {
		if (str === "false") { return false; }
		return true;
	}

	// If the expected str is already a bool just return the bool
	// E.g. Safari settings returns bool
	return str;
}

function getSetting(key) {
	return settingContainerForKey(key)[key];
}

function setSetting(key, value) {
	var location = settingContainerForKey(key);
	if (!value && location == localStorage) {
		localStorage.removeItem(key);
	} else {
		location[key] = value;
	}
}

function settingContainerForKey(key) {
	return localStorage;
}


// Message Handling

function addMessageListener(handler) {
	if (window.chrome.extension.onMessage) {
		chrome.extension.onMessage.addListener(handler);
		return;
	}

	chrome.extension.onRequest.addListener(handler);
}

// Message from the global page to a specific tab
function sendMessageToTab(tab, message) {
	chrome.tabs.sendMessage(tab.id, message);
}

// Message from an injected script to the background
function sendMessage(message, cb) {
	// Prevent errors for sending message responses if there is no callback given
	if (!cb) { cb = function(resp) {}; }

	// Send the message
	if (chrome.extension.sendMessage) {
		chrome.extension.sendMessage(message, cb);
	} else {
		chrome.extension.sendRequest(message, cb);
	}
}
