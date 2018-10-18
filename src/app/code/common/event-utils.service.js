import { module } from 'angular';
import * as _ from 'lodash';
import EventEmitter from 'wolfy87-eventemitter';

/* global EventEmitter */
export default module('shared', [])
    .service('ControllerUtils',
    function ($log, $timeout) {
        'ngInject';
        function alias (name) {
            return function aliasClosure () {
                return this[name].apply(this, arguments);
            };
        }

        function ControllerUtilsContainer () {
            this.eventListeners = {};
            this.timers = {};
            this.watchListeners = {};
        }

        ///////////////// EVENTS

        ControllerUtilsContainer.prototype.addListener = function (emitter, event, listener, id) {
            if (!id) {
                id = event;
            }
            if (this.eventListeners.hasOwnProperty(id)) {
                $log.debug('ControllerUtils::addListener - listener already added', id);
                return false;
            }
            this.eventListeners[id] = { emitter: emitter, event: event, listener: listener };

            if (emitter.on) {
                emitter.on(event, listener);
            } else if (emitter.addListener) {
                emitter.addListener(event, listener);
            } else if (emitter.addEventListener) {
                emitter.addEventListener(event, listener);
            }

            return true;
        };
        ControllerUtilsContainer.prototype.on = alias('addListener');

        ControllerUtilsContainer.prototype.addOnceListener = function (emitter, event, listener, id) {
            if (!id) {
                id = event;
            }
            if (this.eventListeners.hasOwnProperty(id)) {
                $log.debug('ControllerUtils::addOnceListener - listener already added', id);
                return false;
            }

            var _container = this;
            var onceListener = function () {
                _container.removeListener(id);
                listener.apply(this, arguments); //'this' here is function 'this'
            };
            this.eventListeners[id] = {
                emitter: emitter, event: event, listener: listener, onceListener: onceListener
            };
            emitter.once(event, onceListener);
            return true;
        };
        ControllerUtilsContainer.prototype.once = alias('addOnceListener');

        ControllerUtilsContainer.prototype.removeListener = function (id) {
            if (!this.eventListeners.hasOwnProperty(id)) {
                $log.debug('ControllerUtils::removeListener - listener not found', id);
                return false;
            }
            var listenerData = this.eventListeners[id];
            delete this.eventListeners[id];

            var listener = listenerData.onceListener || listenerData.listener;
            if (listenerData.emitter.off) {
                listenerData.emitter.off(listenerData.event, listener);
            } else if (listenerData.emitter.removeListener) {
                listenerData.emitter.removeListener(listenerData.event, listener);
            } else if (listenerData.emitter.removeEventListener) {
                listenerData.emitter.removeEventListener(listenerData.event, listener);
            }

            return true;
        };
        ControllerUtilsContainer.prototype.off = alias('removeListener');

        ///////////////// TIMERS

        ControllerUtilsContainer.prototype.timeout = function (id, fn, delay, invokeApply, Pass) {
            if (this.timers.hasOwnProperty(id)) {
                $log.debug('ControllerUtils::timeout - timer already added', id);
                return false;
            }
            var _container = this;
            this.timers[id] = $timeout(function () {
                delete _container.timers[id];
                fn.apply(this, arguments); //'this' here is function 'this'
            }, delay, invokeApply, Pass);
            return true;
        };

        ControllerUtilsContainer.prototype.cancel = function (id) {
            if (!this.timers.hasOwnProperty(id)) {
                return false;
            }
            $timeout.cancel(this.timers[id]);
            delete this.timers[id];
            return true;
        };

        ///////////////// WATCHERS

        ControllerUtilsContainer.prototype.watch = function (scope, watchExpression, listener, objectEquality, id) {
            if (!id) {
                id = watchExpression;
            }
            if (this.watchListeners.hasOwnProperty(id)) {
                $log.debug('ControllerUtils::watch - listener already added', id);
                return false;
            }
            this.watchListeners[id] = {
                scope: scope,
                watchExpression: watchExpression,
                listener: listener,
                unwatchFn: scope.$watch(watchExpression, listener, objectEquality)
            };
            return true;
        };

        ControllerUtilsContainer.prototype.unwatch = function (id) {
            if (!this.watchListeners.hasOwnProperty(id)) {
                $log.debug('ControllerUtils::unwatch - listener not found', id);
                return false;
            }
            var listenerData = this.watchListeners[id];
            delete this.watchListeners[id];
            if ((typeof listenerData.unwatchFn) === 'function') {
                listenerData.unwatchFn();
            }
            return true;
        };

        ///////////////// CLEANUP

        ControllerUtilsContainer.prototype.cleanup = function () {
            this.cleanupTimers();
            this.cleanupListeners();
            this.cleanupWatchers();
        };

        ControllerUtilsContainer.prototype.cleanupTimers = function () {
            _.forOwn(this.timers, function (timer) {
                $timeout.cancel(timer);
            });
            this.timers = {};
        };

        ControllerUtilsContainer.prototype.cleanupListeners = function () {
            _.forOwn(this.eventListeners, function (listenerData) {
                var listener = listenerData.onceListener || listenerData.listener;
                if (listenerData.emitter.off) {
                    listenerData.emitter.off(listenerData.event, listener);
                } else if (listenerData.emitter.removeListener) {
                    listenerData.emitter.removeListener(listenerData.event, listener);
                } else if (listenerData.emitter.removeEventListener) {
                    listenerData.emitter.removeEventListener(listenerData.event, listener);
                }
            });
            this.eventListeners = {};
        };

        ControllerUtilsContainer.prototype.cleanupWatchers = function () {
            _.forOwn(this.watchListeners, function (listenerData) {
                if ((typeof listenerData.unwatchFn) === 'function') {
                    listenerData.unwatchFn();
                }
            });
            this.watchListeners = {};
        };

        ///////////////// SERVICE

        function ControllerUtilsService () { }

        ControllerUtilsService.prototype.buildContainer = function () {
            return new ControllerUtilsContainer();
        };

        ControllerUtilsService.prototype.decorate = function (object, scope) {
            //CORE-2709 as a non standard feature Firefox adds "watch" &  "unwatch" on objects, we allow them to
            //be bypassed since they are non standard and should not be used anyway
            //https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Object/watch

            var bypassableProps = ['watch', 'unwatch'];

            //Check if there won't be any clash using a dummy
            var dummy = new ControllerUtilsContainer();
            var bOK = true;
            _.forOwn(dummy, function (value, key) {
                if (key in object) {
                    if (_.includes(bypassableProps, key)) {
                        $log.warn('Source object already has bypassable attribute → it will be overwritten/shadowed', key);
                    } else {
                        $log.error('Source object already has attribute', key);
                        bOK = false;
                    }
                }
            });
            //Check on the prototype also (even if previous failed, so that we know EVERYTHING wrong)
            _.forOwn(ControllerUtilsContainer.prototype, function (value, key) {
                if (key in object) {
                    if (_.includes(bypassableProps, key)) {
                        $log.warn('Source object already has bypassable attribute → it will be overwritten/shadowed', key);
                    } else {
                        $log.error('Source object already has attribute', key);
                        bOK = false;
                    }
                }
            });
            if (!bOK) {
                $log.error('Faulty object', object);
                return false;
            }

            // OK we can decorate
            ControllerUtilsContainer.apply(object);
            _.forOwn(ControllerUtilsContainer.prototype, function (value, key) {
                object[key] = value;
            });

            if (scope) {
                scope.$on('$destroy', object.cleanup.bind(object));
            }

            return true;
        };

        return new ControllerUtilsService();
    });
