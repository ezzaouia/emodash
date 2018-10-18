import { module } from 'angular';

import EventEmitter from 'wolfy87-eventemitter';

export default module('app.feedback.helpers', [])
    .factory('FeedbackReports', [
        function() {
            function FeedbackReports() {}

            FeedbackReports.prototype.getForEdit = function(params) {
                return {};
            };

            FeedbackReports.prototype.$update = function(params) {
                return {};
            };

            return new FeedbackReports();
        },
    ])
    .service('Constants', function() {
        return {
            session_marker_type: { POSITIVE: '', NEGATIVE: 'NEGATIVE' },
            session_nb_markers_selected_max: 10,
            marker: {
                default_length_sec: 10,
            },
        };
    })
    .factory('NotificationService', function($rootScope, $timeout, $mdDialog, $log) {
        function NotificationService() {
            EventEmitter.call(this); // call super constructor

            this.m_progressStart = null;
            this.m_bProgress = false;
            this.m_aProgress = [];
            this.m_aNotificationBubbles = [];
            $rootScope.NotificationService_bInProgress = false;
        }

        // Inheritance from EventEmitter
        NotificationService.prototype = Object.create(EventEmitter.prototype);
        NotificationService.prototype.constructor = NotificationService;

        NotificationService.prototype.startProgress = function(id) {
            if (!this.m_aProgress.hasOwnProperty(id)) {
                this.m_aProgress[id] = { count: 0 };
            }
            var _progress = this.m_aProgress[id];
            _progress.count++;

            if (!this.m_progressStart) {
                this.m_progressStart = Date.now();
                $timeout(function() {
                    $rootScope.NotificationService_bInProgress = true;
                });
            }
        };

        NotificationService.prototype.stopProgress = function(id) {
            if (!this.m_aProgress.hasOwnProperty(id)) {
                return;
            }

            var _progress = this.m_aProgress[id];
            _progress.count--;

            if (_progress.count <= 0) {
                delete this.m_aProgress[id];
            }

            this._computeInProgress(id, 'ok');
        };

        //If called without message, messageID will be translated
        NotificationService.prototype.stopProgressOK = function(id, messageID, message) {
            if (!this.m_aProgress.hasOwnProperty(id)) {
                return;
            }

            var _progress = this.m_aProgress[id];
            _progress.count--;

            if (_progress.count <= 0) {
                delete this.m_aProgress[id];
            }

            this.emit('progress-message', {
                type: 'OK',
                messageID: messageID,
                message: message,
                progressID: id,
            });
            this._computeInProgress(id, 'ok');
        };

        //If called without message, messageID will be translated
        NotificationService.prototype.stopProgressError = function(id, messageID, message) {
            if (!this.m_aProgress.hasOwnProperty(id)) {
                return;
            }

            var _progress = this.m_aProgress[id];
            _progress.count--;

            if (_progress.count <= 0) {
                delete this.m_aProgress[id];
            }

            this.emit('progress-message', {
                type: 'ERROR',
                messageID: messageID,
                message: message,
                progressID: id,
            });
            this._computeInProgress(id, 'error');
        };

        //If called without message, messageID will be translated
        //duration is facultative
        NotificationService.prototype.showNormalOK = function(messageID, message, duration) {
            this.emit('normal-message', {
                type: 'OK',
                messageID: messageID,
                message: message,
                duration: duration,
            });
        };

        //If called without message, messageID will be translated
        //duration is facultative
        NotificationService.prototype.showNormalError = function(messageID, message, duration) {
            this.emit('normal-message', {
                type: 'ERROR',
                messageID: messageID,
                message: message,
                duration: duration,
            });
        };

        //If called without message, messageID will be translated
        NotificationService.prototype.showClosableOK = function(messageID, message) {
            this.emit('closable-message', { type: 'OK', messageID: messageID, message: message });
        };

        //If called without message, messageID will be translated
        NotificationService.prototype.showClosableError = function(messageID, message) {
            this.emit('closable-message', {
                type: 'ERROR',
                messageID: messageID,
                message: message,
            });
        };

        NotificationService.prototype._computeInProgress = function(id, status) {
            var bShouldBeInProgress = _.find(this.m_aProgress, function(_progress) {
                return _progress.count > 0;
            })
                ? true
                : false;
            var bInProgress = this.m_progressStart ? true : false;
            if (bShouldBeInProgress !== bInProgress) {
                if (!bShouldBeInProgress) {
                    delete this.m_progressStart;
                } else {
                    this.m_progressStart = Date.now();
                }
                $timeout(function() {
                    $rootScope.NotificationService_bInProgress = bShouldBeInProgress;
                });
            }
        };

        NotificationService.prototype.getNotificationBubbles = function() {
            return this.m_aNotificationBubbles;
        };

        NotificationService.prototype.addNotificationBubble = function(data, metadata, priority) {
            var bubble = {
                data: data,
                metadata: metadata,
                priority: _.concat([], priority, Date.now()), // This works both if priority is a single value or an array
            };
            // Since we JUST created the bubble, we know it will be AFTER all bubbles of the same priority value
            // So we simply have to insert the bubble AT the index where we find a HIGHER priority value that ours
            var nbPriorities = bubble.priority.length;
            var insertIndex = _.findIndex(this.m_aNotificationBubbles, function(otherBubble) {
                for (var iPriority = 0; iPriority < nbPriorities; iPriority++) {
                    //We use a for loop to exit ASAP
                    var _priority = bubble.priority[iPriority];
                    var _otherPriority = otherBubble.priority[iPriority];
                    if (_priority < _otherPriority) {
                        return true; // We have a lower priority value, we have to be inserted here
                    } else if (_priority > _otherPriority) {
                        return false; // We have a higher priority value, we carry on
                    } else {
                        //Identical priorities, we continue the comparison IF we can
                        if (iPriority === 0 && nbPriorities !== otherBubble.priority.length) {
                            $log.warn("Notification bubbles don't have the same priority length", {
                                newBubble: bubble.priority,
                                otherBubble: otherBubble.priority,
                            });
                            return false; // In this case, we don't want to compare things with different meaning, so we'll be inserted after (potentially)
                        }
                        //else, keep looping on priorities and (eventually) next bubble
                    }
                }
            });

            if (insertIndex === -1) {
                insertIndex = this.m_aNotificationBubbles.length;
                this.m_aNotificationBubbles.push(bubble);
            } else {
                this.m_aNotificationBubbles.splice(insertIndex, 0, bubble);
            }
            this.emit('bubble-added', { index: insertIndex, element: bubble });
            $log.debug('Added notification bubble', { index: insertIndex, element: bubble });
        };

        NotificationService.prototype.removeNotificationBubbles = function(metadataFilter) {
            var isProperMetadata = _.matches(metadataFilter);
            var removedBubbles = [];
            _.remove(this.m_aNotificationBubbles, function(bubble, index) {
                if (isProperMetadata(bubble.metadata)) {
                    removedBubbles.push({
                        element: bubble,
                        index: index,
                    });
                    return true;
                } else {
                    return false;
                }
            });
            if (removedBubbles.length) {
                this.emit('bubbles-removed', { elements: removedBubbles });
                $log.debug('Removed notification bubble(s)', { elements: removedBubbles });
            }
        };

        NotificationService.prototype.bubbleButtonTypes = Object.freeze({
            NAVIGATION: 'navigation',
            SCROLL: 'scroll',
        });

        //We are not a just a "factory" (pattern-wise), we are a real service wo we instantiate our singleton
        return new NotificationService();
    });
