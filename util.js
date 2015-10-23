$(function () {

    var zeroPad_vs, getRotation_vec, r, g, b;
    var Util = {

        isFullscreen: function () {
            return (
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement
            );
        },

        makeFullscreen: function (el) {
            if (el.jquery) {
                el = el.get(0);
            }
            if (el.requestFullscreen) {
                el.requestFullscreen();
            } else if (el.webkitRequestFullscreen) {
                el.webkitRequestFullscreen();
            } else if (el.mozRequestFullScreen) {
                el.mozRequestFullScreen();
            } else if (el.msRequestFullscreen) {
                el.msRequestFullscreen();
            }
        },

        cancelFullscreen: function () {

            // exit full-screen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }

        },
        zeroPad: function (v, s) {
            zeroPad_vs = v.toString();
            while (zeroPad_vs.length < s) {
                zeroPad_vs = "0" + zeroPad_vs;
            }
            return zeroPad_vs;
        },


        titleCase: function (str) {
            return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
        },

        truncRadians: function (r) {
            while (r < 0) {
                r += Math.PI * 2;
            }
            return r;
        },

        getRotation: function (p1, p2) {
            getRotation_vec = {x: p2.x - p1.x, y: p2.y - p1.y};
            return this.truncRadians(Math.atan2(getRotation_vec.y, getRotation_vec.x)); // - (Math.PI / 2));
        },

        toCSSColor: function (num) {
            num >>>= 0;
            b = num & 0xFF;
            g = (num & 0xFF00) >>> 8;
            r = (num & 0xFF0000) >>> 16;
            return '#' + this.zeroPad(r.toString(16), 2) + "" + this.zeroPad(g.toString(16), 2) + "" + this.zeroPad(b.toString(16), 2);
        }
    };

    window.Util = Util;
});


/**
 *
 * jquery.binarytransport.js
 *
 * @description. jQuery ajax transport for making binary data type requests.
 * @version 1.0
 * @author Henry Algus <henryalgus@gmail.com>
 *
 */

(function($, undefined) {
    "use strict";

    // use this transport for "binary" data type
    $.ajaxTransport("+binary", function(options, originalOptions, jqXHR) {
        // check for conditions and support for blob / arraybuffer response type
        if (window.FormData && ((options.dataType && (options.dataType == 'binary')) || (options.data && ((window.ArrayBuffer && options.data instanceof ArrayBuffer) || (window.Blob && options.data instanceof Blob))))) {
            return {
                // create new XMLHttpRequest
                send: function(headers, callback) {
                    // setup all variables
                    var xhr = new XMLHttpRequest(),
                        url = options.url,
                        type = options.type,
                        async = options.async || true,
                    // blob or arraybuffer. Default is blob
                        dataType = options.responseType || "blob",
                        data = options.data || null,
                        username = options.username || null,
                        password = options.password || null;

                    xhr.addEventListener('load', function() {
                        var data = {};
                        data[options.dataType] = xhr.response;
                        // make callback and send data
                        callback(xhr.status, xhr.statusText, data, xhr.getAllResponseHeaders());
                    });

                    xhr.open(type, url, async, username, password);

                    // setup custom headers
                    for (var i in headers) {
                        xhr.setRequestHeader(i, headers[i]);
                    }

                    xhr.responseType = dataType;
                    xhr.send(data);
                },
                abort: function() {}
            };
        }
    });
})(window.jQuery);