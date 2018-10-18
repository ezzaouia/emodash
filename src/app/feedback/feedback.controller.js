import { module } from 'angular';

export default module('app.feedback.ctr', [])
    .filter('secondsdisplay', [
        function () {
            return function (input) {
                var minutes = Math.floor(input / 60);
                var seconds = input % 60;
                //TODO: localize timer display ??
                return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
            };
        },
    ])
    .controller('FeedbackReportEditController', function (
        $scope,
        FeedbackReports,
        // FeedbackReportFields,
        FeedbackReportMarker,
        $stateParams,
        $log,
        Constants,
        $anchorScroll,
        $location,
        $state,
        // $modal,
        EmodashDataService,
        NotificationService,
        $mdDialog,
        ControllerUtils,
        $rootScope,
        $window,
        $timeout,
    ) {
        $scope.nbSelectedMarkers = 0;
        $scope.nbMarkersMax = Constants.session_nb_markers_selected_max;
        $scope.bOnlyReportMarkers = false;
        $scope.bSynthesisError = false;
        $scope.bInstructionsError = false;
        $scope.bValidationError = false;
        $scope.addingMarker = false;

        $scope.markerTimingEdited = null;

        $scope.roomDuration = 0;

        var modalDialog = null;

        var utils = ControllerUtils.buildContainer();
        var EmodashRestApi = EmodashDataService.emodashDataApi;

        function _init() {
            $scope.$on('$destroy', _shutdown);
            $log.debug($stateParams);
            $scope.report_req = EmodashRestApi.getEmodashReport().$promise.then(response => {
                $scope.report = response.sp_session;
                $scope.roomDuration = $scope.report.room_fields.durations.running;
                $scope.learner = response.learner;
                $scope.session_audio = response.audio;
                $scope.session_video = response.video;
                // $scope.report_fields = new FeedbackReports($scope.report.report_fields);
                $scope.report_fields = $scope.report.report_fields;

                $scope.report.report_fields = null;
                var markers = _.map(_.sortBy($scope.report.markers, 'start'), function (
                    _marker,
                    iMarker,
                ) {
                    return {
                        obj: _marker, // new FeedbackReportMarker.resource(_marker),
                        error: false,
                        timingEditionVars: false,
                        playerData: {
                            time: (_marker.start + _marker.stop) / 2,
                            text: String(iMarker + 1),
                        },
                    };
                });
                $scope.report.markers = null;
                $scope.markers = markers;
                $scope.filteredMarkers = null;

                var playerData = {};
                $scope.isEmodash = true; //_.get($stateParams, 'isEmodash');
                // added in LYON-DUBLIN
                if (true) {
                    playerData = FeedbackReportMarker.generatePlayerData(
                        'assets/videos/blured.mp4',
                        $scope.roomDuration,
                        [],
                        $scope.isEmodash,
                    );
                    _.set(playerData, 'streamMetadata.Type', 'video');
                } else {
                    playerData = FeedbackReportMarker.generatePlayerData(
                        response.audio,
                        $scope.roomDuration,
                        [],
                    );
                }

                playerData.datasets.markers = $scope.markers;
                var markersEncoding = playerData.options.encoding.markers;
                markersEncoding.value.key = 'playerData.time';
                markersEncoding.value.startkey = 'obj.start';
                markersEncoding.value.stopkey = 'obj.stop';
                markersEncoding.position[1].key = 'obj.type';
                markersEncoding.transform[0].tx.key = 'playerData.time';
                markersEncoding.transform[0].ty.key = 'obj.type';
                markersEncoding.transform[0].theta.key = 'obj.type';
                markersEncoding.symbol[1].key = 'playerData.text';
                markersEncoding.color[0].key = 'obj.type';

                utils.watch($scope, 'player', onPlayerReady);
                $scope.playerData = playerData;

                _countMarkers();
            });
        }

        function _shutdown() {
            utils.cleanup();
            if (modalDialog) {
                modalDialog.dismiss();
                modalDialog = null;
            }
        }

        function onPlayerReady() {
            if (!$scope.player) {
                return;
            }

            utils.unwatch('player');
            //This is our player so we don't need to unbind later
            var player = $scope.player;

            player.on('playChunk:start', function (event) {
                $log.debug('playChunk:start', event);
                if (event.datasetKey !== 'markers') {
                    return;
                }
                var marker = event.item;
                if (!marker) {
                    return;
                }
                $scope.playingMarker = marker;
                if (!$scope.$$phase) {
                    $scope.$digest();
                }
            });
            player.on('playChunk:stop', function (event) {
                $log.debug('playChunk:stop', event);
                $scope.playingMarker = null;
                if (!$scope.$$phase) {
                    $scope.$digest();
                }
            });
            player.on('timeline:dlbClick', function (event) {
                // added in LYON-DUBLIN
                if (!$scope.isNavigation) {
                    $log.debug('timeline:dlbClick', event);
                    $scope.addMarker();
                }
            });
            player.on('elementClick', function (event) {
                $log.debug('elementClick', event);
                // Start by prevent default then return if !== 'markers'
                // Don't perform the default playChunk, we'll do it ourselves (due to the way timing works when edited)
                event.preventDefault = true;
                if (event.datasetKey !== 'markers') {
                    return;
                }
                var marker = event.item;
                if (!marker) {
                    return;
                }
                $scope.listenToMarker(marker);
            });

            if ($scope.isEmodash) {
                player.on('emodash:isNavigating', function (isNavigatingVal) {
                    $scope.isNavigating = isNavigatingVal;
                });
            }
        }

        function _countMarkers() {
            var nbPositiveMarkers = 0;
            var nbNegativeMarkers = 0;
            var nbSelected = 0;
            angular.forEach($scope.markers, function (_marker) {
                if (_marker.obj.selected) {
                    ++nbSelected;
                }

                switch (_marker.obj.type) {
                    case Constants.session_marker_type.POSITIVE: {
                        ++nbPositiveMarkers;
                        break;
                    }
                    case Constants.session_marker_type.NEGATIVE: {
                        ++nbNegativeMarkers;
                        break;
                    }
                }
            });
            $scope.nbPositiveMarkers = nbPositiveMarkers;
            $scope.nbNegativeMarkers = nbNegativeMarkers;
            $scope.nbSelectedMarkers = nbSelected;
        }

        $scope.makePositive = function (marker) {
            if (
                !marker.obj.selected ||
                marker.obj.type === Constants.session_marker_type.POSITIVE
            ) {
                return;
            }
            marker.obj.type = Constants.session_marker_type.POSITIVE;
            $scope.player.datasetsChanged();
            // TODO notif
            NotificationService.startProgress('feedback-report-edit.makePositive');
            marker.obj.$update(
                { reportId: $scope.report._id },
                function (/*response*/) {
                    // OK handler
                    NotificationService.stopProgressOK('feedback-report-edit.makePositive');
                    _countMarkers();
                },
                function (errorResponse) {
                    // Error handler
                    marker.obj.type = Constants.session_marker_type.NEGATIVE;
                    $scope.player.datasetsChanged();
                    NotificationService.stopProgressError('feedback-report-edit.makePositive');
                    $log.error(errorResponse);
                },
            );
        };

        $scope.makeNegative = function (marker) {
            if (
                !marker.obj.selected ||
                marker.obj.type === Constants.session_marker_type.NEGATIVE
            ) {
                return;
            }
            marker.obj.type = Constants.session_marker_type.NEGATIVE;
            $scope.player.datasetsChanged();
            NotificationService.startProgress('feedback-report-edit.makeNegative');
            marker.obj.$update(
                { reportId: $scope.report._id },
                function (/*response*/) {
                    // OK handler
                    NotificationService.stopProgressOK('feedback-report-edit.makeNegative');
                    _countMarkers();
                },
                function (errorResponse) {
                    // Error handler
                    marker.obj.type = Constants.session_marker_type.POSITIVE;
                    $scope.player.datasetsChanged();
                    NotificationService.stopProgressError('feedback-report-edit.makeNegative');
                    $log.error(errorResponse);
                },
            );
        };

        $scope.listenToMarker = function (marker) {
            var markerStart = marker.timingEditionVars
                ? marker.timingEditionVars.start
                : marker.obj.start;
            var markerStop = marker.timingEditionVars
                ? marker.timingEditionVars.stop
                : marker.obj.stop;
            $scope.player.playChunk(markerStart, markerStop, {
                datasetKey: 'markers',
                item: marker,
            });
        };

        $scope.stopListeningToMarker = function (marker) {
            if ($scope.playingMarker === marker) {
                $scope.player.pause();
            }
        };

        $scope.addToReport = function (marker) {
            if (marker.obj.selected === true) {
                return;
            }
            if ($scope.nbSelectedMarkers >= Constants.session_nb_markers_selected_max) {
                return;
            }

            marker.obj.selected = true;
            NotificationService.startProgress('feedback-report-edit.addToReport');

            var index = _.findIndex($scope.markers, 'obj._id', marker._id);
            $scope.markers[index].obj.selected = false;

            marker.obj.$update(
                { reportId: $scope.report._id },
                function (/*response*/) {
                    // OK handler
                    NotificationService.stopProgressOK('feedback-report-edit.addToReport');
                    _countMarkers();
                },
                function (errorResponse) {
                    // Error handler
                    marker.obj.selected = false;
                    NotificationService.stopProgressError('feedback-report-edit.addToReport');
                    $log.error(errorResponse);
                },
            );
        };

        $scope.removeFromReport = function (marker) {
            if (!marker.obj.selected) {
                return;
            }
            marker.obj.selected = false;

            var index = _.findIndex($scope.markers, 'obj._id', marker._id);

            $scope.markers[index].obj.selected = false;
            NotificationService.startProgress('feedback-report-edit.removeFromReport');
            marker.obj.$update(
                { reportId: $scope.report._id },
                function (/*response*/) {
                    // OK handler
                    NotificationService.stopProgressOK('feedback-report-edit.removeFromReport');
                    _countMarkers();
                },
                function (errorResponse) {
                    // Error handler
                    marker.obj.selected = true;
                    NotificationService.stopProgressError('feedback-report-edit.removeFromReport');
                    $log.error(errorResponse);
                },
            );
        };

        $scope.onMarkerCommentChange = function (marker) {
            if (!marker.obj.selected) {
                return;
            }
            _saveMarker(marker);
        };

        function _saveMarker(marker) {
            NotificationService.startProgress('feedback-report-edit.saveMarker');
            marker.obj.$update(
                { reportId: $scope.report._id },
                function (/*response*/) {
                    // OK Handler
                    NotificationService.stopProgressOK('feedback-report-edit.saveMarker');
                },
                function (errorResponse) {
                    // Error handler
                    NotificationService.stopProgressError('feedback-report-edit.saveMarker');
                    $log.error(errorResponse);
                },
            );
        }

        $scope.toggleMarkerView = function () {
            $scope.bOnlyReportMarkers = !$scope.bOnlyReportMarkers;
            _updateFilteredMarkers();
        };

        function _saveFields() {
            NotificationService.startProgress('feedback-report-edit.saveFields');
            $scope.report_fields.$update(
                { reportId: $scope.report._id },
                function (/*response*/) {
                    // OK Handler
                    NotificationService.stopProgressOK('feedback-report-edit.saveFields');
                },
                function (errorResponse) {
                    // Error handler
                    NotificationService.stopProgressError('feedback-report-edit.saveFields');
                    $log.error(errorResponse);
                },
            );
        }

        $scope.onSynthesisChange = function () {
            _saveFields();
        };

        $scope.onInstructionsChange = function () {
            _saveFields();
        };

        function _validateReport() {
            $scope.bValidationError = false;
            $scope.bSynthesisError = !(
                $scope.report_fields.synthesis && $scope.report_fields.synthesis.length > 0
            );
            $scope.bInstructionsError = !(
                $scope.report_fields.instructions && $scope.report_fields.instructions.length > 0
            );
            $scope.bValidationError = $scope.bSynthesisError;

            angular.forEach($scope.markers, function (_marker) {
                _marker.error = false;
                if (
                    _marker.obj.selected &&
                    (!_marker.obj.learner_text || _marker.obj.learner_text.length === 0)
                ) {
                    _marker.error = true;
                    $scope.bValidationError = true;
                }
            });

            if ($scope.bValidationError) {
                $location.hash('top');
                $anchorScroll();
            } else {
                $state.go('feedback_report_preview', {
                    reportId: $scope.report._id,
                });
            }
        }

        $scope.validateReport = _validateReport;

        $scope.goHome = function () {
            $state.go('home');
        };

        var default_offset_sec = 10;
        $scope.addMarker = function () {
            if (modalDialog) {
                return;
            }

            $scope.player.pause();

            var stream = document.getElementById('client-stream');
            var currenttime = stream.currentTime;
            var duration = stream.duration;
            //CORE-168 Instead of rounding the time, we 'floor' it so that we stay aligned
            //with the player (0:09:975 is displayed as 0:09).
            var start_time = Math.max(0, Math.floor(currenttime - default_offset_sec));

            var stop_time = Math.min(start_time + 10, $scope.roomDuration);

            $scope.addingMarker = true;

            var marker = {
                start: start_time,
                stop: stop_time,
                type: 'positive',
            };

            $scope.addingMarker = false;
            $scope.markers.push({
                obj: marker,
                error: false,
                timingEditionVars: false,
                playerData: {
                    time: (marker.start + marker.stop) / 2,
                },
            });

            _resortMarkers();
            _countMarkers();

            // TODO dialog
            // modalDialog =
            // $modal.open({
            //   templateUrl:
            //     "app/modules/feedback-reports/views/feedback-report-edit-add-marker.client.view.html",
            //   controller: "FeedbackReportEditAddMarkerController", //We need to pass it here otherwise open will not forward the $modalInstance to the controller in the template
            //   size: "sm",
            //   windowClass: "feedback-report-popup-window",
            //   resolve: {
            //     start_time: function() {
            //       return start_time;
            //     },
            //     stop_time: function() {
            //       return stop_time;
            //     },
            //     positive_result: function() {
            //       return Constants.session_marker_type.POSITIVE;
            //     },
            //     negative_result: function() {
            //       return Constants.session_marker_type.NEGATIVE;
            //     }
            //   }
            // });

            // modalDialog.result.then(
            //   function(result) {
            //     modalDialog = null;
            //     switch (result) {
            //       case Constants.session_marker_type.POSITIVE:
            //       case Constants.session_marker_type.NEGATIVE: {
            //         $scope.addingMarker = true;
            //         var marker = new FeedbackReportMarker.resource({
            //           start: start_time,
            //           stop: stop_time,
            //           type: result
            //         });
            //         marker.$save(
            //           { reportId: $scope.report._id },
            //           function(/*response*/) {
            //             // OK Handler
            //             $scope.addingMarker = false;
            //             $scope.markers.push({
            //               obj: new FeedbackReportMarker.resource(marker),
            //               error: false,
            //               timingEditionVars: false,
            //               playerData: {
            //                 time: (marker.start + marker.stop) / 2
            //               }
            //             });
            //             _resortMarkers();
            //             _countMarkers();
            //           },
            //           function(/*errorResponse*/) {
            //             // Error Handler
            //             $scope.addingMarker = false;
            //           }
            //         );
            //         break;
            //       }
            //     }
            //   },
            //   function() {
            //     modalDialog = null;
            //   }
            // );
        };

        $scope.addAudioComment = function (marker, iMarker /*event*/) {
            // if (RoomHelper.getUserAgent().browser.name.toUpperCase() !== 'FIREFOX') {
            //     SharedDialog.show({
            //         id : 'feedback-edit-audio-commentary-only-firefox',
            //         title: 'feedback-edit.audio-commentary.only-firefox-popin.title',
            //         content: 'feedback-edit.audio-commentary.only-firefox-popin.content'
            //     });
            //     return;
            // }

            if (modalDialog) {
                return;
            }
            // TODO dialog
            // modalDialog = $modal.open({
            //   templateUrl:
            //     "app/modules/feedback-reports/views/feedback-report-edit-audio-comment.client.view.html",
            //   controller: "FeedbackReportEditAudioCommentController", //We need to pass it here otherwise open will not forward the $modalInstance to the controller in the template
            //   size: "lg",
            //   backdrop: "static", //We don't want it to be closable by clicking outside otherwise we might be killed while uploading/converting
            //   windowClass: "feedback-report-popup-window",
            //   resolve: {
            //     report_id: function() {
            //       return $scope.report._id;
            //     },
            //     marker_id: function() {
            //       return marker.obj._id;
            //     },
            //     marker_type: function() {
            //       return marker.obj.type;
            //     },
            //     marker_learner_text: function() {
            //       return marker.obj.learner_text;
            //     },
            //     marker_display_index: function() {
            //       return iMarker;
            //     }
            //   }
            // });
            // modalDialog.result.then(
            //   function(result) {
            //     modalDialog = null;
            //     if (result === "OK") {
            //       $log.debug("Updating marker with audio comment");
            //       marker.obj.audio_comment = {
            //         created: Date.now()
            //       };
            //       _saveMarker(marker);
            //     }
            //   },
            //   function() {
            //     modalDialog = null;
            //   }
            // );
        };

        $scope.editMarkerTiming = function (marker) {
            if ($scope.markerTimingEdited || marker.timingEditionVars) {
                return;
            }
            //Since UI is going to be disabled for the other marker, we want to stop it before we start editing
            if ($scope.playingMarker && $scope.playingMarker !== marker) {
                $scope.stopListeningToMarker($scope.playingMarker);
            }
            marker.timingEditionVars = {
                start: marker.obj.start,
                stop: marker.obj.stop,
            };
            $scope.markerTimingEdited = marker;
        };

        $scope.timingValidate = function (marker) {
            if (!marker.timingEditionVars) {
                return;
            }
            var bSaveMarker = false;
            if (
                marker.timingEditionVars.start !== marker.obj.start ||
                marker.timingEditionVars.stop !== marker.obj.stop
            ) {
                // Marker has changed, we update the values
                marker.obj.start = marker.timingEditionVars.start;
                marker.obj.stop = marker.timingEditionVars.stop;
                marker.playerData.time = (marker.obj.start + marker.obj.stop) / 2;

                bSaveMarker = true;
                _resortMarkers();
            }

            delete marker.timingEditionVars;
            $scope.markerTimingEdited = null;

            // And we save it
            if (bSaveMarker) {
                _saveMarker(marker);
            }
        };

        function _resortMarkers() {
            $scope.markers = _.sortBy($scope.markers, 'obj.start');
            _.each($scope.markers, function (_marker, iMarker) {
                _marker.playerData.text = String(iMarker + 1);
            });
            if ($scope.bOnlyReportMarkers) {
                _updateFilteredMarkers();
            } else {
                $scope.playerData.datasets.markers = $scope.markers;
                $scope.player.datasetsChanged();
            }
        }

        $scope.timingCancel = function (marker) {
            if (!marker.timingEditionVars) {
                return;
            }
            if (
                marker.timingEditionVars.start !== marker.obj.start ||
                marker.timingEditionVars.stop !== marker.obj.stop
            ) {
                //If the data changed, we may be listing to "edition" timing, so we stop
                $scope.stopListeningToMarker(marker);
            }
            delete marker.timingEditionVars;
            $scope.markerTimingEdited = null;
        };

        $scope.reduceMarkerStart = function (marker) {
            if (!marker.timingEditionVars) {
                return;
            }
            marker.timingEditionVars.start = Math.max(marker.timingEditionVars.start - 1, 0);
            $scope.stopListeningToMarker(marker);
        };

        $scope.increaseMarkerStart = function (marker) {
            if (!marker.timingEditionVars) {
                return;
            }
            marker.timingEditionVars.start = Math.min(
                marker.timingEditionVars.start + 1,
                marker.timingEditionVars.stop - 1,
            );
            $scope.stopListeningToMarker(marker);
        };

        $scope.reduceMarkerStop = function (marker) {
            if (!marker.timingEditionVars) {
                return;
            }
            marker.timingEditionVars.stop = Math.max(
                marker.timingEditionVars.stop - 1,
                marker.timingEditionVars.start + 1,
            );
            $scope.stopListeningToMarker(marker);
        };

        $scope.increaseMarkerStop = function (marker) {
            if (!marker.timingEditionVars) {
                return;
            }
            marker.timingEditionVars.stop = Math.min(
                marker.timingEditionVars.stop + 1,
                $scope.roomDuration,
            );
            $scope.stopListeningToMarker(marker);
        };

        function _updateFilteredMarkers() {
            if ($scope.bOnlyReportMarkers) {
                $scope.filteredMarkers = _.filter($scope.markers, ['obj.selected', true]);
                $scope.playerData.datasets.markers = $scope.filteredMarkers;
                $scope.player.datasetsChanged();
            } else if ($scope.filteredMarkers) {
                $scope.playerData.datasets.markers = $scope.markers;
                delete $scope.filteredMarkers;
                $scope.player.datasetsChanged();
            }
        }

        _init();
    });
