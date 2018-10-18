import { module } from 'angular';
import * as d3 from 'd3';
import * as _ from 'lodash';
import jQuery from 'jquery';
import moment from 'moment/moment.js';

export default module('app.emodash.ctr', []).controller('EmodashController', function (
    $log,
    $scope,
    EmodashDataService,
    ControllerUtils,
    $stateParams,
    $q,
    FeedbackReportMarker,
    $window,
    NotificationService,
    $translate,
    $rootScope,
    Constants,
) {
    var self = this;
    var EmodashRestApi = EmodashDataService.emodashDataApi;
    var utils = ControllerUtils.buildContainer();
    var isCombineEmotions = false;
    var player;

    self.coachName = 'eamonn';
    $stateParams.reportId = '5a0bfe9bb2ee7900015fcd3d';

    if (isCombineEmotions) {
        var emotionNewKey = 'anger';
        var emotionsKeysCombined = [emotionNewKey, 'fear', 'sadness'];
        var emotionsKeysToCombine = ['contempt', 'disgust', 'anger'];
    }

    // tip UI config
    var tipWidth = 150;
    var tipHeight = 150;
    var docstipTimer = 1000;
    var boundaryMarginOffset = 10;
    var spToolbarHeaderHeight = 0; //64;

    // xAPI emodash player interactions
    var batchSize = 20; // save each 20 elements in one statement
    var showtips = [],
        showtipsCtxKey = 'tooltips',
        showtipsTimer = 'showtipsTimer';
    var streamActions = [],
        streamActionsCtxKey = 'streamActions',
        streamActionsTimer = 'streamActions';
    var pageId = null; // xApiHelper.getPageId() + '/reports/' + $stateParams.reportId + '/edit';
    var stmt = { verb: 'interacted', object: { id: pageId }, context: {} };
    var showtipStmt = _.merge(
        { object: { type: 'emodash-showtip', name: 'emodash-showtip' } },
        stmt,
    );
    var streamStmt = _.merge({ object: { type: 'emodash-stream', name: 'emodash-stream' } }, stmt);

    // fire init
    _init();
    // on destroy
    $scope.$on('$destroy', _cleanup);

    function _init() {
        $log.debug('[init-destroy] _init');
        self.cache = {};
        self.balanceChartDataOptions = EmodashDataService.balanceChartDataOptions;
        self.radialColChartDataOptions = EmodashDataService.radialColChartDataOptions;
        self.isSupportsPdfMimeType = typeof navigator.mimeTypes['application/pdf'] !== 'undefined';

        /** isEmotion pack's session data info */
        getIsEmotionPackSessionsInfo();
        /** first level data */
        getFirstLvlData();

        /** attach data to the player datasets */
        utils.watch($scope, '$parent.player', function () {
            player = _.get($scope, '$parent.player', null);

            if (!player) {
                return;
            }

            self.playerDatasetsHoverDivEl = d3.select('#player-datasets-tooltip');
            self.playerTooltipOverlayDivEl = d3.select('.player-tooltip-overlay');
            self.playerTooltipOverlayDivNgEl = angular.element(
                document.querySelector('.player-tooltip-overlay'),
            );

            utils.unwatch('$parent.player');

            // now we have marker of the current session in the player scope
            // let's get them
            _.set(
                self,
                'cache.' + $stateParams.reportId + '.' + 'thirdLvlData.markers',
                $scope.$parent.playerData.datasets.markers,
            );

            $scope.$parent.player.on('elementMouseEvent', function (eventData) {
                console.debug('[playerStreamReport] elementMouseEvent on', eventData);
                $log.debug('[playerStreamReport] elementMouseEvent on', eventData);
                var eventName = _.get(eventData, 'eventName');
                var datasetKey = _.get(eventData, 'datasetKey');
                if (_.isEqual(eventName, 'mouseenter')) {
                    showtip(eventData);
                } else if (_.isEqual(eventName, 'mouseleave')) {
                    if (!_.isEqual(datasetKey, 'docs') || !self.isTipOpen) {
                        hidetip();
                    }
                }
            });

            player.on('playerStreamReport', function (eventData) {
                console.debug('[playerStreamReport] playerStreamReport on', eventData);
                $log.debug('[playerStreamReport] playerStreamReport on', eventData);
                streamActions.push(buildStreamActionKey(eventData));
                emodashxApiBatchHandler(
                    streamStmt,
                    streamActions,
                    streamActionsCtxKey,
                    streamActionsTimer,
                );
            });

            renderEmodashData($stateParams.reportId);
        });

        /**
         * handling the navigation next/previous over sessions
         * --------------------------------------------------- */
        self.previous = function () {
            if (self.currentSessionId > 0) {
                $log.debug('CurrentSession index ', self.currentSessionId, ' Go next session');
                var sessionId = self.sessionsIds[--self.currentSessionId];
                renderEmodashData(sessionId);
                self.currentSessionDate = moment(
                    self.sessionsDates[self.currentSessionId],
                    'x',
                ).format('LL');
                self.selectedLearningSession = self.sessionsIds[self.currentSessionId];
            } else {
                $log.debug('There is no previous, we already there !!!');
                NotificationService.showNormalOK(
                    $translate.instant('emodash.notification.noprevious'),
                );
            }
        };

        self.next = function () {
            if (self.currentSessionId < self.sessionsIds.length - 1) {
                $log.debug('CurrentSession index ', self.currentSessionId, ' Go next session');
                var sessionId = self.sessionsIds[++self.currentSessionId];
                renderEmodashData(sessionId);
                self.currentSessionDate = moment(
                    self.sessionsDates[self.currentSessionId],
                    'x',
                ).format('LL');
                self.selectedLearningSession = self.sessionsIds[self.currentSessionId];
            } else {
                $log.debug('There is no next, we already there !!!');
                NotificationService.showNormalOK($translate.instant('emodash.notification.nonext'));
            }
        };

        $rootScope.$on('sessionsTimeline:isNavigation', function (ev, sessionId) {
            $log.debug('[sessionsTimeline:isNavigation] on', sessionId);
            self.currentSessionId = _.indexOf(self.sessionsIds, sessionId);
            self.currentSessionDate = moment(self.sessionsDates[self.currentSessionId], 'x').format(
                'LL',
            );
            renderEmodashData(sessionId);
        });

        /**
         * handling open/close tip/overlay
         * ------------------------------------- */
        self.closeThumbnail = function (/*ev*/) {
            $log.debug('close thumbnail');
            hidetip();
        };

        self.openOverlay = function (/*ev*/) {
            $log.debug('open thumbnail');
            if (_.isEqual(self.tipContent, 'isCanvas')) {
                var tipCanvas = jQuery('.player-tooltip-overlay > #tip-content');
                jQuery('#player-datasets-tooltip > #tip-content > canvas')
                    .detach()
                    .appendTo(tipCanvas);
                pdfJSRenderFirstPage(
                    self.pdfJSCurrentPage,
                    tipCanvas.width(),
                    tipCanvas.height(),
                    'tip-pdf-canvas',
                );
            } else {
                self.playerTooltipOverlayDivEl.select('#tip-content').html(self.tipContent);
            }
            hidetip();
            self.playerTooltipOverlayDivNgEl.addClass('open');
        };

        self.closeOverlay = function (/*ev*/) {
            $log.debug('close closeOverlay');
            // remove content
            self.playerTooltipOverlayDivEl.select('#tip-content').html('');
            // hide
            self.playerTooltipOverlayDivNgEl.removeClass('open');
        };

        $window.onbeforeunload = onbeforeunload;
    }

    function onbeforeunload() {
        $log.debug('[onbeforeunload] onbeforeunload');
        var stmts = [];
        if (showtips) {
            _.set(showtipStmt, 'context.' + showtipsCtxKey, showtips);
            stmts.push(showtipStmt);
        }
        if (streamActions) {
            _.set(streamStmt, 'context.' + streamActionsCtxKey, streamActions);
            stmts.push(streamStmt);
        }
        if (stmts) {
            // xApi.lastChanceBeacon([showtipStmt, streamStmt]);
        }
    }

    function _cleanup() {
        $log.debug('[init-destroy] _cleanup');
        emodashxApiHandler(showtipStmt, showtips, false, showtipsCtxKey, null);
        emodashxApiHandler(streamStmt, streamActions, false, streamActionsCtxKey, null);
        delete self.cache;
        utils.cleanup();
        utils = undefined;
        showtips = undefined;
        EmodashRestApi = undefined;
    }

    /**
     * some helper methods
     * ------------------- */
    function getFirstLvlData() {
        /** check the cache otherwise make an http call */
        self.radialColChartData = _.get(
            self,
            'cache.' + $stateParams.reportId + '.' + 'firstLvlData.radialColChartData.dataset0',
        );
        self.balanceChartData = _.get(
            self,
            'cache.' + $stateParams.reportId + '.' + 'firstLvlData.balanceChartData.dataset0',
        );
        self.learningObjective = _.get(
            self,
            'cache.' + $stateParams.reportId + '.' + 'firstLvlData.learningObjective',
        );

        if (!self.radialColChartData && !self.balanceChartData) {
            EmodashRestApi.getEmodashEmotionsMeans({ sessionId: $stateParams.reportId })
                .$promise.then(function (response) {
                    var means = _.get(response, 'means'),
                        index = 0,
                        aradialData = [],
                        negativeKeys = null;

                    if (isCombineEmotions) {
                        negativeKeys = emotionsKeysCombined;
                        means = combineEmotionsProcessor(
                            means,
                            emotionsKeysToCombine,
                            emotionNewKey,
                        );
                    }

                    $log.debug('[getFirstLvlData] emotions means ', means);

                    _.each(means, function (val, key) {
                        aradialData.push(radialChartDataElem(index, val, key));
                        index++;
                    });

                    _.set(self, 'radialColChartData.dataset0', radialChartData(aradialData));
                    _.set(
                        self,
                        'balanceChartData.dataset0',
                        balanceChartData(means, null, negativeKeys),
                    );
                    _.set(self, 'learningObjective', _.get(response, 'objective', ''));

                    _.set(self, 'cache.' + $stateParams.reportId + '.firstLvlData', {
                        radialColChartData: self.radialColChartData,
                        balanceChartData: self.balanceChartData,
                        learningObjective: self.learningObjective,
                    });
                })
                .catch(function () {
                    $log.error('Error calling emodashDataApi [emotions info]');
                    _.set(self, 'radialColChartData.dataset0', []);
                    _.set(self, 'balanceChartData.dataset0', []);
                    _.set(self, 'learningObjective', '');
                });
        }
    }

    function getIsEmotionPackSessionsInfo() {
        /** check the cache otherwise make an http call */
        self.sessionsIds = _.get(
            self,
            'cache.' + $stateParams.reportId + '.' + 'sessionsInfo.sessionsIds',
        );
        self.sessionsDates = _.get(
            self,
            'cache.' + $stateParams.reportId + '.' + 'sessionsInfo.sessionsDates',
        );

        if (!self.sessionsIds && !self.sessionsDates) {
            EmodashDataService.emodashDataApi
                .getClosedSessionsInfo({ coachName: self.coachName })
                .$promise.then(function (response) {

                    _.set(self, 'sessionsInfo', response);
                    _.set(self, 'sessionsIds', _.map(response, '_id'));
                    _.set(self, 'sessionsDates', _.map(response, 'finishDate'));
                    _.set(
                        self,
                        'currentSessionId',
                        _.indexOf(self.sessionsIds, $stateParams.reportId),
                    );
                    _.set(
                        self,
                        'currentSessionDate',
                        moment(self.sessionsDates[self.currentSessionId], 'x').format('LL'),
                    );
                    _.set(self, 'cache.' + $stateParams.reportId + '.sessionsInfo', {
                        sessionsIds: self.sessionsIds,
                        sessionsDates: self.sessionsDates,
                    });
                })
                .catch(function () {
                    $log.error('Error calling emodashDataApi [closed sessions info]');
                });
        }
    }

    function renderEmodashData(sessionId) {
        self.isNavigating = !_.isEqual(sessionId, $stateParams.reportId);

        if (player) {
            // emit isNavigation event to disable player not needed buttons
            player.emit('emodash:isNavigating', self.isNavigating);
        }

        var promises = [];
        var chatsPromise = EmodashRestApi.getChatMessagesBySessionId({ sessionId: sessionId })
            .$promise;
        var docsPromise = EmodashRestApi.getShartedDocsBySessionId({ sessionId: sessionId })
            .$promise;
        var emotionsPromise = EmodashRestApi.getEmodashEmotionsData({ coachName: self.coachName })
            .$promise;

        var markersPromise = EmodashRestApi.getEmodashMarkers({ sessionId: sessionId }).$promise;

        var seekingPromise = EmodashRestApi.getPlayerEventsData({ sessionId: sessionId }).$promise;

        var isReportPublished = _.chain(self.sessionsInfo)
            .find({ _id: sessionId })
            .get('reportPublishDate')
            .value();

        // if (self.isNavigating) {
        //     // if (isReportPublished) {
        //     markersPromise = EmodashRestApi.getEmodashReport().$promise;
        //     // } else {
        //     // markersPromise = FeedbackReports.getForPreview({ sessionId: sessionId }).$promise;
        //     // }
        // }
        /** check cache, ORDER of promise is important here !! */
        // chat
        var chats = _.get(self, 'cache.' + sessionId + '.' + 'thirdLvlData.chats');
        if (!chats) {
            promises.push(chatsPromise);
        } else {
            promises.push(chats);
        }
        // docs
        var docs = _.get(self, 'cache.' + sessionId + '.' + 'thirdLvlData.docs');
        if (!docs) {
            promises.push(docsPromise);
        } else {
            promises.push(docs);
        }
        // emotions
        var emotions = _.get(self, 'cache.' + 'thirdLvlData.emotions');
        if (!emotions) {
            promises.push(emotionsPromise);
        } else {
            promises.push(emotions);
        }
        // markers
        var markers = _.get(self, 'cache.' + sessionId + '.' + 'thirdLvlData.markers');
        if (!markers) {
            promises.push(markersPromise);
        } else {
            promises.push(markers);
        }

        // seeking
        var seeking;
        promises.push(seekingPromise);

        // video
        var currentSessionVideo = _.get($scope, '$parent.playerData.streamURL');
        var video =
            _.get(self, 'cache.' + sessionId + '.' + 'thirdLvlData.video') || currentSessionVideo;

        $q
            .all(promises)
            .then(function (data) {
                var emodashData = data[2];
                if (_.has(data[2], '$promise')) {
                    emodashData = data[2].toJSON();
                }

                var tmpMarkers;


                if (!markers || _.size(markers) === 0) {


                    // get stream video
                    video = _.get(data[3], 'video');
                    // get markers
                    tmpMarkers = data[3];
                    tmpMarkers = _.map(_.sortBy(tmpMarkers, 'obj.start'), function (_marker, iMarker) {
                        return {
                            obj: new FeedbackReportMarker.resource(_marker.obj),
                            error: false,
                            timingEditionVars: false,
                            playerData: {
                                time: (_marker.obj.start + _marker.obj.stop) / 2,
                                text: String(iMarker + 1),
                            },
                        };
                    });
                } else {
                    tmpMarkers = data[3];
                }

                // second level data
                self.sessionsTlData = _.mapValues(emodashData, function (aItems) {
                    return _.map(
                        aItems,
                        _.partialRight(_.pick, ['positive', 'negative', 'timestamp']),
                    );
                });


                // third level data
                var thirdLvlData = {},
                    negativeKeys = ['contempt', 'disgust', 'fear', 'sadness', 'anger'];
                _.each(emodashData, function (aItems, key) {
                    var aSplitKey = _.split(key, '-', 4);
                    var spId = aSplitKey[1];
                    if (isCombineEmotions) {
                        negativeKeys = emotionsKeysCombined;
                    }
                    thirdLvlData[spId] = {
                        pos: {
                            data: _.map(
                                aItems,
                                _.partialRight(_.pick, ['happiness', 'surprise', 'timestamp']),
                            ),
                            keys: ['happiness', 'surprise'],
                        },
                        neg: {
                            data: _.map(
                                aItems,
                                _.partialRight(_.pick, _.concat(negativeKeys, 'timestamp')),
                            ),
                            keys: negativeKeys,
                        },
                    };
                });

                chats = data[0];
                docs = data[1];
                markers = tmpMarkers;
                seeking = data[4];
                updatePlayerDatasetsAndCache(
                    chats,
                    docs,
                    markers,
                    video,
                    sessionId,
                    thirdLvlData,
                    emodashData,
                    seeking,
                );
            })
            .catch(function (err) {
                $log.error(' err renderEmodashData ', err);
            });
    }

    function updatePlayerDatasetsAndCache(
        chats,
        docs,
        markers,
        video,
        sessionId,
        thirdLvlData,
        emodashData,
        seeking,
    ) {
        // update cache
        _.set(self, 'cache.' + sessionId + '.' + 'thirdLvlData.chats', chats);
        _.set(self, 'cache.' + sessionId + '.' + 'thirdLvlData.docs', docs);
        _.set(self, 'cache.' + sessionId + '.' + 'thirdLvlData.markers', markers);
        _.set(self, 'cache.' + sessionId + '.' + 'thirdLvlData.video', video);
        _.set(self, 'cache.' + 'thirdLvlData.emotions', emodashData);

        var posEmotions = _.get(thirdLvlData, '' + sessionId + '.pos', { data: [], keys: [] });
        var negEmotions = _.get(thirdLvlData, '' + sessionId + '.neg', { data: [], keys: [] });
        // update plater datasets & stream
        $scope.$parent.playerData.datasets.chats = chats;
        $scope.$parent.playerData.datasets.docs = docs;
        $scope.$parent.playerData.datasets.markers = markers;
        $scope.$parent.playerData.datasets.pos_emotions = posEmotions;
        $scope.$parent.playerData.datasets.neg_emotions = negEmotions;
        $scope.$parent.playerData.datasets.seeking = seeking;
        _.set($scope, '$parent.playerData.streamURL', video);
        // html5 video seems not able to detect src change
        // jQuery('#player-root > #client-stream').load();
        // refresh the player
        $scope.$parent.player.datasetsChanged();
    }

    function showtip(eventData) {
        $log.debug('[tooltip] showtip', eventData);
        if (self.isTipOpen) {
            hidetip();
        }
        $q.when(tipContent(eventData)).then(function (content) {
            $log.debug('[tooltip] showtip $q content', content);
            poptip(content, eventData);
            self.isTipOpen = true;
        });
    }

    function poptip(content, eventData, isNg) {
        var x = _.get(eventData, 'event.clientX', 0),
            y =
                _.get(eventData, 'event.clientY', 0) +
                (jQuery('#content').scrollTop() || jQuery(window).scrollTop()) -
                spToolbarHeaderHeight,
            position;

        self.tipContent = content;
        if (!_.isEqual(content, 'isCanvas')) {
            self.playerDatasetsHoverDivEl.select('#tip-content').html(content);
        }
        self.playerDatasetsHoverDivEl.style('display', 'initial');
        position = calcOptimalPosition(x, y);
        self.playerDatasetsHoverDivEl.style('top', position.top + 'px');
        self.playerDatasetsHoverDivEl.style('left', position.left + 'px');
    }

    function hidetip() {
        $log.debug('[tooltip] hidetip');
        self.playerDatasetsHoverDivEl.select('#tip-content').html('');
        self.playerDatasetsHoverDivEl.style('display', 'none');
        cancelTimer(self.showdoctipTimer, 'showdoctipTimer', 'user step');
        self.isTipOpen = false;
    }

    function tipContent(eventData) {
        $log.debug('[tooltip] tipContent', eventData);
        var defer = $q.defer();
        self.playerDatasetsHoverDivEl.select('#actions').style('display', 'none');
        switch (_.get(eventData, 'datasetKey')) {
            case 'chats':
                defer.resolve(chattip(eventData));
                break;
            case 'markers':
                self.playerDatasetsHoverDivEl.select('#actions').style('display', 'none');
                defer.resolve(markertip(eventData));
                break;
            case 'docs':
                defer.resolve(doctip(eventData));
                break;
            case 'emotions':
                defer.resolve(emotiontip(eventData));
                break;
            default:
                break;
        }
        // add interaction to be sent latter as xapi event to LL
        showtipsAccumulator(eventData);
        return defer.promise;
    }

    function emotiontip(eventData) {
        return (
            '<span style="border-bottom: 3px solid ' +
            getByKey('color', _.get(eventData, 'item')) +
            '">' +
            getByKey('label', _.get(eventData, 'item')) +
            '</span>'
        );
    }

    function imgtip(srcstr) {
        return (
            '<img class="tip-img" width=' +
            tipWidth +
            'px height=' +
            tipHeight +
            'px  src=' +
            srcstr +
            '>'
        );
    }

    function streamtip(srcstr, tipClass) {
        return (
            '<video class=' +
            tipClass +
            ' width=' +
            tipWidth +
            'px height=' +
            tipHeight +
            'px controls src=' +
            srcstr +
            '>'
        );
    }

    function chattip(eventData) {
        return chatMsgOwner(eventData) + ' ' + _.get(eventData, 'item.message', '');
    }

    function markertip(eventData) {
        return (
            markerFaIcon(eventData) +
            (_.get(eventData, 'item.obj.learner_text') ||
                '[' + $translate.instant('emodash.html.marker.tooltip.label') + ']')
        );
    }

    function doctip(eventData) {
        var docid = _.get(eventData, 'item.docid');
        var file = _.get(self, 'cache.' + $stateParams.reportId + '.docs.' + docid, null);

        // show spin before displaying
        var progress =
            '<div style="font-size: 30px; color: rgb(76,200,242); text-align: center;"><span class="fa fa-circle-o-notch fa-spin"></span></div>';

        poptip(progress, eventData, true);

        var promise = $q(function (resolve, reject) {
            if (self.showdoctipTimer) {
                cancelTimer(self.showdoctipTimer, 'showdoctipTimer', 'there is already one');
            }
            self.showdoctipTimer = utils.timeout(
                'showdoctipTimer',
                function () {
                    $log.debug('[tooltip] doctip utils.timeout');
                    self.showdoctipTimer = undefined;
                    if (file) {
                        $log.debug('Optimizer using cache for docs file ', file);
                        resolve(file);
                    } else {
                        EmodashRestApi.getDocS3URL({ docId: _.get(eventData, 'item.docid') })
                            .$promise.then(function (data) {
                                file = _.get(data, 'file', null);
                                // /** just for debug */
                                // _.set(file, 's3.url', 'http://localhost:3000/api/v1/data-manager/buckets/docs/generic_docs/generic.pdf');
                                // _.set(file, 'displayType', 'pdf');
                                // /** end debug */
                                _.set(
                                    self,
                                    'cache.' + $stateParams.reportId + '.docs.' + docid,
                                    file,
                                );
                                resolve(file);
                            })
                            .catch(function () {
                                reject('Something wrong goes there');
                            });
                    }
                },
                docstipTimer,
            );
        });

        return promise.then(function (fileData) {
            $log.debug('doctip promise ', fileData);
            self.playerDatasetsHoverDivEl.select('#actions').style('display', 'initial');
            switch (_.get(fileData, 'displayType')) {
                case 'image':
                    return imgtip(_.get(fileData, 's3.url'));
                case 'pdf':
                    return pdftip(_.get(fileData, 's3.url'));
                case 'audio':
                    return streamtip(_.get(fileData, 's3.url'), 'tip-audio');
                case 'video':
                    return streamtip(_.get(fileData, 's3.url'), 'tip-video');
                default:
                    break;
            }
        });
    }

    function pdftip(srcstr) {
        $log.debug('[tooltip] pdftip');
        if (self.isSupportsPdfMimeType) {
            return (
                '<object class="tip-pdf" width=' +
                tipWidth +
                ' height=' +
                tipHeight +
                ' data=' +
                srcstr +
                '></object>'
            );
        } else {
            self.pdfCanvas = angular.element('<canvas id="tip-pdf-canvas"></canvas>');
            jQuery('#player-datasets-tooltip > #tip-content').append(self.pdfCanvas);
            return PDFJS.getDocument(srcstr)
                .then(function (pdf) {
                    return pdf.getPage(1).then(function (page) {
                        self.pdfJSCurrentPage = page;
                        pdfJSRenderFirstPage(page, tipWidth, tipHeight, 'tip-pdf-canvas');
                    });
                })
                .then(function () {
                    return 'isCanvas';
                });
        }
    }

    function pdfJSRenderFirstPage(page, desiredWidth, desiredHeight, tipCanvasId) {
        $log.debug('[tooltip] pdfJSRenderFirstPage');
        var viewport = page.getViewport(1);
        var scale = desiredWidth / viewport.width;
        var scaledViewport = page.getViewport(scale);
        var canvas = document.getElementById(tipCanvasId);
        var context = canvas.getContext('2d');
        canvas.height = desiredHeight;
        canvas.width = desiredWidth;
        var renderContext = {
            canvasContext: context,
            viewport: scaledViewport,
        };
        page.render(renderContext);
    }

    function chatMsgOwner(eventData) {
        return _.isEqual(_.get($scope, '$parent.learner._id'), _.get(eventData, 'item.author'))
            ? '<i class="fa fa-reply" aria-hidden="true" style="color: rgb(81, 170, 232)"></i>'
            : '<i class="fa fa-paper-plane-o" aria-hidden="true" style="color: rgb(81, 170, 232)"></i>';
    }

    function markerFaIcon(eventData) {
        return _.isEqual('positive', _.get(eventData, 'item.obj.type'))
            ? '<i class="fa fa-circle" aria-hidden="true" style="color: #64DD17"></i> '
            : '<i class="fa fa-circle" aria-hidden="true" style="color: #D50000"></i> ';
    }

    function cancelTimer(timer, timerid, logmsg) {
        if (timer) {
            $log.debug('Canceling ', timerid, logmsg);
            utils.cancel(timerid);
        }
    }

    function calcOptimalPosition(x, y) {
        var containerWidth = self.playerDatasetsHoverDivEl.node().offsetWidth;
        var containerHeight = self.playerDatasetsHoverDivEl.node().offsetHeight;
        /* left */
        // check if outside right boundary
        var left = x - containerWidth / 2;
        var rDelta = x + containerWidth / 2 - window.innerWidth;
        left = rDelta > 0 ? left - rDelta - boundaryMarginOffset : left;
        // check if outside left boundary
        var lDelta = containerWidth / 2 - x;
        left = lDelta > 0 ? left + lDelta + boundaryMarginOffset : left;

        /* top */
        // check if outside top boundary
        var top = y - containerHeight - boundaryMarginOffset;
        var tDelta = (jQuery('#content').scrollTop() || jQuery(window).scrollTop()) - top;
        top = tDelta > 0 ? y + boundaryMarginOffset : top;

        return { top: top, left: left, isAbove: tDelta > 0 };
    }

    function finishDate(item) {
        return +new Date(_.get(item, 'finishDate'));
    }

    function getByKey(item, key) {
        return _.get(EmodashDataService, 'emotionsMetadata.' + key + '.' + item);
    }

    function _round2(val) {
        return _.round(val, 2);
    }

    function getVal(aEmotionsMeans, aEmotionsLabels) {
        return _.chain(aEmotionsMeans)
            .pick(aEmotionsLabels)
            .values()
            .sum()
            .value();
    }

    function radialChartDataElem(index, val, key) {
        return {
            x: index,
            val_0: val,
            label: getByKey('label', key),
            color: getByKey('color', key),
        };
    }

    function balanceChartData(aEmotionsMeans, aPositiveKeys, aNegativeKeys) {
        var pval = getVal(aEmotionsMeans, aPositiveKeys || ['happiness', 'surprise']);
        var nval = getVal(
            aEmotionsMeans,
            aNegativeKeys || ['contempt', 'disgust', 'fear', 'sadness', 'anger'],
        );
        return [
            {
                x: 1,
                val_0: _round2(nval),
                label: getByKey('label', 'negative'),
                color: getByKey('color', 'negative'),
            },
            {
                x: 0,
                val_0: _round2(pval),
                label: getByKey('label', 'positive'),
                color: getByKey('color', 'positive'),
            },
        ];
    }

    function radialChartData(aEmotionsMeans) {
        var data;
        if (_.size(aEmotionsMeans) > 0) {
            data = aEmotionsMeans;
        } else {
            data = [
                {
                    x: 1,
                    val_0: 0,
                    label: getByKey('label', 'fear'),
                    color: getByKey('color', 'fear'),
                },
                {
                    x: 0,
                    val_0: 0,
                    label: getByKey('label', 'sadness'),
                    color: getByKey('color', 'sadness'),
                },
                {
                    x: 2,
                    val_0: 0,
                    label: getByKey('label', 'happiness'),
                    color: getByKey('color', 'happiness'),
                },
                {
                    x: 3,
                    val_0: 0,
                    label: getByKey('label', 'surprise'),
                    color: getByKey('color', 'surprise'),
                },
                {
                    x: 4,
                    val_0: 0,
                    label: getByKey('label', 'neutral'),
                    color: getByKey('color', 'neutral'),
                },
                {
                    x: 5,
                    val_0: 0,
                    label: getByKey('label', 'anger'),
                    color: getByKey('color', 'anger'),
                },
                {
                    x: 6,
                    val_0: 0,
                    label: getByKey('label', 'disgust'),
                    color: getByKey('color', 'disgust'),
                },
                {
                    x: 7,
                    val_0: 0,
                    label: getByKey('label', 'contempt'),
                    color: getByKey('color', 'contempt'),
                },
            ];
        }

        return _.orderBy(data, 'label', 'desc');
    }

    function combineEmotionsProcessor(emotionsObj, arrayEmotionsToCombine, newKey) {
        var newVal = _.pick(emotionsObj, arrayEmotionsToCombine),
            result = _.omit(emotionsObj, arrayEmotionsToCombine);
        _.set(result, newKey, _.sum(newVal));
        return result;
    }

    function buildStreamActionKey(eventData) {
        var dataKey = [
            _.get(eventData, 'eventName'),
            _.get(eventData, 'currentTime'),
            jQuery('#content').scrollTop() || jQuery(window).scrollTop(),
            _.nth(self.sessionsIds, self.currentSessionId),
            +new Date(),
        ];
        dataKey = _.join(dataKey, '-');
        return dataKey;
    }

    function buildShowtipKey(eventData) {
        $log.debug('[emodashxApi] buildShowtipKey');
        var dataKey = [
            _.get(eventData, 'datasetKey'),
            _.get(eventData, 'itemIndex') || _.get(eventData, 'item'),
            _.get(eventData, 'event.clientX'),
            _.get(eventData, 'event.clientY'),
            jQuery('#content').scrollTop() || jQuery(window).scrollTop(),
            _.nth(self.sessionsIds, self.currentSessionId),
            +new Date(),
        ];
        dataKey = _.join(dataKey, '-');
        return dataKey;
    }

    function showtipsAccumulator(eventData) {
        $log.debug('[emodashxApi] showtipsAccumulator');
        // in order to optimize the payload we do not send a big, but a
        // string that  need to be parsed to get info
        // dataKey == datasetKey-itemIndex-clientX-clientY-scroll-spSessionId-date
        showtips.push(buildShowtipKey(eventData));
        emodashxApiBatchHandler(showtipStmt, showtips, showtipsCtxKey, showtipsTimer);
    }

    function emodashxApiBatchHandler(statement, stmtData, ctxKey, timerId) {
        if (_.size(stmtData) >= batchSize) {
            $log.debug('[emodashxApi] emodashxApiBatchHandler sending');
            emodashxApiHandler(statement, stmtData, true, ctxKey, timerId);
        }
    }

    function emodashxApiHandler(statement, aData, isNextTick, ctxKey, timerId) {
        $log.debug('[emodashxApi] emodashxApiHandler', aData, ctxKey);

        if (!aData || !ctxKey) {
            return;
        }

        var timer = _.get(self, timerId);
        if (timer) {
            cancelTimer(timer, timerId, 'there is already one');
        }
        _.set(statement, 'context.' + ctxKey, aData);
        // clean up
        aData = [];
        if (ctxKey === showtipsCtxKey) {
            showtips = [];
        } else if (ctxKey === streamActionsCtxKey) {
            streamActions = [];
        }

        if (isNextTick) {
            self[timerId] = utils.timeout(
                timerId,
                function () {
                    $log.debug('[emodashxApi] utils.timeout');
                    self.timerId = undefined;
                    // send xapi statement
                    xApi.report(statement);
                },
                0,
            );
        } else {
            $log.debug('[emodashxApi] immediate');
            // xApi.report(statement);
        }
    }
});
