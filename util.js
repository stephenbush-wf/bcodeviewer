$(function () {

    var zeroPad_vs, getRotation_vec, r, g, b;

    var Util = {

        /**
         * Return true if this page has a fullscreen element.
         *
         * @return {boolean}
         */
        isFullscreen: function () {
            return (
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement
            );
        },


        /**
         * Make an element fullscreen
         *
         * @param {Object} el - the element to become fullscreen
         */
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


        /**
         * un-fullscreen
         */
        cancelFullscreen: function () {
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


        /**
         * Pad a number with zeroes.
         *
         * @param {*} v - the number or string to pad
         * @param {Number} l - the desired length;
         * @return {String}
         */
        zeroPad: function (v, l) {
            zeroPad_vs = v.toString();
            while (zeroPad_vs.length < l) {
                zeroPad_vs = "0" + zeroPad_vs;
            }
            return zeroPad_vs;
        },


        /**
         * Convert a string to Title Case
         * @param {string} str - the string to titlecase
         * @returns {string}
         */
        titleCase: function (str) {
            return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
        },


        /**
         * Convert a possibly negative angle in radians to one
         * which is guaranteed positive.
         *
         * @param {Number} r - angle in radians
         * @returns {Number}
         */
        truncRadians: function (r) {
            while (r < 0) {
                r += Math.PI * 2;
            }
            return r;
        },


        /**
         * Get the angle in radians from one point to another.
         *
         * @param {Object} p1 - the 'from' point
         * @param {Object} p1 - the 'to' point
         * @returns {*|Number}
         */
        getRotation: function (p1, p2) {
            getRotation_vec = {x: p2.x - p1.x, y: p2.y - p1.y};
            return this.truncRadians(Math.atan2(getRotation_vec.y, getRotation_vec.x)); // - (Math.PI / 2));
        },


        /**
         * Converts a color from an integer to a css-friendly hex string.
         *
         * @param {Number} num - the integer color value
         * @returns {string}
         */
        toCSSColor: function (num) {
            num >>>= 0;
            b = num & 0xFF;
            g = (num & 0xFF00) >>> 8;
            r = (num & 0xFF0000) >>> 16;
            return '#' + this.zeroPad(r.toString(16), 2) + "" + this.zeroPad(g.toString(16), 2) + "" + this.zeroPad(b.toString(16), 2);
        },


        /**
         * Returns a color somewhere between green and red based on
         * a float value between 0 and 1
         *
         * @param {Number} value - must be between 0.0 and 1.0
         * @returns {Number}
         */
        getHealthColor: function (value) {
            var g = Math.floor(Math.min(255, value * 510));
            var r = Math.floor(Math.min(255, 510 - (value * 510)));
            return 256 * 256 * r + 256 * g;
        }
    };


    window.Util = Util;
});
