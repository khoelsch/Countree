/*! Countree - v0.0.1 - 2013-02-04
* https://github.com/SaschaKrause/Countree
* Copyright (c) 2013 Sascha Krause; Licensed MIT */

// TODO: [FEATURE]  provide the possibility to register some kind of event listener to a countree which is called on custom events (e.g. "5 minutes before counter ends")
// TODO: [FEATURE]  be able to add the configOptions after instantiation (e.g. setOptions(options))
// TODO: [FEATURE]  get progress in % (e.g. 13% are already counted down/up)
// TODO: [FEATURE]  add AMD-loader ability
// TODO: [BUG]      when not displaying the milliseconds to the user, it seems like a bug that a second is "missing" (because of rounding issues)
// TODO: [TEST]     add some Jasmine tests
// TODO: [DEMO]     use a templating framework (e.g. handlebars) to demonstrate the power of the CountResult.getTimeObject()

(function (exports) {

    /**
     *
     * @param configOptions
     * @constructor
     */
    function Countree(configOptions) {


        /************************************
         Private properties
         ************************************/


        var that = this;

        var countDirection = {
            DOWN: 'down',
            UP: 'up'
        };


        /**
         * The interval reference is used to identify the active interval, so that it could be cleared (e.g. for suspending
         * or restarting).
         * A counter can only have one interval reference (because a single counter can only create a single interval).
         * @type {Number}
         */
        var intervalRef;

        /**
         * The milliseconds left/to go (depends if counting up or down) to count from/to when resuming the counter after
         * it is suspended.
         * @type {Number}
         */
        var millisecondsForContinuePoint = 0;

        /**
         *
         */
        var intervalCallbackRef;

        /************************************
         Public properties
         ************************************/


        this.version = '0.0.1';

        // fill options with defaults
        // furthermore, this gives an overview of the available (and settable) user configurable options.
        this.options = {
            milliseconds: 0,
            seconds: 0,
            minutes: 0,
            hours: 0,
            days: 0,
            updateIntervalInMilliseconds: 1000,
            direction: countDirection.UP
        };

        // this countResult instance contain all information about the current counter values (e.g. milliseconds left/to go).
        // This result will be provided as parameter to the users callback (@see start(callback))
        this.countResult = new CountResult();

        /**
         * Indicates if the counter is currently active by counting down or up.
         * @type {Boolean}
         */
        this.isCounting = false;

        // update/extend the default options with the user config options
        extendObjectBy(this.options, configOptions);


        function onCountingInterval(callback, countStartDate, totalMillisecondsToGo, resumed) {
            //directly update the countResult BEFORE the interval starts (so that the users callback is invoked immediately)
            updateCounterBeforeIntervalStart(totalMillisecondsToGo, callback);

            var timeToAddWhenResumed = resumed ? millisecondsForContinuePoint : 0;

            var calculateMilliseconds = function () {
                // when counting down
                if (that.options.direction === countDirection.DOWN) {
                    millisecondsForContinuePoint = totalMillisecondsToGo - (new Date().getTime() - countStartDate.getTime());
                }
                //when counting up
                else if (that.options.direction === countDirection.UP) {
                    millisecondsForContinuePoint = (new Date().getTime() + timeToAddWhenResumed) - countStartDate.getTime();
                }

                // update the result and forward it to the users callback as a countResult object
                that.countResult.update(millisecondsForContinuePoint);
                callback(that.countResult);

                // need to check if the counter is done with counting
                checkIfCounterFinished(millisecondsForContinuePoint, getTotalMillisecondsToGoFromConfig(), callback);
            };

            return setInterval(calculateMilliseconds, that.options.updateIntervalInMilliseconds);
        }

        /**
         * Before the interval starts counting, the result should be forwarded to the callback with its initial value
         * @param totalMillisecondsToGo
         * @param callback
         */
        function updateCounterBeforeIntervalStart(totalMillisecondsToGo, callback) {
            // when counting down
            if (that.options.direction === countDirection.DOWN) {
                that.countResult.update(totalMillisecondsToGo);
            }
            //when counting up
            else if (that.options.direction === countDirection.UP) {
                that.countResult.update(0);
            }

            callback(that.countResult);
        }


        function getTotalMillisecondsToGoFromConfig() {

            return that.options.milliseconds +
                (that.options.seconds * 1e3) + // 1000
                (that.options.minutes * 6e4) + // 1000 * 60
                (that.options.hours * 36e5) + // 1000 * 60 * 60
                (that.options.days * 864e5);  // 1000 * 60 * 60 * 24
        }

        function checkIfCounterFinished(millisecondsProceeded, totalMillisecondsToGo, callback) {
            if (that.options.direction === countDirection.UP) {
                if (millisecondsProceeded >= totalMillisecondsToGo) {
//                    console.log("--FERTIG MITHOCHZÄHLEN");
                    clearIntervalFromCountree();
                }
            }
            else if (that.options.direction === countDirection.DOWN) {
                if (millisecondsProceeded <= 0) {
                    that.countResult.update(0);
//                callback(that.countResult);
//                    console.log("--FERTIG MITRUNTERZÄHLEN");
                    clearIntervalFromCountree();
                }
            }
        }

        function clearIntervalFromCountree() {
            clearInterval(intervalRef);
        }


        function start(callback) {
            //remember the users callback to be able to continue the counter without providing the callback again later (on resume())
            intervalCallbackRef = callback;

            // clear the interval if there is one (so that a "clean restart" is possible)
            if (intervalRef) {
                clearInterval(intervalRef);
            }


            // start the counter and remember the intervalId as reference for later (e.g. for restarting or suspending)
            intervalRef = onCountingInterval(intervalCallbackRef, new Date(), getTotalMillisecondsToGoFromConfig(), false);
            that.isCounting = true;
        }

        function suspend() {
            // clear the interval as it stops the further counting
            clearIntervalFromCountree();
            that.isCounting = false;
        }

        function resume() {
            // only continue counting if the counter isn't already active and the users callback is available
            if (!that.isCounting && intervalCallbackRef) {
                intervalRef = onCountingInterval(intervalCallbackRef, new Date(), millisecondsForContinuePoint, true);
                that.isCounting = true;
            }
        }

        /************************************
         Public Methods
         ************************************/
        this.start = start;
        this.suspend = suspend;
        this.resume = resume;
    }

    /**
     *
     * @constructor
     */
    function CountResult() {

        this.overallMillisecondsLeft = 0;

        // the timeObject contains the milliseconds left (or to go) in a formatted object. So one could do something like
        // this: countResult.getAsTimeObject().minutes
        this.timeObject = new TimeObject();

        this.update = function (milliseconds) {
            this.overallMillisecondsLeft = milliseconds;
            return this.overallMillisecondsLeft;
        };

        this.getAsTimeObject = function () {
            // update the timeObject and return its new value
            return this.timeObject.update(this.overallMillisecondsLeft);
        };
    }


    /**
     * should rename this to something more precise.
     * Because there should only be one instance of this object, it is ok to add its methods via constructor (and not via
     * prototype).
     * @constructor
     */
    function TimeObject() {

        this.milliseconds = 0;
        this.seconds = 0;
        this.minutes = 0;
        this.hours = 0;
        this.days = 0;

        /**
         * Update the time object by recalculating its properties out of the provided milliseconds.
         * @param milliseconds
         */
        this.update = function (milliseconds) {
            if (milliseconds > 0) {
                var count = milliseconds;
                this.milliseconds = parseInt(milliseconds.toString().substr(-3), 10);
                count = Math.floor(count / 1000);
                this.seconds = count % 60;
                count = Math.floor(count / 60);
                this.minutes = count % 60;
                count = Math.floor(count / 60);
                this.hours = count % 24;
                count = Math.floor(count / 24);
                this.days = count;
            }

            return this;
        };

        this.getMillisecondsAsTripleDigitString = function() {
            return fillLeftZero(this.milliseconds, 3);
        };

        this.getSecondsAsDoubleDigitString = function() {
            return fillLeftZero(this.seconds, 2);
        };

        this.getMinutesAsDoubleDigitString = function() {
            return fillLeftZero(this.minutes, 2);
        };

        this.getHoursAsDoubleDigitString = function() {
            return fillLeftZero(this.hours, 2);
        };

        this.toString = function () {
            return this.days + " days,  " + this.getHoursAsDoubleDigitString() + ":" + this.getMinutesAsDoubleDigitString() + ":" + this.getSecondsAsDoubleDigitString() + ":" + this.getMillisecondsAsTripleDigitString();
        };
    }


    /************************************
     Helpers
     ************************************/

    function extendObjectBy(a, b) {
        for (var i in b) {
            if (b.hasOwnProperty(i)) {
                a[i] = b[i];
            }
        }
        return a;
    }

    function fillLeftZero(target, targetLength) {
        var result = '' + target;

        while (result.length < targetLength) {
            result = '0' + result;
        }
        return result;
    }

    /************************************
     Exports
     ************************************/

    exports.Countree = Countree;
    exports.CountResult = CountResult;
    exports.TimeObject = TimeObject;

}(typeof exports === 'object' && exports || window));