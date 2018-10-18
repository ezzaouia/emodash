import { module } from 'angular';
import textures from 'textures';
import * as d3 from 'd3';
import _ from 'lodash';
import moment from 'moment/moment.js';
import 'moment-duration-format';

import template from './sessions-timeline.directive.html';
import './sessions-timeline.directive.scss';

/* global
    angular,
    document,
*/

export default module('app.sessionsTimeline', []).directive('sessionsTimelineChart', function () {
    function SessionsTimelineController(
        $scope,
        $rootScope,
        $log,
        $timeout,
        $window,
        $element,
        $stateParams,
    ) {
        if (this.controllerAs) {
            $scope.$parent[this.controllerAs] = this;
        }

        _.mixin({
            project: function (object, path, key) {
                return _.map(_.get(object, path), key);
            },
            pickProject: function (object, path, keys) {
                return _.map(_.get(object, path), _.partialRight(_.pick, keys));
            },
            mean: function (array) {
                // to change as the mean is provided by lodash v4
                return _.sum(array) / _.size(array);
            },
        });

        // ng services
        this.$log = $log;
        this.$timeout = $timeout;
        this.$window = $window;
        this.$scope = $scope;
        this.$element = $element;
        this.$rootScope = $rootScope;
        this.textures = textures;
        this.$stateParams = $stateParams;

        // chart config
        this.rootDivChartElId = '#sessions-tl-chart-root';
        //this.divChartElId = '#sessions-tl-chart';
        this.divSvgChartElId = '#sessions-tl-chart-svg';
        this.divTooltipChartElId = '#sessions-tl-chart-tooltip';
        this.groupStlcMbcClass = 'group-stlc-mbc';
        this.groupStlcMbcElClass = 'group-stlc-mbc-el';
        this.groupStlcLcClass = 'group-stlc-lc';

        this.rootDivEl = angular.element(document.querySelector(this.rootDivChartElId));
        this.hoverDivEl = d3.select(this.$element[0]).select(this.divTooltipChartElId);

        this.margin = _.get(this.options, 'margin', { top: 20, right: 20, bottom: 10, left: 20 });
        this.width = _.get(this.options, 'width', 500);
        this.height = _.get(this.options, 'height', 300);
        this.brushHeight = this.height * 0.8;
        this.brushWidth = 70;
        this.lineChartHeight = 40;
        this.tlPadding = 30;
        this.lcMbcMargin = 10;
        this.tlMbcYLabelsHeight = 30;
        this.tlMbcBarHeight = 40;
        this.tlMbcPosNegOffset = 1;

        // chart options
        this.isFixedWidthChart = this.width > 0;
        this.distortion = 10;
        this.colors = { positive: '#64DD17', negative: '#D50000' };
        this.progressActivated = false;

        // TOREMOVE
        this.learner1SessionsDates = [
            '1467716473707',
            '1467808494693',
            '1467813291894',
            '1467821508388',
            '1467845596687',
        ];

        this.datasetOptions = [];
        this.sessionsDates = [];
        this.sessionsIds = [];

        this.isRendering = true;

        this.ready();

        this.$onChanges = () => {
            if (this.data) {
                this.drawDataOnceReady();
            }
        };


    }

    SessionsTimelineController.prototype.ready = function () {
        angular.element(document).ready(this.checkIfReady.bind(this));
    };

    // once the data is here this fc will generate all the needed textures
    // in the same order as arrayColors
    SessionsTimelineController.prototype.generateTextures = function (arrayColors) {
        var self = this,
            t = null;
        self.mapTextures = {};
        _.each(arrayColors, function (color) {
            t = self.textures
                .lines()
                .size(4)
                .strokeWidth(1.5)
                .stroke(color);
            self.mapTextures[d3.color(color)] = { color: color, t: t };
            self.svg.call(t);
        });
    };

    SessionsTimelineController.prototype.checkIfReady = function () {
        if (!this.isFixedWidthChart && this.rootDivEl.prop('offsetWidth') <= 0) {
            this.$timeout(this.checkIfReady.bind(this));
            return;
        }

        /** init svg / textures */
        this.initSvg();
        this.initbrushSvg();
        this.generateTextures(_.values(this.colors));
        /** once ready */
        this.drawDataOnceReady();
    };

    SessionsTimelineController.prototype.initSvg = function () {
        this.width = this.isFixedWidthChart ? this.width : this.rootDivEl.prop('offsetWidth');

        // group svg
        this.svg = d3
            .select(this.$element[0])
            .select('#sessions-tl-chart-root')
            .style('height', this.height + 'px')
            .select(this.divSvgChartElId)
            .style('height', this.height + 11 + 'px')
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .append('g')
            .attr('transform', this.translate(this.margin.left, this.margin.top))
            .classed('group-stlc', true);
    };

    SessionsTimelineController.prototype.initbrushSvg = function () {
        // group svg
        this.brushSvg = d3
            .select(this.$element[0])
            .select('#sessions-tl-brush-chart-svg')
            .style('height', this.brushHeight + 'px')
            .append('svg')
            .attr('width', this.brushWidth)
            .attr('height', this.brushHeight)
            .append('g')
            .classed('group-stlc-brush', true);
    };

    SessionsTimelineController.prototype.drawDataOnceReady = function () {
        var self = this,
            redrawTimer,
            akey,
            keys;

        process(this.data);
        redraw();

        function process(newVal) {
            if (newVal) {
                self.orderedVals = [];
                self.orderedKeys = [];

                keys = _.keys(newVal);
                _.each(keys, function (datasetKey) {
                    akey = _.split(datasetKey, '-', 4);
                    self.datasetOptions.push({ id: akey[1], date: akey[2], max: akey[3] });
                });

                self.datasetOptions = _.orderBy(self.datasetOptions, 'date', 'asc');
                _.set(self, 'sessionsIds', _.map(self.datasetOptions, 'id'));
                _.set(self, 'sessionsDates', _.map(self.datasetOptions, 'date'));

                _.each(self.datasetOptions, function (objKey) {
                    var _key =
                        'dataset-' +
                        _.get(objKey, 'id') +
                        '-' +
                        _.get(objKey, 'date') +
                        '-' +
                        _.get(objKey, 'max');
                    self.orderedKeys.push(_key);
                    self.orderedVals.push(_.get(newVal, _key));
                });
            }
        }

        function redraw() {
            if (redrawTimer) {
                self.$timeout.cancel(redrawTimer);
                redrawTimer = undefined;
            }
            redrawTimer = self.$timeout(function () {
                redrawTimer = undefined;
                // scales
                var dataSize = _.size(self.data);
                var dataRange = d3.range(dataSize);
                self.tlScalePoint = d3
                    .scalePoint()
                    .domain(dataRange)
                    .padding(self.tlPadding);
                self.tlBrushScalePoint = d3
                    .scalePoint()
                    .domain(dataRange)
                    .padding(self.tlPadding);
                self.lcYScale = d3.scaleLinear().range([self.lineChartHeight, 0]);
                self.currentClickedIndex = _.indexOf(self.sessionsIds, self.$stateParams.reportId);

                /** draw once ready */
                self.drawDataLineChart();
                self.drawDataMirroredBarChart();
                self.drawDataBrush();
                /** interaction + listeners */
                self.interaction();
                self.listeners();
                self.lightup(self.currentClickedIndex, '#000', '#000');
                self.isRendering = false;
            }, 250);
        }
    };

    SessionsTimelineController.prototype.drawDataBrush = function () {
        var self = this;
        // constants
        var brushWidth = this.brushWidth / 2;
        var brushWidthOffset = 10;
        var brushPosNegOffset = 10;
        // build dataset
        var lineChartDataset = this.buildLineChartDataset(['positive', 'negative']);

        var posDataset = _.map(lineChartDataset, 'positive');
        var negDataset = _.map(lineChartDataset, 'negative');
        // gradient
        var defs = self.brushSvg.append('defs');

        var gradient = defs
            .append('linearGradient')
            .attr('id', 'brush-rect')
            .attr('x1', '0%')
            .attr('x2', '100%')
            .attr('y1', '0%')
            .attr('y2', '100%');

        gradient
            .append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#ff4800')
            .attr('stop-opacity', 0.9);

        gradient
            .append('stop')
            .attr('offset', '20%')
            .attr('stop-color', '#ff6c00')
            .attr('stop-opacity', 0.9);

        gradient
            .append('stop')
            .attr('offset', '80%')
            .attr('stop-color', '#FFC200')
            .attr('stop-opacity', 0.9);

        gradient
            .append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#ffe500')
            .attr('stop-opacity', 0.9);

        // scales
        this.tlBrushScalePoint.range([0, this.brushHeight]);
        var max = _.max([_.max(posDataset), _.max(negDataset)]);
        var yPosScale = d3
            .scaleLinear()
            .domain([0, max])
            .range([brushWidth / 2 - brushPosNegOffset, 0]);
        var yNegScale = d3
            .scaleLinear()
            .domain([0, max])
            .range([brushWidth / 2 + brushPosNegOffset, brushWidth]);
        // brush
        var redrawTimer;
        var brush = d3
            .brushY()
            .extent([[0, 0], [brushWidth + brushWidthOffset, this.brushHeight]])
            .on('start brush end', brushed.bind(this));

        var chart = [
            {
                datum: _.zip(posDataset, this.tlBrushScalePoint.domain()),
                fill: 'none',
                texture: d3.color('#64DD17'),
                stroke: '#64DD17',
                xScale: this.tlBrushScalePoint,
                yScale: yPosScale,
            },
            {
                datum: _.zip(negDataset, this.tlBrushScalePoint.domain()),
                fill: 'none',
                texture: d3.color('#D50000'),
                stroke: '#D50000',
                xScale: this.tlBrushScalePoint,
                yScale: yNegScale,
            },
        ];

        var groupStlcBrushEl = self.brushSvg
            .append('g')
            .classed(this.groupStlcLcClass + '-brush', true);

        _.each(chart, function (item) {
            groupStlcBrushEl
                .append('polyline')
                .attr('points', self.generatePolyline(item.xScale, item.yScale, item.datum))
                .style('fill', self.mapTextures[item.texture].t.url())
                .attr('transform', function () {
                    return 'rotate(90) translate(0 ' + (-self.brushWidth + brushWidth / 2) + ')';
                })
                .select(function () {
                    return this.parentNode.appendChild(this.cloneNode(true));
                })
                .attr('points', self.generatePolyline(item.xScale, item.yScale, item.datum, false))
                .style('fill', item.fill)
                .style('stroke', item.stroke);
        });

        _.each(this.tlBrushScalePoint.domain(), function (i /*, index*/) {
            groupStlcBrushEl
                .append('circle')
                .attr('cx', brushWidth)
                .attr('cy', self.tlBrushScalePoint(i))
                .attr('r', 2)
                .style('fill', '#777');
        });

        var brushRecMax = _.min([4, _.size(this.tlBrushScalePoint.domain()) - 1]); // show the brush up to 5 session
        self.brushSvg
            .append('g')
            .attr('class', 'brush')
            .attr('transform', function () {
                return 'translate(' + (brushWidth - 45 / 2) + ' 0)'; // 45 is the default brush with here
            })
            .call(brush)
            .call(brush.move, [
                self.tlBrushScalePoint(0) - brushPosNegOffset,
                self.tlBrushScalePoint(brushRecMax) + brushPosNegOffset,
            ]);

        self.brushSvg
            .selectAll('.handle--n,.handle--s')
            .style('stroke', 'deepskyblue')
            .style('fill', 'deepskyblue')
            .attr('rx', 5)
            .attr('ry', 5);

        self.brushSvg.select('.selection').style('fill', 'url(#brush-rect)');

        function brushed() {
            if (d3.event.sourceEvent && d3.event.sourceEvent.type === 'zoom') {
                return;
            }
            self.progressActivated = true;
            self.ngSafeFcApply();
            var selection = d3.event.selection || self.tlBrushScalePoint.range();

            // compute scale point invert inspired from
            // https://stackoverflow.com/questions/40573630/how-can-i-implement-an-invert-function-for-a-point-scale
            var selectionInvert;
            if (redrawTimer) {
                self.$timeout.cancel(redrawTimer);
                redrawTimer = undefined;
            }
            redrawTimer = self.$timeout(function () {
                self.progressActivated = false;
                redrawTimer = undefined;
                selectionInvert = scalePointPosition(selection);
                if (
                    !selectionInvert ||
                    _.size(selectionInvert) <= 0 ||
                    (_.size(selectionInvert) >= 2 && selectionInvert[0] === selectionInvert[1])
                ) {
                    self.tlScalePoint.domain([]);
                    self.removeCharts();
                    return;
                } else {
                    // update main scale
                    self.tlScalePoint.domain(_.range(selectionInvert[0], selectionInvert[1]));
                }
                // redraw chart
                self.removeCharts();
                self.drawDataLineChart();
                self.drawDataMirroredBarChart();
            }, 250);
        }

        function scalePointPosition(selection) {
            var domain = self.tlBrushScalePoint.domain();
            var range = self.tlBrushScalePoint.range();
            var rangePoints = d3.range(range[0], range[1], self.tlBrushScalePoint.step());
            return [
                domain[d3.bisect(rangePoints, selection[0]) - 1],
                domain[d3.bisect(rangePoints, selection[1]) - 1]
                    ? domain[d3.bisect(rangePoints, selection[1]) - 1]
                    : _.size(domain),
            ];
        }
    };

    SessionsTimelineController.prototype.removeCharts = function () {
        d3
            .select(this.$element[0])
            .select('.' + this.groupStlcLcClass)
            .remove();
        d3
            .select(this.$element[0])
            .select('.' + this.groupStlcMbcClass)
            .remove();
    };

    SessionsTimelineController.prototype.drawDataLineChart = function () {
        this.$log.debug('SessionsTimelineController drawDataLineChart');
        var self = this;
        // constants
        var xOffset = 10;
        var yOffset = 5;
        var tlSPDomain = this.tlScalePoint.domain();
        // build lc dataset
        var lineChartDataset = this.buildLineChartDataset(['positive', 'negative']);
        var posDataset = _.map(lineChartDataset, 'positive');
        var negDataset = _.map(lineChartDataset, 'negative');

        posDataset = _.slice(posDataset, _.first(tlSPDomain), _.last(tlSPDomain) + 1);
        negDataset = _.slice(negDataset, _.first(tlSPDomain), _.last(tlSPDomain) + 1);
        var max = _.max([_.max(posDataset), _.max(negDataset)]);
        var zipPosDataset = _.zip(posDataset, tlSPDomain);
        var zipNegDataset = _.zip(negDataset, tlSPDomain);

        // update scales
        this.tlScalePoint.range([0, this.width - this.margin.left - this.margin.right]);
        this.lcYScale.domain([0, max]);

        var chart = [
            { datum: zipPosDataset, fill: 'none', texture: d3.color('#64DD17'), stroke: '#64DD17' },
            { datum: zipNegDataset, fill: 'none', texture: d3.color('#D50000'), stroke: '#D50000' },
        ];

        var groupStlcLcEl = self.svg.append('g').classed(this.groupStlcLcClass, true);

        _.each(chart, function (item) {
            groupStlcLcEl
                .append('polyline')
                .attr('points', self.generatePolyline(self.tlScalePoint, self.lcYScale, item.datum))
                .style('fill', self.mapTextures[item.texture].t.url())
                .classed('group-stlc-el-lc-polyline', true)
                .select(function () {
                    return this.parentNode.appendChild(this.cloneNode(true));
                })
                .attr(
                    'points',
                    self.generatePolyline(self.tlScalePoint, self.lcYScale, item.datum, false),
            )
                .attr('class', 'group-stlc-el-lc-polyline-stroke')
                .style('fill', item.fill)
                .style('stroke', item.stroke);
        });

        _.each(this.tlScalePoint.domain(), function (i, index) {
            groupStlcLcEl
                .append('line')
                .attr('x2', self.tlScalePoint(i))
                .attr('x1', self.tlScalePoint(i))
                .attr('y1', self.lcYScale.range()[0])
                .attr('y2', self.lcYScale.range()[1] - yOffset)
                .style('stroke', '#fff')
                .style('stroke-width', 5)
                .select(function () {
                    return this.parentNode.appendChild(this.cloneNode(true));
                })
                .style('stroke-width', 1)
                .style('stroke', '#808285')
                .attr('stroke-dasharray', 2, 2);

            groupStlcLcEl
                .append('text')
                .text('' + _.round(posDataset[index], 0) + '%')
                .attr('x', self.tlScalePoint(i) + xOffset)
                .attr('y', self.lcYScale.range()[1] - yOffset)
                .style('fill', '#64DD17')
                .classed('group-stlc-el-lc-polyline-label', true)
                .select(function () {
                    return this.parentNode.appendChild(this.cloneNode(true));
                })
                .text('' + _.round(negDataset[index], 0) + '%')
                .attr('x', self.tlScalePoint(i) - xOffset)
                .style('fill', '#D50000');
        });
    };

    SessionsTimelineController.prototype.drawDataMirroredBarChart = function () {
        this.$log.debug('SessionsTimelineController drawDataMirroredBarChart');
        var self = this;
        var yOffset = 2;
        var arrowOffset = 5;
        var labelOffset = 5;
        var tlCircleRadius = 8,
            tlDotsRadius = 3,
            tlRectHeight = 6;
        this.tlScalePoint.range([0, this.width - this.margin.left - this.margin.right]);
        var tlScalePointDomain = this.tlScalePoint.domain();
        var mbcHeight =
            this.height -
            this.margin.bottom -
            this.margin.top -
            this.lineChartHeight -
            this.lcMbcMargin -
            this.tlMbcYLabelsHeight;

        // scales
        // TODO change timescale domain to time remove scalePoint !!
        var timeScale = d3.scaleLinear().range([0, mbcHeight]);
        var yPosScoreScale = d3
            .scaleLinear()
            .domain([0, 100])
            .range([0 + this.tlMbcBarHeight - this.tlMbcPosNegOffset, 0]);
        var yNegScoreScale = d3
            .scaleLinear()
            .domain([0, 100])
            .range([this.tlMbcBarHeight + this.tlMbcPosNegOffset, 2 * this.tlMbcBarHeight]);

        var rectX = this.tlScalePoint(_.first(tlScalePointDomain)) - this.tlMbcBarHeight;
        var rectW = this.tlScalePoint(_.last(tlScalePointDomain)) - this.tlMbcBarHeight;
        var rectY =
            this.lineChartHeight +
            this.lcMbcMargin +
            this.tlMbcYLabelsHeight / 2 -
            tlRectHeight / 2;
        var arrowY = rectY + tlRectHeight / 2,
            arrowX = rectW + rectX + 2,
            rectArrowOffset = 7;

        var groupStlcMbc = this.svg.append('g').classed(this.groupStlcMbcClass, true);

        var groupStlcMbcEl = groupStlcMbc
            .selectAll('.' + this.groupStlcMbcElClass)
            .data(self.orderedVals);

        groupStlcMbc
            // timeline rectangle
            .append('rect')
            .attr('x', rectX)
            .attr('y', rectY)
            .attr('width', rectW)
            .attr('height', tlRectHeight)
            .style('fill', '#eee')
            .select(function () {
                return this.parentNode;
            })
            .append('path')
            .attr(
                'd',
                'M ' +
                (arrowX - rectArrowOffset) +
                ' ' +
                (arrowY - rectArrowOffset) +
                ' ' +
                arrowX +
                ' ' +
                arrowY +
                ' ' +
                (arrowX - rectArrowOffset) +
                ' ' +
                (arrowY + rectArrowOffset),
        )
            .style('fill', 'none')
            .style('stroke', '#eee')
            .style('stroke-width', 2);

        groupStlcMbcEl
            .enter()
            .append('g')
            .classed('group-session-holder', true)
            .attr('transform', function (d, i) {
                if (!self.tlScalePoint(i)) {
                    d3.select(this).remove();
                    return;
                }
                return self.translate(
                    self.tlScalePoint(i),
                    self.lineChartHeight + self.lcMbcMargin + self.tlMbcYLabelsHeight,
                );
            });

        d3
            .select(this.$element[0])
            .select(this.rootDivChartElId)
            .selectAll('.group-session-holder')
            // timeline labls
            .append('text')
            .attr('y', labelOffset - this.tlMbcYLabelsHeight)
            .text(function (d, i) {
                return moment(self.sessionsDates[self.tlScalePoint.domain()[i]], 'x').format(
                    'DD/MMM',
                );
            })
            .classed('group-stlc-mbc-el-tl-label', true)
            // timeline circles
            .select(function () {
                return this.parentNode;
            })
            .append('circle')
            .attr('r', tlCircleRadius)
            .attr('cy', -this.tlMbcYLabelsHeight / 2)
            .style('fill', '#fff')
            .style('stroke', '#eee')
            .style('stroke-width', 2)
            .attr('class', function (d, i) {
                return (
                    'group-stlc-mbc-el-tl-circle ' + 'el-tl-circle-' + self.tlScalePoint.domain()[i]
                );
            })
            // timeline dots
            .select(function () {
                return this.parentNode.appendChild(this.cloneNode(true));
            })
            .attr('r', tlDotsRadius)
            .style('fill', '#fff')
            .style('stroke', 'none')
            .attr('class', function (d, i) {
                return 'group-stlc-mbc-el-tl-dot ' + 'el-tl-dot-' + self.tlScalePoint.domain()[i];
            })
            // rectangles
            .select(function () {
                return this.parentNode;
            })
            .append('rect')
            .attr('x', -self.tlMbcBarHeight)
            .attr('width', 2 * self.tlMbcBarHeight)
            .attr('height', mbcHeight + yOffset + 3)
            .style('fill', '#eee')
            .attr('y', -yOffset)
            // lines
            .select(function () {
                return this.parentNode;
            })
            .append('line')
            .attr('y2', mbcHeight + yOffset + 3)
            .attr('stroke-dasharray', 2, 2)
            .style('stroke-width', 1)
            .style('stroke', '#808285')
            // arrows
            .select(function () {
                return this.parentNode;
            })
            .append('path')
            .attr(
                'd',
                'M ' +
                (-arrowOffset - 3) +
                ' ' +
                (mbcHeight - arrowOffset + 3) +
                ' 0 ' +
                (mbcHeight + yOffset + 3) +
                ' ' +
                (arrowOffset + 3) +
                ' ' +
                (mbcHeight - arrowOffset + 3),
        )
            .style('fill', 'none')
            .style('stroke', '#808285')
            // bars charts
            .select(function () {
                return this.parentNode;
            })
            .attr('d', function (data, index) {
                timeScale.domain([
                    0,
                    _.toNumber(
                        _.get(
                            self.datasetOptions,
                            '' + [self.tlScalePoint.domain()[index]] + '.max',
                        ),
                    ),
                ]);
                d3
                    .select(this)
                    .selectAll('.' + self.groupStlcMbcElClass + '-line')
                    .data(data)
                    .enter()
                    .append('line')
                    .attr('x1', function (d /*, i*/) {
                        return timeScale(d.timestamp);
                    })
                    .attr('x2', function (d /*, i*/) {
                        return timeScale(d.timestamp);
                    })
                    .attr('y1', yPosScoreScale(0))
                    .attr('y2', function (d /*, i*/) {
                        return yPosScoreScale(d.positive);
                    })
                    .attr('transform', function () {
                        return 'rotate(90) translate(0 ' + -self.tlMbcBarHeight + ' )';
                    })
                    .classed('lines-session', true)
                    .style('stroke', self.colors.positive)
                    .select(function () {
                        return this.parentNode.appendChild(this.cloneNode(true));
                    })
                    .attr('y1', yNegScoreScale(0))
                    .attr('y2', function (d /*, i*/) {
                        return yNegScoreScale(d.negative);
                    })
                    .style('stroke', self.colors.negative);
            });

        this.svg
            .selectAll('.group-session-holder')
            .append('rect')
            .attr('x', -self.tlMbcBarHeight)
            .attr('y', -yOffset)
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('width', 2 * self.tlMbcBarHeight)
            .attr('height', mbcHeight + yOffset + 3)
            .style('fill-opacity', 0)
            .classed('hover-mask-rect', true)
            .on('mouseenter', function (d, i) {
                var selfEl = d3.select(this);

                selfEl.style('cursor', 'pointer');
                selfEl.style('stroke', '#51addf');

                if (self.currentClickedIndex !== i) {
                    self.lightup(i, '#51addf', '#51addf');
                }
            })
            .on('click', self.onClickHandler.bind(self, true, false))
            .on('mouseleave', function (d, i) {
                var selfEl = d3.select(this);
                var parentEl = selfEl.select(function () {
                    return this.parentNode;
                });

                selfEl.style('cursor', 'default');
                selfEl.style('stroke', 'none');

                if (self.currentClickedIndex !== i) {
                    self.lightup(i, '#fff', '#eee');
                }

                timeScale.domain([
                    0,
                    _.toNumber(
                        _.get(self.datasetOptions, '' + [self.tlScalePoint.domain()[i]] + '.max'),
                    ),
                ]);

                parentEl
                    .selectAll('.lines-session')
                    .attr('x1', function (dd /*, i*/) {
                        return timeScale(dd.timestamp);
                    })
                    .attr('x2', function (dd /*, i*/) {
                        return timeScale(dd.timestamp);
                    });
            })
            .on('mousemove', function (/*d, i*/) {
                var y =
                    d3.event.y -
                    d3
                        .select(this)
                        .node()
                        .getBoundingClientRect().top;
                d3
                    .select(this)
                    .select(function () {
                        return this.parentNode;
                    })
                    .selectAll('.lines-session')
                    .attr('x1', function (dd /*, i*/) {
                        return self.fisheye(dd.timestamp, y, timeScale);
                    })
                    .attr('x2', function (dd /*, i*/) {
                        return self.fisheye(dd.timestamp, y, timeScale);
                    });
            });

        self.lightup(self.currentClickedIndex, '#000', '#000');
    };

    SessionsTimelineController.prototype.interaction = function () { };

    SessionsTimelineController.prototype.listeners = function () { };

    /* ----------------------------
         | Helpers methods
         * ---------------------------- */
    SessionsTimelineController.prototype.buildLineChartDataset = function (keys) {
        if (!_.isArray(keys)) {
            keys = [keys];
        }
        return _.map(this.orderedVals, function (datasetArray) {
            var mean = {};
            _.each(keys, function (key) {
                mean[key] = _.mean(_.map(datasetArray, key));
            });

            return mean;
        });
    };

    SessionsTimelineController.prototype.translate = function (x, y) {
        return 'translate(' + x + ',' + y + ')';
    };

    SessionsTimelineController.prototype.generatePolyline = function (
        xScale,
        yScale,
        arrayDatum,
        isZeroied,
    ) {
        //default parameter : https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters
        isZeroied = typeof isZeroied !== 'undefined' ? isZeroied : true;
        var polyline = '';
        _.each(arrayDatum, function (aVal /*, i*/) {
            polyline += ' ' + xScale(aVal[1]) + ',' + yScale(aVal[0]);
        });
        if (!isZeroied) {
            return polyline;
        }
        return (
            polyline +
            ' ' +
            xScale(_.last(arrayDatum)[1]) +
            ',' +
            yScale(0) +
            ' ' +
            xScale(_.first(arrayDatum)[1]) +
            ',' +
            yScale(0)
        );
    };

    SessionsTimelineController.prototype.fisheye = function (_, a, xSTime) {
        var x = xSTime(_),
            left = x < a,
            range = d3.extent(xSTime.range()),
            min = range[0],
            max = range[1],
            m = left ? a - min : max - a;
        if (m === 0) {
            m = max - min;
        }
        return (
            (left ? -1 : 1) * m * (this.distortion + 1) / (this.distortion + m / Math.abs(x - a)) +
            a
        );
    };

    SessionsTimelineController.prototype.ngSafeFcApply = function () {
        if (!this.$scope.$$phase && !this.$scope.$root.$$phase) {
            this.$scope.$digest();
        }
    };

    SessionsTimelineController.prototype.onClickHandler = function (isEmit, isReset, d, i) {
        if (isEmit) {
            this.$rootScope.$emit(
                'sessionsTimeline:isNavigation',
                this.sessionsIds[this.tlScalePoint.domain()[i]],
            );
        }
        this.currentClickedIndex = i;

        this.turnoff(); // turn off all
        this.lightup(i, '#000', '#000');
    };

    SessionsTimelineController.prototype.lightup = function (i, dotcolor, circlecolor) {
        i = this.tlBrushScalePoint.domain()[i];
        d3.select('.el-tl-dot-' + i).style('fill', dotcolor);
        d3.select('.el-tl-circle-' + i).style('stroke', circlecolor);
    };

    SessionsTimelineController.prototype.turnoff = function () {
        d3.selectAll('.group-stlc-mbc-el-tl-dot').style('fill', '#fff');
        d3.selectAll('.group-stlc-mbc-el-tl-circle').style('stroke', '#eee');
    };

    var directive = {
        template,
        restricted: 'E',
        controller: SessionsTimelineController,
        controllerAs: 'sessionsTimelineChart',
        scope: {},
        bindToController: {
            controllerAs: '@',
            data: '=',
            options: '=',
        },
    };

    return directive;
});
