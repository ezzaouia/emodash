import { module } from 'angular';
import textures from 'textures';
import * as d3 from 'd3';
import _ from 'lodash';

import moment from 'moment/moment.js';
import 'moment-duration-format';

import template from './player-interaction.directive.html';
import './player-interaction.directive.scss';

// import data from './feedback-stream-interactions.json';

/* global
    angular,
    document,
    _,
*/
export default module('app.playerInteraction', [])
    .directive('playerInteraction', function () {

        function PlayerInteraction ($scope, $rootScope, $log, $timeout, $window, $element, $document) {
            'ngInject';
            if (this.controllerAs) {
                $scope.$parent[this.controllerAs] = this;
            }

            _.mixin({
                'project': function (object, path, key) {
                    return _.map(_.get(object, path), key);
                },
                'pickProject': function (object, path, keys) {
                    return _.map(_.get(object, path), _.partialRight(_.pick, keys));
                },
            });

            // ng services
            this.$log = $log;
            this.$timeout = $timeout;
            this.$window = $window;
            this.$document = $document;
            this.$scope = $scope;
            this.$element = $element;
            this.textures = textures;

            this.texture = textures
                .lines()
                .size(4)
                .strokeWidth(1.5)
                .stroke('#fff');

            // chart config
            this.rootDivEl = angular.element(document.getElementById('radial-col-chart-root'));
            this.hoverDivEl = d3.select(this.$element[0]).select('#radial-col-chart-tooltip');

            this.margin = _.get(this.options, 'margin', { top: 0, right: 0, bottom: 0, left: 0 });
            this.width = _.get(this.options, 'width', 800);
            this.height = _.get(this.options, 'height', 330);
            this.barHeight = _.get(this.options, 'barHeight', 40);
            this.barWidth = _.get(this.options, 'barWidth', 18);
            this.rOffset = _.get(this.options, 'rOffset', 62);
            this.domain = this.domain || 60; 

            this.spToolbarHeaderHeight = 0;

            // chart options
            this.isFixedWidthChart = this.width > 0;
            this.isShowRadialColChart = true;
            this.hoverStyle = {
                display: 'none',
                fontSize: '10px',
                borderRadius: '3px',
                boxShadow: '0 0 5px #999',
                padding: '10px',
                backgroundColor: '#fff',
                position: 'absolute',
                textAlign: 'center',
            };

            this.ready();
        }

        PlayerInteraction.prototype.ready = function () {
            angular.element(document).ready(this.checkIfReady.bind(this));
        };

        PlayerInteraction.prototype.checkIfReady = function () {
            if (!this.isFixedWidthChart && this.rootDivEl.prop('offsetWidth') <= 0) {
                this.$timeout(this.checkIfReady.bind(this));
                return;
            }
            this.initSvg();
            this.setup();
            // once ready
            this.drawDataOnceReady();
        };

        PlayerInteraction.prototype.drawDataOnceReady = function () {
            let self = this;
            self.$log.debug('[interactions] data is ', self.data);
            if (self.data) {
                draw();
            }
            this.$scope.$watch(angular.bind(this, function () {
                return self.data;
            }), function (newVal, oldVal) {
                self.$log.debug('interactions data changed to ', newVal);
                if (newVal) {
                    draw();
                }
            }, true);

            function draw () {
                self.draw(); // use @drawData if u want to prepare dataset and draw
                self.attachListeners();
                self.interaction();
            }
        };

        PlayerInteraction.prototype.initSvg = function () {
            this.width = this.isFixedWidthChart ? this.width : this.rootDivEl.prop('offsetWidth');
            // group svg
            this.svg = d3.select(this.$element[0])
                .select('#player-interaction-root')
                .style('height', this.height + 'px')
                .select('#player-interaction-svg')
                .style('height', this.height + 'px')
                .append('svg')
                .attr('width', this.width)
                .attr('height', this.height)
                .append('g')
                .classed('group-player-interaction', true);

        };

        PlayerInteraction.prototype.setup = function (params) {
            let self = this;
            let colorSchemes = {
                buckets: {
                    domain: [0, 7],
                    range: ['#405A7C', '#7092C0', '#BDD9FF', '#FFA39E', '#F02C21', '#B80E05'],
                },
                goldsberry: {
                    domain: [0, 7], // max
                    range: ['#5357A1', '#6389BA', '#F9DC96', '#F0825F', '#AE2A47'],
                },
            };

            this.activeColorScheme = colorSchemes.goldsberry;

            // legend
            this.svg.selectAll('circle')
                .data(this.activeColorScheme.range)
                .enter()
                .append('circle')
                .attr('r', 10)
                .attr('cx', (d, i) => i * 25 + 50)
                .attr('cy', 30)
                .style('fill', (d, i) => d);

            this.svg.append('text')
                .attr('class', 'legend-label')
                .attr('x', 20)
                .attr('y', 33)
                .text('Low');

            this.svg.append('text')
                .attr('class', 'legend-label')
                .attr('x', 162)
                .attr('y', 33)
                .text('High');

            this.svg.append('svg:image')
                .attr('xlink:href', 'assets/icons/legend.png')
                .attr('width', 200)
                .attr('height', 150)
                .attr('x', 200)
                .attr('y', -50);


            // scales
            this.x = d3.scaleLinear()
                .domain([0, this.domain])
                .range([0, this.width]);

            this.y = d3.scaleLinear()
                .domain([0, 50])
                .range([this.height / 2, this.height / 4]);

            // scale for the width of the signature
            let minWidth = 1;
            let maxWidth = this.height / 6;
            this.w = d3.scaleLinear()
                .domain([0, 50])
                .range([minWidth, maxWidth]);

            this.colorScale = d3.scaleQuantize()
                .domain(this.activeColorScheme.domain)
                .range(this.activeColorScheme.range);

            this.offset = d3.scaleLinear()
                .domain(self.x.domain())
                .range([0, 100]);

            this.line = d3.line()
                .x(function (d) { return self.x(d.x); })
                .y(function (d) { return self.y(d.y); })
                .curve(d3.curveBasis);

            this.aarea = d3.area()
                .x(function (d) { return self.x(d.x); })
                .y0(function (d) { return self.y(d.y) - self.w(d.w); })
                .y1(function (d) { return Math.ceil(self.y(d.y)); }) // ceil and floor prevent line between areas
                .curve(d3.curveBasis);

            this.barea = d3.area()
                .x(function (d) { return self.x(d.x); })
                .y0(function (d) { return self.y(d.y) + self.w(d.w); })
                .y1(function (d) { return Math.floor(self.y(d.y)); }) // ceil and floor prevent line between areas
                .curve(d3.curveBasis);
        };

        /**
         * only prepared data
         */
        PlayerInteraction.prototype.draw = function () {
            let self = this;
            let data = this.data;

            /** generate gradient offset of our data colors */
            let colorData = [];
            _.each(data, (d) => {
                colorData.push({
                    offset: self.offset(d.x) + '%',
                    stopColor: self.colorScale(d.y),
                });
            });

            this.svg.selectAll('.area,.gradient').remove();

            /** create a linear gradient with the offset */
            this.svg.append('linearGradient')
                .attr('id', 'area-gradient')
                .attr('class', 'gradient')
                .attr('x1', '0%')
                .attr('y1', '0%')
                .attr('x2', '100%')
                .attr('y2', '0%')
                .selectAll('stop')
                .data(colorData)
                .enter()
                .append('stop')
                .attr('offset', function (d) { return d.offset; })
                .attr('stop-color', function (d) { return d.stopColor; });

            this.svg.append('path')
                .datum(data)
                .attr('class', 'area aarea')
                .attr('d', self.aarea)
                .style('fill', 'url(#area-gradient)');

            this.svg.append('path')
                .datum(data)
                .attr('class', 'area barea')
                .attr('d', self.barea)
                .style('fill', 'url(#area-gradient)');

            // this.svg.append('path')
            //     .datum(data)
            //     .attr('d', self.line)
            //     .style('stroke', '#fff')
            //     .style('fill', 'none');

        };


        PlayerInteraction.prototype.drawData = function () {
            let self = this;
            let data = this.generateData();

            /** generate gradient offset of our data colors */
            let colorData = [];
            _.each(data, (d) => {
                colorData.push({
                    offset: self.offset(d.x) + '%',
                    stopColor: self.colorScale(d.y),
                });
            });

            this.svg.selectAll('.area,.gradient').remove();

            /** create a linear gradient with the offset */
            this.svg.append('linearGradient')
                .attr('id', 'area-gradient')
                .attr('class', 'gradient')
                .attr('x1', '0%')
                .attr('y1', '0%')
                .attr('x2', '100%')
                .attr('y2', '0%')
                .selectAll('stop')
                .data(colorData)
                .enter()
                .append('stop')
                .attr('offset', function (d) { return d.offset; })
                .attr('stop-color', function (d) { return d.stopColor; });

            this.svg.append('path')
                .datum(data)
                .attr('class', 'area aarea')
                .attr('d', self.aarea)
                .style('fill', 'url(#area-gradient)');

            this.svg.append('path')
                .datum(data)
                .attr('class', 'area barea')
                .attr('d', self.barea)
                .style('fill', 'url(#area-gradient)');

            // this.svg.append('path')
            //     .datum(data)
            //     .attr('d', self.line)
            //     .style('stroke', '#fff')
            //     .style('fill', 'none');

        };

        PlayerInteraction.prototype.interaction = function () {
        };

        PlayerInteraction.prototype.hoverShow = function (d, i, isCenter) {
        };

        PlayerInteraction.prototype.hoverHide = function () {
        };

        PlayerInteraction.prototype.prepareData = function () {
            let datum = this.data;
            let timestamp;
            _.each(datum, (item) => {
                timestamp = _.get(item, 'player_action_timestamp');
                timestamp = moment(timestamp).format('DD MMM YYYY hh:mm:ss a'); //parse string
                _.set(item, 'player_action_timestamp',
                    timestamp
                );
                _.set(item, 'player_current_time',
                    _.round(_.toNumber(_.get(item, 'player_current_time')))
                );
            });

            datum = _.sortBy(datum, 'player_action_timestamp');
            datum = _.groupBy(datum, 'player_current_time');
            datum = _.mapValues(datum, combineActions);

            function combineActions (actions) {
                let array = [];
                _.each(actions, (item) => {
                    if (item.player_action !== 'seeking') {
                        array.push(item.player_action);
                    }
                });
                return _.size(array);
            }
            return datum;
        };

        PlayerInteraction.prototype.generateData = function () {
            let actionsData = this.prepareData();
            let datum = this.data;
            datum = _.sortBy(datum, 'player_action_timestamp');
            let watchedChunks = [];
            let action, time, watchedChunk = {};
            _.each(datum, (item) => {
                time = _.get(item, 'player_current_time');
                action = _.get(item, 'player_action');
                if (_.isEqual(action, 'seeked') || _.isEqual(action, 'play')) {
                    _.set(watchedChunk, 'time_from', time);
                }
                if (_.isEqual(action, 'seeking') || _.isEqual(action, 'pause') || _.isEqual(action, 'end')) {
                    _.set(watchedChunk, 'time_to', time);
                }
                if (_.has(watchedChunk, 'time_from') && _.has(watchedChunk, 'time_to') && (watchedChunk.time_to >= watchedChunk.time_from)) {
                    watchedChunk.range = _.range(watchedChunk.time_from, watchedChunk.time_to + 1);
                    watchedChunks.push(watchedChunk);
                    watchedChunk = {};
                }
            });
            watchedChunks = _.flatMap(watchedChunks, 'range');
            watchedChunks = _.groupBy(watchedChunks, Math.floor);

            let result = Array.from({ length: 60 },
                function (v, k) { return { x: k, w: _.size(_.get(watchedChunks, k, 0)), y: 0 }; });

            _.each(result, (item) => {
                item.y = _.get(actionsData, item.x, 0);
            });

            result = _.sortBy(result, 'x');

            return result;
        };

        /* ----------------------------
         | Helpers methods
         * ---------------------------- */

        PlayerInteraction.prototype.getField = function (field, d) {
            if (_.isString(field)) { return field; }
            if (_.isObject(field)) {
                let key = _.get(field, 'key');
                let map = _.get(field, 'map');
                if (key && map) {
                    return _.get(map, _.get(d, key));
                } else if (key) {
                    return _.get(d, key);
                }
            }
        };

        PlayerInteraction.prototype.getYAxisExtent = function (minOpt, maxOpt) {
        };

        PlayerInteraction.prototype.translate = function (x, y) {
            return 'translate(' + x + ',' + y + ')';
        };

        PlayerInteraction.prototype.resize = function () {
        };

        PlayerInteraction.prototype.attachListeners = function () {
        };

        PlayerInteraction.prototype.ngSafeFcApply = function () {
            if (!this.$scope.$$phase && !this.$scope.$root.$$phase) {
                this.$scope.$digest();
            }
        };

        // once the data is here this fc will generate all the needed textures
        // in the same order as arrayColors
        PlayerInteraction.prototype.generateTextures = function (arrayColors) {
        };

        PlayerInteraction.prototype.onStreamDataAvailable = function () {
            let self = this;
            this.stream.addEventListener('seeking', function () {
                self.$log.debug('addEventListener seeking');
            });
        };

        let directive = {
            template,
            restricted: 'E',
            controller: PlayerInteraction,
            controllerAs: 'interaction',
            scope: {},
            bindToController: {
                controllerAs: '@',
                data: '=',
                options: '=',
                domain: '='
            },
        };

        return directive;
    });
