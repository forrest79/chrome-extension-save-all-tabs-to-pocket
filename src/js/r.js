//try{
if (window.thePKT_BM) {
    window.thePKT_BM.save();
}
else {

    /*
    PKT_BM_OVERLAY is the view itself and contains all of the methods to manipute the overlay and messaging.
    It does not contain any logic for saving or communication with the extension or server.
    */
    var PKT_BM_OVERLAY = function () {
        var self = this;

        this.inited = false;
        this.active = false;
        this.delayedStateSaved = false;
        this.wrapper = null;
        this.preventCloseTimerCancel = false;
        // TODO: populate this with actual translations
        this.translations = {};
        this.translations.add = pkt.r_i18n.add || 'Saving tabs...';
        this.translations.success = pkt.r_i18n.success || 'Complete';
        this.translations.error = pkt.r_i18n.error || '...but not all tabs were saved';
        this.translations.close = pkt.r_i18n.close || 'close';
        this.closeValid = true;
        this.autocloseTimer = null;
        // TODO: allow the timer to be editable?
        this.autocloseTiming = 4000;
        this.initCloseWindowInput = function() {
            self.wrapper.find('.pkt_ext_close').click(function(e) {
                e.preventDefault();
                self.closePopup();
            });
        };
        this.initAutoCloseEvents = function() {
            this.wrapper.on('click',function(e) {
                self.closeValid = false;
            });
        };
        this.startCloseTimer = function(manualtime) {
            var settime = manualtime ? manualtime : self.autocloseTiming;
            if (typeof self.autocloseTimer == 'number') {
                clearTimeout(self.autocloseTimer);
            }
            self.autocloseTimer = setTimeout(function() {
                if (self.closeValid || self.preventCloseTimerCancel) {
                    $('.pkt_ext_container').addClass('pkt_ext_container_inactive');
                    self.preventCloseTimerCancel = false;
                }
            }, settime);
        };
        this.stopCloseTimer = function() {
            if (self.preventCloseTimerCancel) {
                return;
            }
            clearTimeout(self.autocloseTimer);
        };
        this.showStateAdd = function() {
            this.wrapper.removeClass('pkt_ext_container_inactive');
            this.wrapper.find('.pkt_title').text(self.translations.add);
        };
        this.showStateSuccess = function() {
            this.wrapper.removeClass('pkt_ext_container_inactive');
            this.wrapper.find('.pkt_title').text(self.translations.success);
            self.startCloseTimer();
        };
        this.showStateError = function() {
            this.wrapper.find('.pkt_ext_error_msg').text(self.translations.error);
        };
        this.closePopup = function() {
            self.stopCloseTimer();
            this.wrapper.addClass('pkt_ext_container_inactive');
            this.wrapper.find('.pkt_ext_error_msg').text();
        };
    };

    PKT_BM_OVERLAY.prototype = {
        create : function() {
            if (this.active)
            {
                return;
            }
            this.active = true;
            var self = this;

            // kill any running timers
            self.preventCloseTimerCancel = false;
            self.stopCloseTimer();
            self.closeValid = true;

            var bodys = document.getElementsByTagName('body');
            var body = bodys ? bodys[0] : false;

            if (!body) {
                body = document.documentElement;
            }
            if (!this.inited) {
                this.inited = true;
                // add page saved element
                var container;

                var containerbaseclass = 'pkt_ext_container';
                if (supportsFlexbox()) {
                    containerbaseclass = 'pkt_ext_container pkt_ext_container_flexbox';
                }
                container = document.createElement('div');

                container.className = containerbaseclass;
                container.setAttribute('aria-live','polite');
                var extcontainerdetail = '\
                <div class="pkt_ext_initload">\
                    <span title="' + self.translations.close + '" class="pkt_ext_close" href="#">×</span>\
                    <div class="pkt_title"></div>\
                    <small class="pkt_ext_error_msg"></small>\
                </div>';
                container.innerHTML = extcontainerdetail;
                body.appendChild(container);
                self.wrapper = $('.pkt_ext_container');
                self.initCloseWindowInput();
                self.initAutoCloseEvents();

                // set page saved to active
                setTimeout(function()
                {
                    self.active = false;
                    if (self.delayedStateSaved) {
                        self.delayedStateSaved = false;
                    }
                }, 10);
            }
            else {
                self.active = false;
                if (self.delayedStateSaved) {
                    self.delayedStateSaved = false;
                }
            }

            function supportsFlexbox() {
                function DetectDisplayValue(val) {
                    // detect CSS display:val support in JavaScript
                    // 
                    var detector = document.createElement("detect");
                    detector.style.display = val;
                    return (detector.style.display === val);
                }
                return (DetectDisplayValue('flex') || DetectDisplayValue('-webkit-flex'));
            }
        }
    };


    // Layer between Bookmarklet and Extensions
    var PKT_BM = function () {};

    PKT_BM.prototype = {
        init: function () {
            if (this.inited) {
                return;
            }
            this.overlay = new PKT_BM_OVERLAY();

            this.inited = true;
            this.requestListener = undefined;
        },

        addMessageListener: function (listener) {
            // Remove event listener if one is currently registered
            if (this.requestListener !== undefined) {
                this.removeMessageListener();
            }

            // Add request listener
            this.requestListener = listener;
            chrome.extension.onMessage.addListener(listener);
        },

        removeMessageListener: function () {
            chrome.extension.onMessage.removeListener(this.requestListener);
            this.requestListener = undefined;
        },

        sendMessage: function (message, cb) {
            if (window.chrome.extension.sendMessage) {
                window.chrome.extension.sendMessage(message, cb);
            } else {
                window.chrome.extension.sendRequest(message, cb);
            }
        },

        handleMessageResponse: function(response) {
            if (response.status == "add") {
                this.overlay.showStateAdd();
            }
            else if (response.status == "success") {
                this.overlay.showStateSuccess();
            }
            else if (response.status == "error") {
                this.overlay.showStateError(response.message);
            }
        },

        save: function() {
            this.overlay.create();

            this.addMessageListener(function(request, sender, response) {
                this.handleMessageResponse(request);
            }.bind(this));
                thePKT_BM.sendMessage({action: "listenerReady"}, function (response) {
            });
        }
    };

    // make sure the page has fully loaded before trying anything
    $(document).ready(function() {
        if(!window.thePKT_BM){
            var thePKT_BM = new PKT_BM();
            window.thePKT_BM = thePKT_BM;
            thePKT_BM.init();
        }

        window.thePKT_BM.save();
    });
}
void(0);
//}catch(e){alert(e);}
