import { module } from 'angular';
import * as d3 from 'd3';
import textures from 'textures';
import * as _ from 'lodash';
import moment from 'moment/moment.js';
import 'moment-duration-format';

import jQuery from 'jquery';

import template from './player.directive.html';
import './player.directive.scss';

import EventEmitter from 'wolfy87-eventemitter';

/** moment & moment-duration-format */
/** lodash */
/** d3js */
/** textures */

export default module('player', [])
    .filter('timeDuration', function () {
        return function (streamTime) {
            return moment.duration({ seconds: streamTime }).format('mm:ss', { trim: false });
        };
    })
    .directive('player', function (ControllerUtils, $log) {
        /**
         * player-slider actions play/pause/seek/playChunk
         * volume up/down
         * ----------------------------------------------- */

        var playerSliderActions = function (player) {
            var _playChunkData = null;

            function _stopPlayChunk() {
                if (!_playChunkData) {
                    return;
                }
                _playChunkData.cleanup();
                var oldData = _playChunkData;
                _playChunkData = null;
                player.emit(
                    'playChunk:stop',
                    _.pick(oldData, 'startTime', 'stopTime', 'datasetKey', 'itemIndex'),
                );
            }

            function seek(h) {
                if (!player.stream) {
                    return;
                }
                $log.debug('seek fired');

                player.stream.currentTime = h;
                player.stream.play();

                // update the position of the track-progress & slider-circle
                d3.select('.track-progress').attr('x2', player.xScale(h));
                d3.select('.track-buffer-progress').attr('x1', player.xScale(h));
                d3
                    .select('.track-buffer-progress')
                    .attr('x2', player.xScale(player._calcBufferChunkEnd()));
                d3.select('.slider-circle').attr('cx', player.xScale(h));

                // notice scope watchers to refresh as the action
                // is initiated out angular's scope
                if (!player.$scope.$$phase) {
                    player.$scope.$digest();
                }
            }

            return {
                play: function play() {
                    if (!player.stream) {
                        return;
                    }
                    $log.debug('play fired');
                    player.stream.play();
                },
                pause: function pause() {
                    if (!player.stream) {
                        return;
                    }
                    $log.debug('pause fired');
                    _stopPlayChunk();
                    player.stream.pause();
                },
                changeVolume: function volumeUp() {
                    if (!player.stream) {
                        return;
                    }
                    $log.debug('changeVolume fired');
                    player.stream.volume = player.volume;
                },
                seek: seek,
                playChunk: function playChunk(startTime, stopTime, eventData) {
                    if (!player.stream) {
                        return;
                    }
                    $log.debug('playChunk fired', startTime, stopTime);

                    if (_playChunkData) {
                        _stopPlayChunk();
                    }

                    _playChunkData = ControllerUtils.buildContainer();

                    var event = _.extend(
                        {
                            startTime: startTime,
                            stopTime: stopTime,
                        },
                        eventData,
                    );

                    _playChunkData.startTime = startTime;
                    _playChunkData.stopTime = stopTime;
                    _playChunkData.event = event;

                    player.emit('playerStreamReport', {
                        currentTime: player.stream.currentTime,
                        eventName: 'seeking',
                    });

                    // seek
                    seek(startTime);

                    // add seeking listener to cancel play chunk if we seek outside a chunk
                    _playChunkData.on(player.stream, 'seeking', function () {
                        if (
                            player.stream.currentTime > stopTime ||
                            player.stream.currentTime < startTime
                        ) {
                            $log.debug('seeking cancel playChunk');
                            _stopPlayChunk();
                        }
                    });

                    // add timeupdate listener to stop
                    _playChunkData.on(player.stream, 'timeupdate', function () {
                        if (player.stream.currentTime > stopTime) {
                            $log.debug('playChunk stop');
                            _stopPlayChunk();

                            player.stream.pause();

                            // refresh
                            player.$scope.$digest();
                        }
                    });

                    player.emit('playChunk:start', event);
                },
                stopPlayChunk: _stopPlayChunk,
                mute: function mute() {
                    if (player.volume > 0) {
                        player.previousVolume = player.volume;
                    }
                    player.volume = 0;
                    if (player.stream) {
                        player.stream.volume = player.volume;
                    }
                    d3
                        .select('.vc-slider-track-progress')
                        .attr('x2', player.xVolumeScale(player.volume));
                    d3.select('.vc-slider-circle').attr('cx', player.xVolumeScale(player.volume));
                    if (!player.$scope.$$phase) {
                        player.$scope.$digest();
                    }
                },
                unmute: function unmute() {
                    if (player.previousVolume) {
                        player.volume = player.previousVolume;
                    } else {
                        player.volume = 0.8;
                    }
                    if (player.stream) {
                        player.stream.volume = player.volume;
                    }
                    d3
                        .select('.vc-slider-track-progress')
                        .attr('x2', player.xVolumeScale(player.volume));
                    d3.select('.vc-slider-circle').attr('cx', player.xVolumeScale(player.volume));
                    if (!player.$scope.$$phase) {
                        player.$scope.$digest();
                    }
                },
            };
        };

        /**
         * player-slider mouse events enter/move/leave dblclick
         * ------------------------------------------ */
        var playerSliderEvents = function (player) {
            return {
                mouseenter: function () {
                    // change the cursor to pointer
                    d3.select(this).style('cursor', 'pointer');
                    // show the circle
                    d3.select('.slider-circle').style('opacity', 1);
                },
                mouseleave: function () {
                    // change the cursor to default
                    d3.select(this).style('cursor', 'default');
                    // reduce the size of our line when leaving the slider to 3 pixel
                    d3
                        .selectAll('.track-cursor,.track,.track-progress,.track-buffer-progress')
                        .style('stroke-width', 3);

                    // hide the circle
                    d3.select('.slider-circle').style('opacity', 0);

                    // hide the circle track-cursor line
                    d3.select('.track-cursor').style('stroke-opacity', 0);

                    // hide the tooltip
                    d3
                        .select('#player-tooltip')
                        .style('visibility', 'hidden')
                        .html('');
                },
                mousemove: function () {
                    // increase the size of our line on hover/move to 5 pixel
                    d3
                        .selectAll('.track-cursor,.track,.track-progress,.track-buffer-progress')
                        .style('stroke-width', 5);

                    // show the circle
                    d3.select('.slider-circle').style('opacity', 1);

                    // indicate the cursor position relative to our timeline
                    // d3.mouse : coordinates relative to the container
                    d3
                        .select('.track-cursor')
                        .style('stroke-opacity', 0.5)
                        .attr('x2', player.xScale(player.xScale.invert(d3.mouse(this)[0])));

                    // display a tooltip with current duration position
                    d3
                        .select('#player-tooltip')
                        .html(player.timeDurationFilter(player.xScale.invert(d3.mouse(this)[0])))
                        .style('visibility', 'visible')
                        .style(
                            'left',
                            d3.mouse(d3.select('#player').node())[0] -
                            d3.select('#player-tooltip').node().offsetWidth / 2 +
                            'px',
                    );
                },
                dblclick: function () {
                    var event = {
                        time: player.xScale.invert(d3.mouse(this)[0]),
                    };
                    player.emit('timeline:dlbClick', event);
                },
            };
        };

        /**
         * volume slider mouse events enter/move/leave
         * duplicate of player slider see above
         * ------------------------------------------ */
        var volumeSliderEvents = function (player) {
            return {
                mouseenter: function () {
                    d3.select(this).style('cursor', 'pointer');
                },
                mouseleave: function () {
                    d3.select(this).style('cursor', 'default');
                    d3
                        .selectAll(
                            '.vc-slider-track-cursor,.vc-slider-track,.vc-slider-track-progress',
                    )
                        .style('stroke-width', 3);
                    d3.select('.vc-slider-track-cursor').style('stroke-opacity', 0);
                },
                mousemove: function () {
                    d3
                        .selectAll(
                            '.vc-slider-track-cursor,.vc-slider-track,.vc-slider-track-progress',
                    )
                        .style('stroke-width', 5);
                    d3
                        .select('.vc-slider-track-cursor')
                        .style('stroke-opacity', 0.6)
                        .attr(
                            'x2',
                            player.xVolumeScale(player.xVolumeScale.invert(d3.mouse(this)[0])),
                    );
                },
            };
        };

        function PlayerController(
            $scope,
            $timeout,
            timeDurationFilter,
            $window,
            $document,
            $translate,
        ) {
            EventEmitter.call(this); // call super constructor.

            if (this.controllerAs) {
                $scope.$parent[this.controllerAs] = this;
            }
            $scope.$on('destroy', this._shutdown.bind(this));

            // Get Player scope, contants and config
            this.$scope = $scope;
            this.$timeout = $timeout;
            this.$window = $window;
            this.$document = $document;
            this.$translate = $translate;
            this.timeDurationFilter = timeDurationFilter;
            this.renderDatasetsChange = false;
            this.volume = 0.8; // init the volume

            this.isPlaying = false;
            this.isWaiting = false;
            this.isDebug = false;

            // Attach player events and actions
            this.playerActions = playerSliderActions(this);

            // We export the actions at the root of ourselves
            var self = this;
            _.each(this.playerActions, function (fn, actionName) {
                self[actionName] = fn;
            });

            this.playerEvents = playerSliderEvents(this);
            this.volumeEvents = volumeSliderEvents(this);

            // @Mohamed 8/08/2017 This will be added in the link function this way we are
            // sure that the js and DOM elements are linked.
            // get the stream element by id client-stream : audio || video
            //this.stream = document.getElementById('client-stream');

            // make sure once the data is loaded, (i.e we can get the stream duration etc.)
            this.bInitalLayoutPerformed = false;
            this.bStreamDataAvailable = false;
            //this.stream.onloadeddata = this._onStreamDataAvailable.bind(this);

            this.gDatasets = null;
            this.mapDatasetsHeight = {};
            this.gPlayerSlider = null;

            this.bShowPlayer = false;

            var THEME_CLASS = {
                dark: 'dark-player',
                light: 'light-player',
            };

            this.UiCfg = {
                THEME: _.get(THEME_CLASS, _.get(this, 'src.options.theme'), THEME_CLASS.light),
            };

            this.$root = jQuery('#player-root');
            this.$root.addClass(this.UiCfg.THEME);

            if (this.isDebug && this.src) {
                if (!this.src.options.encoding.debugAudioBuffer) {
                    this.src.options.encoding.debugAudioBuffer = {
                        value: { startkey: 'start', stopkey: 'stop' },
                        symbol: [{ type: 'line' }],
                        color: [{ value: '#dcc96b' }],
                        cssclass: { value: 'player-debug-audio-buffer' },
                        datasetHeight: 40,
                    };
                }
            }

            angular.element(document).ready(this._checkReadyState.bind(this));
        }

        PlayerController.prototype = Object.create(EventEmitter.prototype);
        PlayerController.prototype.constructor = PlayerController;

        PlayerController.prototype._shutdown = function () { };

        PlayerController.prototype.datasetsChanged = function () {
            if (this.bInitalLayoutPerformed) {
                this.renderDatasetsChange = true;
                this._renderDatasets();
            }
        };

        PlayerController.prototype._initialLayout = function () {
            var player = this;

            this.UiCfg.MARGIN = _.extend(
                { top: 0, bottom: 0, left: 8, right: 8, datasetLabelLeft: 0, volumeSlider: 20 },
                _.get(player, 'src.options.margin', {}),
            );

            var playerTimeLineCssClasses =
                '.track,.track-buffer-progress,.track-cursor,.track-overlay,.track-progress,.vc-slider-track,.vc-slider-track-cursor,.vc-slider-track-overlay,.vc-slider-track-progress';

            var DATASETS_PLAYER_PAD = _.get(player, 'src.options.playerSliderDatasetsPad', 0);
            var PLAYER_SLIDER_HEIGHT = _.get(
                player,
                'src.options.playerSlider.playerSliderHeight',
                30,
            );
            var PLAYER_CONTROLS_HEIGHT = _.get(
                player,
                'src.options.playerSlider.playerVolumeHeight',
                40,
            );
            var VOLUME_SLIDER_WIDTH = _.get(
                player,
                'src.options.playerSlider.playerVolumeWidth',
                140,
            );

            var fixedWidth = _.get(player, 'src.options.width');
            if (!fixedWidth) {
                // rerender the visu on window resize
                var resizeTimer;
                player.$window.onresize = function () {
                    if (resizeTimer) {
                        player.$timeout.cancel(resizeTimer);
                        resizeTimer = undefined;
                    }

                    if (player.bShowPlayer) {
                        player.bShowPlayer = false;
                        player.$scope.$digest();
                    }

                    resizeTimer = player.$timeout(function () {
                        resizeTimer = undefined;
                        player._onResize();
                    }, 250);
                };
            }

            // Setup the svg width & calc the height xScale and 'g' groups
            _.each(_.get(player, 'src.options.encoding'), function (item, itDatasetKey) {
                // just set 0 to the datasets that will be rendered as child
                // i.e. without child
                if (_.get(item, 'display.child')) {
                    player.mapDatasetsHeight[itDatasetKey] = 0;
                    return;
                }

                // use the height of the dataset if exists
                // otherwise use the datasetHeight
                var dtHeight = _.get(item, 'datasetHeight');
                if (dtHeight) {
                    player.mapDatasetsHeight[itDatasetKey] = dtHeight;
                } else {
                    player.mapDatasetsHeight[itDatasetKey] = _.get(
                        player,
                        'src.options.datasetHeight',
                    );
                }
            });

            var datasetsHeight = _.sum(_.values(player.mapDatasetsHeight)) + DATASETS_PLAYER_PAD;
            var width = _.get(player, 'src.options.width', player.$root.innerWidth());
            var height =
                PLAYER_SLIDER_HEIGHT +
                datasetsHeight +
                player.UiCfg.MARGIN.top +
                player.UiCfg.MARGIN.bottom;

            var xScale = d3
                .scaleLinear()
                .domain([0, player.src.estimateDuration])
                .range([0, width - player.UiCfg.MARGIN.left - player.UiCfg.MARGIN.right])
                .clamp(true);

            // put the xScale in the controller
            player.xScale = xScale;

            // group svg
            var gSvg = d3
                .select('#player')
                .style('height', height + 'px')
                .select('#player-svg')
                .style('height', height + 'px')
                .append('svg')
                .attr('width', width)
                .attr('height', height)
                .append('g')
                .classed('g-player', true)
                .attr(
                    'transform',
                    'translate(' + player.UiCfg.MARGIN.left + ',' + player.UiCfg.MARGIN.top + ')',
            );

            // group datasets
            player.gDatasets = gSvg
                .append('g')
                .attr('transform', 'translate(0,0)')
                .classed('g-player-datasets', true);

            // group player-slider
            player.gPlayerSlider = gSvg
                .append('g')
                .attr(
                    'transform',
                    'translate(0,' + (datasetsHeight + PLAYER_SLIDER_HEIGHT / 2) + ')',
            )
                .classed(_.get(player, 'src.options.playerSlider.svgGroupClass'), true);

            // SliplayerSlider  as stream player which will handle mainly
            // play/pause/seek actions..
            var playerSlider = player.gPlayerSlider
                .append('line')
                .attr('class', 'track')
                .attr('x1', player.xScale.range()[0])
                .attr('x2', player.xScale.range()[1])
                .attr('y1', 0)
                .attr('y2', 0)
                .select(function () {
                    return this.parentNode.appendChild(this.cloneNode(true));
                })
                .attr('class', 'track-cursor')
                .select(function () {
                    return this.parentNode.appendChild(this.cloneNode(true));
                })
                .attr('class', 'track-progress')
                .select(function () {
                    return this.parentNode.appendChild(this.cloneNode(true));
                })
                .attr('class', 'track-buffer-progress')
                .select(function () {
                    return this.parentNode.appendChild(this.cloneNode(true));
                })
                .attr('class', 'track-overlay')
                .call(
                    d3
                        .drag()
                        .on('start.interrupt', function () {
                            $log.debug('[playerStreamReport] start.interrupt');
                            playerSlider.interrupt();

                            player.emit('playerStreamReport', {
                                currentTime: player.stream.currentTime,
                                eventName: 'seeking',
                            });
                        })
                        .on('start drag', function () {
                            // d3.event.x : get x  position of the mouse click
                            player._handlePlayerSliderDrag(player.xScale.invert(d3.event.x));
                        }),
            );

            this.gPlayerSlider
                .insert('circle', '.track-overlay')
                .attr('cx', player.xScale.range()[0])
                .attr('cy', 0)
                .style('opacity', 0) // show the circle only on hover
                .classed('slider-circle', true);

            // tooltip : top => + 40 == height of the tooltip + a smal pad
            d3
                .select('#player-tooltip')
                .style('visibility', 'hidden')
                .style('left', player.xScale.range()[0] + 'px')
                .style('top', -(PLAYER_SLIDER_HEIGHT / 2 + player.UiCfg.MARGIN.bottom + 40) + 'px');

            // set track-progress,track-buffer-progress to ZERO at the start
            d3
                .selectAll('.track-progress,.track-buffer-progress,.track-cursor')
                .attr('x2', player.xScale.range()[0]);

            // attach player-slider events
            playerSlider
                .on('mouseenter', player.playerEvents.mouseenter)
                .on('mouseleave', player.playerEvents.mouseleave)
                .on('mousemove', player.playerEvents.mousemove)
                .on('dblclick', player.playerEvents.dblclick);

            // adding a mini sider to control the volume
            // x volume scale
            var xVolumeScale = d3
                .scaleLinear()
                .domain([0, 1])
                .range([0, VOLUME_SLIDER_WIDTH - 2 * player.UiCfg.MARGIN.volumeSlider])
                .clamp(true);

            // put the xVolumeScale in the scope
            player.xVolumeScale = xVolumeScale;

            // volume svg
            var volumeControlGroup = d3
                .select('#volume-control-svg')
                .append('svg')
                .attr('width', 0 /*VOLUME_SLIDER_WIDTH*/)
                .attr('height', PLAYER_CONTROLS_HEIGHT)
                .append('g')
                .classed('g-player', true)
                .attr(
                    'transform',
                    'translate(' + 0 + ', ' + (PLAYER_CONTROLS_HEIGHT / 2 + 2) + ')',
            );

            var volumeControlSlider = volumeControlGroup
                .append('line')
                .attr('class', 'vc-slider-track')
                .attr('x1', xVolumeScale.range()[0])
                .attr('x2', xVolumeScale.range()[1])
                .select(function () {
                    return this.parentNode.appendChild(this.cloneNode(true));
                })
                .attr('class', 'vc-slider-track-cursor')
                .select(function () {
                    return this.parentNode.appendChild(this.cloneNode(true));
                })
                .attr('class', 'vc-slider-track-progress')
                .select(function () {
                    return this.parentNode.appendChild(this.cloneNode(true));
                })
                .attr('class', 'vc-slider-track-overlay')
                .call(
                    d3
                        .drag()
                        .on('start.interrupt', function () {
                            if (player.volume > 0) {
                                player.previousVolume = player.volume;
                            }
                            volumeControlSlider.interrupt();
                        })
                        .on('start drag', function () {
                            player._handleVolumeControlDrag(xVolumeScale.invert(d3.event.x));
                        })
                        .on('end', function () {
                            if (player.volume > 0) {
                                delete player.previousVolume;
                            }
                        }),
            );

            // set vc-slider-track-progress to ZERO at the start
            d3.select('.vc-slider-track-progress').attr('x2', xVolumeScale(player.volume));
            // hide vc-slider-track-cursor when no hover
            d3.select('.vc-slider-track-cursor').style('stroke-opacity', 0);

            volumeControlGroup
                .insert('circle', '.vc-slider-track-overlay')
                .attr('cx', xVolumeScale(player.volume))
                .classed('vc-slider-circle', true);

            // attach volume-slider events
            volumeControlSlider
                .on('mouseenter', player.volumeEvents.mouseenter)
                .on('mouseleave', player.volumeEvents.mouseleave)
                .on('mousemove', player.volumeEvents.mousemove);

            // changing the mix blend mode of the player timelines progress/overlay/cursor
            d3.selectAll(playerTimeLineCssClasses).style('mix-blend-mode', player.UiCfg.THEME);

            player.bShowPlayer = true;
            player.bInitalLayoutPerformed = true;
            if (player.bStreamDataAvailable) {
                this._onStreamDataAvailable(); //We were not ready to use the stream data but now we are
            }

            /** gradient color */
            var defs = gSvg.append('defs');
            // linear gradient
            var linearGrad = defs.append('linearGradient').attr('id', 'linear-gradient');

            var posRadialGrad = defs
                .append('radialGradient')
                .attr('id', 'pos-radial-gradient')
                .attr('cx', '25%')
                .attr('cy', '25%')
                .attr('r', '65%');
            posRadialGrad
                .append('stop')
                .attr('offset', '0%')
                .attr('stop-color', '#00E676');
            posRadialGrad
                .append('stop')
                .attr('offset', '100%')
                .attr('stop-color', '#1B5E20');

            var negRadialGrad = defs
                .append('radialGradient')
                .attr('id', 'neg-radial-gradient')
                .attr('cx', '25%')
                .attr('cy', '25%')
                .attr('r', '65%');
            negRadialGrad
                .append('stop')
                .attr('offset', '0%')
                .attr('stop-color', '#FF1744');
            negRadialGrad
                .append('stop')
                .attr('offset', '100%')
                .attr('stop-color', '#B71C1C');
        };

        PlayerController.prototype._checkReadyState = function () {
            var fixedWidth = _.get(this, 'src.options.width');
            if (fixedWidth) {
                $log.debug('Ready via fixed with');
                this._initialLayout();
                return;
            }

            if (this.$root.innerWidth() <= 0) {
                //Let's try again next time
                this.$timeout(this._checkReadyState.bind(this));
                return;
            }
            this._initialLayout();
        };

        PlayerController.prototype._onStreamDataAvailable = function () {
            var player = this;
            player.bStreamDataAvailable = true;
            if (!player.bInitalLayoutPerformed) {
                return;
            }

            player.stream.volume = player.volume;

            // 1. update our scale with the real data
            // 2. render our datasets
            // 3. attach a listener to track the buffering progress
            // 4. attach a listener to track the currenTime progress when the stream is in play

            // update the domain definition of our scale
            player.xScale.domain([0, player.stream.duration]);

            function _updateBuffering() {
                // as youtube we always start the buffering from the currenTime
                d3
                    .select('.track-buffer-progress')
                    .attr('x1', player.xScale(player.stream.currentTime));
                // update the buffering
                d3
                    .select('.track-buffer-progress')
                    .attr('x2', player.xScale(player._calcBufferChunkEnd()));

                if (player.isDebug) {
                    player.src.datasets.debugAudioBuffer = [];
                    _.times(player.stream.buffered.length, function (index) {
                        player.src.datasets.debugAudioBuffer[index] = {
                            start: player.stream.buffered.start(index),
                            stop: player.stream.buffered.end(index),
                        };
                    });
                    $log.debug(
                        'player.src.datasets.debugAudioBuffer',
                        player.src.datasets.debugAudioBuffer,
                    );
                }
            }

            _updateBuffering();

            // rendering our datasets
            this._renderDatasets();

            // progress event to track the buffering
            player.stream.addEventListener('progress', function () {
                _updateBuffering();

                if (player.isDebug) {
                    player._renderDatasets();
                }
            });

            // timeupdate event to track the currentTime
            player.stream.addEventListener('timeupdate', function () {
                // set the buffering start to the currentTime
                d3
                    .select('.track-buffer-progress')
                    .attr('x1', player.xScale(player.stream.currentTime));
                // update circle & track-progress regarding the currentTime
                d3.select('.track-progress').attr('x2', player.xScale(player.stream.currentTime));
                d3.select('.slider-circle').attr('cx', player.xScale(player.stream.currentTime));
                // update the current time and duration
                d3
                    .select('#time')
                    .select('#current-time')
                    .html(player.timeDurationFilter(player.stream.currentTime));
            });

            // binding playing/play/waiting events to control stall/buffering
            // play/playing ==> flag isPlaying to TRUE and isWaiting to FALSE
            // paused/ended ==> flag isPlaying/IsWaiting to FALSE
            player.stream.addEventListener('playing', function () {
                player.isPlaying = true;
                player.isWaiting = false;
                player.$scope.$digest();
            });

            player.stream.addEventListener('play', function () {
                player.isPlaying = true;
                player.isWaiting = false;
                player.$scope.$digest();

                player.emit('playerStreamReport', {
                    currentTime: player.stream.currentTime,
                    eventName: 'play',
                });
            });

            player.stream.addEventListener('waiting', function () {
                player.isPlaying = false;
                player.isWaiting = true;
                player.$scope.$digest();
            });

            player.stream.addEventListener('pause', function () {
                player.isPlaying = false;
                player.$scope.$digest();

                player.emit('playerStreamReport', {
                    currentTime: player.stream.currentTime,
                    eventName: 'pause',
                });
            });

            player.stream.addEventListener('ended', function () {
                player.isPlaying = false;
                player.$scope.$digest();

                player.emit('playerStreamReport', {
                    currentTime: player.stream.currentTime,
                    eventName: 'ended',
                });
            });

            player.stream.addEventListener('seeked', function () {
                player.emit('playerStreamReport', {
                    currentTime: player.stream.currentTime,
                    eventName: 'seeked',
                });
            });

            // show the current time and duration
            d3
                .select('#time')
                .select('#current-time')
                .html(player.timeDurationFilter(player.stream.currentTime));
            d3
                .select('#time')
                .select('#duration')
                .html(player.timeDurationFilter(player.stream.duration));
        };

        PlayerController.prototype._onResize = function () {
            var player = this;
            // recompute the with
            var width = player.$root.innerWidth();
            // refresh our scale
            player.xScale.range([0, width - player.UiCfg.MARGIN.left - player.UiCfg.MARGIN.right]);
            // update the with of our svg
            d3
                .select('#player')
                .select('#player-svg')
                .select('svg')
                .attr('width', width);
            // update the x1,x2 of our lines (x1,y1|------------|x2,y2)
            this.gPlayerSlider
                .selectAll('.track, .track-overlay')
                .attr('x2', player.xScale.range()[1]);

            this.gPlayerSlider
                .select('.track-progress')
                .attr('x2', player.xScale(player.stream.currentTime));

            this.gPlayerSlider.select('.track-cursor').attr('x2', player.xScale.range()[0]);

            this.gPlayerSlider
                .select('.track-buffer-progress')
                .attr('x1', player.xScale(player.stream.currentTime));
            this.gPlayerSlider
                .select('.track-buffer-progress')
                .attr('x2', player.xScale(player._calcBufferChunkEnd()));

            // update the inline lines if any
            d3.selectAll('._dataset_inline_innerclass').attr('x2', player.xScale.range()[1]);
            // rerendering
            this._renderDatasets();
        };

        PlayerController.prototype._handlePlayerSliderDrag = function (h) {
            var player = this;
            // hide track-cursor when drag
            d3.select('.track-cursor').style('stroke-opacity', 0);
            // seek the player
            player.playerActions.seek(h);
        }; // handlePlayerSliderDrag

        PlayerController.prototype._handleVolumeControlDrag = function (h) {
            var player = this;
            // hide vc-slider-track-cursor when drag
            d3.select('.vc-slider-track-cursor').style('stroke-opacity', 0);
            d3.select('.vc-slider-track-progress').attr('x2', player.xVolumeScale(h));
            d3.select('.vc-slider-circle').attr('cx', player.xVolumeScale(h));

            // update the volume
            player.volume = player.xVolumeScale.invert(d3.event.x);
            player.playerActions.changeVolume();
            player.$scope.$digest();
        }; // end handleVolumeControlDrag

        // helper methods
        // this method use the D3 UPDATE pattern
        // only the delta between the old elements and new ones
        // will be rendered
        PlayerController.prototype._renderDatasets = function () {
            var player = this;
            var renderedDatasetsSelection = {};
            var datasetOption;
            var colorsToTexture = {};

            // iterate over all the datasets elements and bind the data
            // then rendered each dataset elements
            var dtsHeightCumulator = 0;

            _.each(player.src.datasets, function (itDatasetValue, itDatasetKey) {
                datasetOption = _.get(player, 'src.options.encoding.' + itDatasetKey);
                var dtHeight = _.get(player.mapDatasetsHeight, itDatasetKey);
                var gPlayerDataset = _.get(datasetOption, 'svgGroupClass')
                    ? _.get(datasetOption, 'svgGroupClass')
                    : 'g-player-' + itDatasetKey;

                // default rendering group is the dataset group
                var renderingGroupClass = '.' + gPlayerDataset;

                // check if the current dataset will be attached to another group
                // if so, change the rendering group
                if (_.get(datasetOption, 'display.child')) {
                    renderingGroupClass = '.' + _.get(datasetOption, 'display.group');
                } else if (player.gDatasets.select(renderingGroupClass).empty()) {
                    // if the rendering group is empty create a new one
                    // like so, w'll not create a new one when updating
                    player.gDatasets
                        .append('g')
                        .attr('transform', function (/*d, i*/) {
                            return 'translate(0, ' + (dtsHeightCumulator + dtHeight / 2) + ')';
                        })
                        .classed(gPlayerDataset, true);
                }

                dtsHeightCumulator += dtHeight;

                // render dataset inline if we want to as not for dataset with a display child
                // CHANGED
                if (_.get(datasetOption, 'inline.show')) {
                    addDatasetInline(
                        d3.select(renderingGroupClass),
                        player.xScale.range()[0],
                        player.xScale.range()[1],
                        _.get(datasetOption, 'inline.cssclass'),
                    );
                }

                // render dataset label if we want to
                if (_.get(datasetOption, 'label.show')) {
                    var labelWithSize = _.get(datasetOption, 'label.text');
                    if (!_.get(datasetOption, 'label.textOnly')) {
                        labelWithSize += ' (' + _.size(itDatasetValue) + ')';
                    }
                    var x = _.get(datasetOption, 'label.x', 0);
                    x += -player.UiCfg.MARGIN.left + player.UiCfg.MARGIN.datasetLabelLeft;
                    var y = _.get(datasetOption, 'label.y', 0);
                    addDatasetLabel(
                        d3.select(renderingGroupClass),
                        labelWithSize,
                        x,
                        y,
                        _.get(datasetOption, 'label.cssclass'),
                    );
                }

                // render dataset elements
                var symbols = _.get(datasetOption, 'symbol');
                if (!_.isArray(symbols)) {
                    symbols = [symbols];
                }

                var genericClickHandler, genericMouseenterHandler, genericMouseleaveHandler;
                if (_.get(datasetOption, 'events.click', true) === false) {
                    genericClickHandler = function () {
                        return null;
                    };
                } else {
                    genericClickHandler = player._onElementClickEvent.bind(
                        player,
                        datasetOption,
                        itDatasetKey,
                    );
                }
                if (_.get(datasetOption, 'events.mouseenter', false) === false) {
                    genericMouseenterHandler = function () {
                        return null;
                    };
                } else {
                    genericMouseenterHandler = player._onElementMouseEvent.bind(
                        player,
                        'mouseenter',
                        datasetOption,
                        itDatasetKey,
                    );
                }
                if (_.get(datasetOption, 'events.mouseleave', false) === false) {
                    genericMouseleaveHandler = function () {
                        return null;
                    };
                } else {
                    genericMouseleaveHandler = player._onElementMouseEvent.bind(
                        player,
                        'mouseleave',
                        datasetOption,
                        itDatasetKey,
                    );
                }

                _.each(symbols, function (symbol, iSymbol) {
                    // d3 data binding
                    var d3Key = itDatasetKey + '.' + iSymbol;
                    renderedDatasetsSelection[d3Key] = d3
                        .select(renderingGroupClass)
                        .selectAll('.dtelement-' + itDatasetKey + '-' + iSymbol)
                        .data(itDatasetValue);

                    // render dataset elements
                    switch (_.get(symbol, 'type')) {
                        case 'circle':
                            renderedDatasetsSelection[d3Key]
                                .enter()
                                .append('circle')
                                .merge(renderedDatasetsSelection[d3Key])
                                .attr('cx', getXPosition)
                                .attr('cy', getYPosition.bind(null, iSymbol))
                                .attr('r', getSymbol.bind(null, iSymbol))
                                .attr('class', function (d) {
                                    return (
                                        getCssClass(iSymbol, d) +
                                        ' dtelement-' +
                                        itDatasetKey +
                                        '-' +
                                        iSymbol
                                    );
                                })
                                .style('fill', getColor.bind(null, iSymbol))
                                .on('click', genericClickHandler);
                            break;

                        case 'line':
                            renderedDatasetsSelection[d3Key]
                                .enter()
                                .append('line')
                                .merge(renderedDatasetsSelection[d3Key])
                                .attr('x1', getStartPosition)
                                .attr('x2', getStopPosition)
                                .attr('y1', getYPosition.bind(null, iSymbol))
                                .attr('y2', getYPosition.bind(null, iSymbol)) // same as y1
                                .attr('class', function (d) {
                                    return (
                                        getCssClass(iSymbol, d) +
                                        ' dtelement-' +
                                        itDatasetKey +
                                        '-' +
                                        iSymbol
                                    );
                                })
                                .style('stroke', getColor.bind(null, iSymbol))
                                .on('click', genericClickHandler)
                                .on('mouseenter', genericMouseenterHandler)
                                .on('mouseleave', genericMouseleaveHandler);
                            break;

                        case 'icon':
                            renderedDatasetsSelection[d3Key]
                                .enter()
                                .append('text')
                                .merge(renderedDatasetsSelection[d3Key])
                                .attr('x', getXPosition)
                                .attr('y', getYPosition.bind(null, iSymbol))
                                .attr('class', function (d) {
                                    return (
                                        getCssClass(iSymbol, d) +
                                        ' dtelement-' +
                                        itDatasetKey +
                                        '-' +
                                        iSymbol
                                    );
                                })
                                .attr('text-anchor', 'middle')
                                .attr('dominant-baseline', 'central')
                                .style('fill', getColor.bind(null, iSymbol))
                                .text(getSymbol.bind(null, iSymbol))
                                .attr('transform', getTransform.bind(null, iSymbol))
                                .on('click', genericClickHandler)
                                .on('mouseenter', genericMouseenterHandler)
                                .on('mouseleave', genericMouseleaveHandler);
                            break;

                        case 'path':
                            renderedDatasetsSelection[d3Key]
                                .enter()
                                .append('path')
                                .merge(renderedDatasetsSelection[d3Key])
                                .attr('d', getSymbol.bind(null, iSymbol))
                                .attr('class', function (d) {
                                    return (
                                        getCssClass(iSymbol, d) +
                                        ' dtelement-' +
                                        itDatasetKey +
                                        '-' +
                                        iSymbol
                                    );
                                })
                                .style('fill', getColor.bind(null, iSymbol))
                                .style('opacity', 0.9)
                                .attr('transform', getTransform.bind(null, iSymbol))
                                .on('click', genericClickHandler)
                                .on('mouseenter', genericMouseenterHandler)
                                .on('mouseleave', genericMouseleaveHandler);
                            break;

                        case 'stackedArea':
                            var stack = d3.stack();
                            var domain = _.get(datasetOption, 'yscale.domain');
                            var range = _.get(datasetOption, 'yscale.range');
                            var cssclass = _.get(datasetOption, 'cssclass.value');
                            var value = _.get(datasetOption, 'value.key');

                            d3.selection.prototype.first = function () {
                                return d3.select(
                                    this.nodes()[0]
                                );
                            };

                            d3.selection.prototype.last = function () {
                                return d3.select(
                                    this.nodes()[this.size() - 1]
                                );
                            };

                            var lowMiddlePos = null,
                                lowMiddleNeg,
                                highMiddlePos,
                                highMiddleNeg,
                                valuesPos,
                                valuesNeg,
                                medianPos,
                                medianNeg;

                            if (!itDatasetValue.data) {
                                return;
                            }

                            _.merge(colorsToTexture, _.get(datasetOption, 'color.value'));

                            var yscale = d3
                                .scaleLinear()
                                .domain(domain)
                                .range(range);
                            var streamArea = d3
                                .area()
                                .x(function (d) {
                                    return player.xScale(_.get(d, value));
                                })
                                .y0(function (d) {
                                    return yscale(d[0]);
                                })
                                .y1(function (d) {
                                    return yscale(d[1]);
                                })
                                .curve(d3.curveBasis);

                            d3.select(renderingGroupClass)
                                .selectAll('.' + cssclass)
                                .remove();

                            stack.keys(itDatasetValue.keys);
                            const a = renderedDatasetsSelection[d3Key]
                                .data(stack(itDatasetValue.data))
                                .enter()
                                .append('g')
                                .attr('class', function (d) {
                                    return 'emotion cursor-pointer ' + _.get(d, 'key');
                                })
                                .append('path')
                                .attr('class', cssclass)
                                .attr('transform', getTransform.bind(null, iSymbol))
                                .attr('d', streamArea)
                                .style('fill', getColor.bind(null, iSymbol))
                                .on('click', function (/*d, i*/) {
                                    player.emit('playerStreamReport', {
                                        currentTime: player.stream.currentTime,
                                        eventName: 'seeking',
                                    });
                                    player._handlePlayerSliderDrag(
                                        player.xScale.invert(d3.mouse(this)[0]),
                                    );
                                })
                                .on('mouseenter', function (d /*, i*/) {
                                    var currentColor = _.get(colorsToTexture, _.get(d, 'key'));
                                    var texture = _.get(
                                        player,
                                        'colorsTexturesMap' +
                                        '.' +
                                        d3.color(currentColor) +
                                        '.' +
                                        't',
                                    );
                                    d3.select(this).style('fill', texture.url());

                                    player.emit('elementMouseEvent', {
                                        event: d3.event,
                                        datasetKey: 'emotions',
                                        item: _.get(d, 'key'),
                                        eventName: 'mouseenter',
                                    });
                                })
                                .on('mouseleave', function (d /*, i*/) {
                                    var currentColor = _.get(colorsToTexture, _.get(d, 'key'));
                                    d3.select(this).style('fill', currentColor);
                                    player.emit('elementMouseEvent', {
                                        datasetKey: 'emotions',
                                        eventName: 'mouseleave',
                                    });
                                });
                            break;

                        default:
                            break;
                    }
                    renderedDatasetsSelection[d3Key].exit().remove();
                });
            });

            function addDatasetLabel(_group, _label, _x, _y, _class) {
                _group.selectAll('.' + _class).remove();
                _group
                    .append('text')
                    .classed(_class, true)
                    .attr('x', _x)
                    .attr('y', _y)
                    .text(_label);
            }

            function addDatasetInline(_group, _x1, _x2, _class) {
                _group
                    .append('line')
                    .attr('class', _class + ' _dataset_inline_innerclass')
                    .attr('x1', _x1 + 2)
                    .attr('x2', _x2 - 2);
            }

            function getColor(iSymbol, d) {
                return getOptionField(datasetOption, 'color', iSymbol, d);
            }

            function getYPosition(iSymbol, d) {
                var position = getOptionField(datasetOption, 'position', iSymbol, d);
                return -1 * (position || 0);
            }

            function getXPosition(d) {
                return player.xScale(_.get(d, _.get(datasetOption, 'value.key')));
            }

            function getStartPosition(d) {
                return player.xScale(_.get(d, _.get(datasetOption, 'value.startkey')));
            }

            function getStopPosition(d) {
                return player.xScale(_.get(d, _.get(datasetOption, 'value.stopkey')));
            }

            function getYStartPosition(d) {
                return _.get(d, _.get(datasetOption, 'value.ystartkey'));
            }

            function getYStopPosition(d) {
                return _.get(d, _.get(datasetOption, 'value.ystopkey'));
            }

            function getSymbol(iSymbol, d) {
                return getOptionField(datasetOption, 'symbol', iSymbol, d);
            }

            function getCssClass(iSymbol, d) {
                return getOptionField(datasetOption, 'cssclass', iSymbol, d);
            }

            // for now only rotation is allowed
            function getTransform(iSymbol, d) {
                var transformField = _.get(datasetOption, 'transform');

                if (_.isArray(transformField)) {
                    transformField = transformField[iSymbol];
                }

                if (!transformField) {
                    return;
                }

                var tx = getOptionField(transformField, 'tx', -1, d); //iSymbol irrelevant here
                var ty = getOptionField(transformField, 'ty', -1, d); //iSymbol irrelevant here
                var theta = getOptionField(transformField, 'theta', 0, d);

                var translateTransform;

                if (tx || ty) {
                    ty = -1 * (ty || 0); //Harmonization with getYPosition which uses Y going up locally
                    translateTransform = 'translate(' + player.xScale(tx || 0) + ' ' + ty + ')';
                }

                if (!theta) {
                    return translateTransform;
                }

                if (translateTransform) {
                    tx = 0;
                    ty = 0;
                } else {
                    tx = getXPosition(iSymbol, d) || 0;
                    ty = getYPosition(iSymbol, d) || 0;
                }

                var rotateTransform = 'rotate(' + theta + ' ' + tx + ' ' + ty + ')';

                if (!translateTransform) {
                    return rotateTransform;
                } else {
                    return translateTransform + ' ' + rotateTransform;
                }
            }

            function getOptionField(datasetOptionFunc, optionField, iSymbol, d) {
                // get the option regarding the strategy key || value || key-value
                var optionFieldObject = _.get(datasetOptionFunc, optionField);
                if (_.isArray(optionFieldObject)) {
                    optionFieldObject = optionFieldObject[iSymbol];
                }
                var key = _.get(optionFieldObject, 'key');
                var value = _.get(optionFieldObject, 'value');

                if (key && value) {
                    return _.get(value, _.get(d, key));
                } else if (value) {
                    return value;
                } else if (key) {
                    return _.get(d, key);
                }
                return null;
            }

            if (!player.bShowPlayer) {
                player.bShowPlayer = true;
                player.$scope.$digest();
            }

            function generateTextures(colors) {
                if (!colors || !_.isObject(colors)) {
                    return;
                }
                var colorsVals = _.values(colors),
                    texture;
                colorsVals = _.uniq(colorsVals);
                _.each(colorsVals, function (color) {
                    texture = textures
                        .lines()
                        .size(4)
                        .strokeWidth(2)
                        .stroke(color)
                        .background('#fff');
                    _.set(player, 'colorsTexturesMap' + '.' + d3.color(color), {
                        color: color,
                        t: texture,
                    });
                    player.gDatasets.call(texture);
                });
            }

            // generate the needed textures
            generateTextures(colorsToTexture);
        }; // end renderDatasets

        PlayerController.prototype._onElementClickEvent = function (option, datasetKey, d, i) {
            var player = this;
            var event = {
                datasetKey: datasetKey,
                item: d,
                itemIndex: i,
            };

            player.emit('elementClick', event);

            if (event.preventDefault) {
                return;
            }

            var value = _.get(option, 'value');
            if (!value.hasOwnProperty('startkey') || !value.hasOwnProperty('stopkey')) {
                $log.debug('No start/stop');
                return;
            }
            player.playerActions.playChunk(
                _.get(d, value.startkey),
                _.get(d, value.stopkey),
                event,
            );
        };

        PlayerController.prototype._calcBufferChunkEnd = function () {
            var player = this;

            // no stream
            if (!player.stream) {
                return 0;
            }

            // Note :
            // https://developer.mozilla.org/en-US/docs/Web/API/TimeRanges - The term "normalized
            // TimeRanges object" indicates that ranges in such an object are ordered, don't overlap,
            // aren't empty, and don't touch (adjacent ranges are folded into one bigger range).

            // Note : we don't use _.times because we want to get out as fast as possible
            var nbChunks = player.stream.buffered.length;
            var currentTime = player.stream.currentTime;
            for (var iChunk = 0; iChunk < nbChunks; ++iChunk) {
                var start = player.stream.buffered.start(iChunk);

                // The start of the chunk is after us, so we are in a hole
                if (start > currentTime) {
                    return currentTime; // We use currentTime as "buffer end"
                }
                // start is before or same as currentTime
                // so let's look at end
                var end = player.stream.buffered.end(iChunk);
                // The end of this chunk is after or same as currentTime
                // so we use it
                if (end >= currentTime) {
                    return end;
                }
            }
            // If we end up here, it's because we are in a hole after all existing chunks
            return currentTime; // We use currentTime as "buffer end"
        };

        PlayerController.prototype.getCurrentTime = function () {
            if (!this.stream) {
                return 0;
            } else {
                return this.stream.currentTime;
            }
        };

        PlayerController.prototype.getDuration = function () {
            if (!this.stream) {
                return 0;
            } else {
                return this.stream.duration;
            }
        };

        PlayerController.prototype._onElementMouseEvent = function (
            eventName,
            option,
            datasetKey,
            d,
            i,
        ) {
            $log.debug('[tooltip] elementMouseEvent emit');
            this.emit('elementMouseEvent', {
                event: d3.event,
                datasetKey: datasetKey,
                item: d,
                itemIndex: i,
                eventName: eventName,
            });
        };

        PlayerController.prototype.volumeControllMouseenter = function () {
            var player = this;
            d3
                .select('#volume-control-svg')
                .select('svg')
                .transition()
                .duration(300)
                .ease(d3.easeLinear)
                .attr('width', _.get(player, 'src.options.playerSlider.playerVolumeWidth', 110));
        };

        PlayerController.prototype.volumeControllMouseleave = function () {
            d3
                .select('#volume-control-svg')
                .select('svg')
                .transition()
                .duration(300)
                .ease(d3.easeLinear)
                .attr('width', 0);
        };

        return {
            template,
            restrict: 'E',
            bindToController: {
                src: '=', //mandatory
                controllerAs: '@', //optional - desired name of our controller in parent scope
            },
            controllerAs: 'player', // As seen in the scope of our own view
            controller: PlayerController,
            transclude: true,
            link: function (scope, element, attributes, controller) {
                scope.$evalAsync(function () {
                    initClientStream();
                });

                function initClientStream() {
                    $log.debug('[initClientStream] start');
                    controller.stream = document.getElementById('client-stream');
                    if (!controller.stream) {
                        $log.debug('[initClientStream] !controller.stream');
                        controller.$timeout(initClientStream, 0);
                        return;
                    }
                    $log.debug('[initClientStream] controller.stream');
                    controller.stream.onloadeddata = controller._onStreamDataAvailable.bind(
                        controller,
                    );
                }
            },
        };
    });
