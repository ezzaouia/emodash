import { module } from 'angular';

import textures from 'textures';
import * as d3 from 'd3';
import jQuery from 'jquery';
import _ from 'lodash';

import controller from './radial-column.controller';
import template from './radial-column.template.html';
import './radial-column.styles.scss';

export default module('app.radialColumn', []).directive('radialColChart', function() {
    function RadialColChartController(
        $scope,
        $rootScope,
        $log,
        $timeout,
        $window,
        $element,
        $document,
    ) {
        'ngInject';
        if (this.controllerAs) {
            $scope.$parent[this.controllerAs] = this;
        }

        _.mixin({
            project: function(object, path, key) {
                return _.map(_.get(object, path), key);
            },
            pickProject: function(object, path, keys) {
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
        this.width = _.get(this.options, 'width', 230);
        this.height = _.get(this.options, 'height', 230);
        this.barHeight = _.get(this.options, 'barHeight', 40);
        this.barWidth = _.get(this.options, 'barWidth', 18);
        this.rOffset = _.get(this.options, 'rOffset', 62);

        this.spToolbarHeaderHeight = 10;
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

    RadialColChartController.prototype.ready = function() {
        angular.element(document).ready(this.checkIfReady.bind(this));
    };

    RadialColChartController.prototype.checkIfReady = function() {
        if (!this.isFixedWidthChart && this.rootDivEl.prop('offsetWidth') <= 0) {
            this.$timeout(this.checkIfReady.bind(this));
            return;
        }
        this.initSvg();
        // once ready
        this.drawDataOnceReady();
    };

    RadialColChartController.prototype.drawDataOnceReady = function() {
        var self = this;
        this.$scope.$watch(
            angular.bind(this, function() {
                return self.data;
            }),
            function(newVal /*, oldVal*/) {
                // self.$log.debug('data changed to ', newVal);
                if (newVal) {
                    self.drawData();
                    self.attachListeners();
                    self.interaction();
                }
            },
            true,
        );
    };

    RadialColChartController.prototype.initSvg = function() {
        this.width = this.isFixedWidthChart ? this.width : this.rootDivEl.prop('offsetWidth');

        // group svg
        this.svg = d3
            .select(this.$element[0])
            .select('#radial-col-chart')
            .style('height', this.height + 'px')
            .select('#radial-col-chart-svg')
            .style('height', this.height + 'px')
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .append('g')
            .classed('group-rcc', true);
    };

    RadialColChartController.prototype.buildDataset = function() {
        var yaxis = _.get(this, 'options.yaxis');
        yaxis = _.isArray(yaxis) ? _.first(yaxis) : yaxis;

        var pickedKeys = [_.get(yaxis, 'key')];

        if (_.has(_.get(yaxis, 'color'), 'key')) {
            pickedKeys.push('color');
        }
        if (_.has(_.get(yaxis, 'label'), 'key')) {
            pickedKeys.push('label');
        }
        var dataset = _.pickProject(this, 'data.' + _.get(yaxis, 'dataset'), pickedKeys);
        return [yaxis, dataset];
    };

    RadialColChartController.prototype.drawData = function() {
        var self = this;

        var color = null;
        self.arrayColors = [];
        var builtDataset = self.buildDataset();

        self.yaxis = builtDataset[0];
        self.dataset = builtDataset[1];

        var barHeight = self.barHeight;
        var barWidth = self.barWidth;
        var radius = barWidth / 2;
        var apothem = radius / Math.tan(Math.PI / self.dataset.length);
        var rOffset = self.rOffset;
        var scaleMinOffset = apothem - radius + 1.2,
            scaleMaxOffset = barHeight + radius + apothem;

        if (self.dataset.length === 2) {
            scaleMinOffset = 0;
            scaleMaxOffset = barHeight;
        }

        var yScale = d3
            .scaleLinear()
            .domain([0, 100])
            .range([scaleMinOffset, scaleMaxOffset])
            .clamp(true);

        // central group
        var groupRadialColCenter = self.svg
            .append('g')
            .classed('group-rcc-els-center', true)
            .attr('transform', self.translate(self.width / 2, self.height / 2));

        // chart element
        var groupRadialColEl = groupRadialColCenter.selectAll('.group-rcc-els').data(self.dataset);

        // background
        groupRadialColEl
            .enter()
            .append('rect')
            .attr('width', barWidth)
            .attr('height', yScale(100))
            .attr('x', -radius)
            .attr('y', 0)
            .style('fill', '#eee')
            .attr('transform', function(d, i) {
                return 'rotate(' + 360 * i / self.dataset.length + ')';
            })
            .classed('group-rcc-el-bgcol', true);

        groupRadialColEl
            .enter()
            .append('circle')
            .attr('cx', 0)
            .attr('cy', yScale(100))
            .attr('r', radius)
            .style('fill', '#eee')
            .attr('transform', function(d, i) {
                return 'rotate(' + 360 * i / self.dataset.length + ')';
            })
            .classed('group-rcc-el-bgcol', true);

        // data
        self.groupRadialColDataCircleEl = groupRadialColEl
            .enter()
            .append('circle')
            .attr('cx', 0)
            .attr('cy', function(d) {
                return yScale(_.get(d, self.yaxis.key));
            })
            .attr('r', radius)
            .style('fill', function(d) {
                return self.getField(self.yaxis.color, d);
            })
            .attr('transform', function(d, i) {
                return 'rotate(' + 360 * i / self.dataset.length + ')';
            })
            .attr('class', function(d, i) {
                return 'group-rcc-el-circle-' + i;
            })
            .classed('cursor-pointer', true);

        self.groupRadialColDataRectEl = groupRadialColEl
            .enter()
            .append('rect')
            .attr('width', barWidth)
            .attr('height', function(d) {
                return yScale(_.get(d, self.yaxis.key));
            })
            .attr('x', -radius)
            .attr('y', 0)
            .style('fill', function(d) {
                color = self.getField(self.yaxis.color, d);
                self.arrayColors.push(color);
                return self.getField(self.yaxis.color, d);
            })
            .attr('transform', function(d, i) {
                return 'rotate(' + 360 * i / self.dataset.length + ')';
            })
            .attr('class', function(d, i) {
                return 'group-rcc-el-rect-' + i;
            })
            .classed('cursor-pointer', true);

        groupRadialColEl
            .enter()
            .append('text')
            .attr('x', 0)
            .attr('y', 0)
            .attr('transform', function(d, i) {
                var theta = -2 * Math.PI * i / self.dataset.length;
                var r = barHeight + rOffset;
                return self.translate(r * Math.sin(theta), r * Math.cos(theta));
            })
            .text(function(d) {
                return self.getField(self.yaxis.label, d);
            })
            .classed('radial-column-label', true);

        self.groupRadialColCentralCircleEl = groupRadialColCenter
            .append('circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', radius / Math.sin(Math.PI / self.dataset.length) - 1)
            .style('fill', '#fff')
            .style('stroke-width', 1)
            .style('stroke', '#fff')
            .select(function() {
                return this.parentNode.appendChild(this.cloneNode(true));
            })
            .style('fill', '#eee')
            .style('stroke-width', 1)
            .style('stroke', '#fff')
            .classed('group-rcc-el-center-circle cursor-pointer', true);
    };

    RadialColChartController.prototype.interaction = function() {
        this.arrayColors.push('#eee');
        this.generateTextures(this.arrayColors);
        var radialColChart = this;
        this.currentHoveredEl = null;
        this.currentHoveredElColor = null;

        this.groupRadialColDataCircleEl
            .on('mouseleave', onMouseLeave)
            .on('mouseenter', onMouseEnter.bind(null, false));

        this.groupRadialColDataRectEl
            .on('mouseleave', onMouseLeave)
            .on('mouseenter', onMouseEnter.bind(null, false));

        this.groupRadialColCentralCircleEl
            .on('mouseleave', onMouseLeave)
            .on('mouseenter', onMouseEnter.bind(null, true));

        function onMouseEnter(isCenter, d, i) {
            // show hover tooltip
            radialColChart.hoverShow(d, i, isCenter);
            // texturize the el
            if (isCenter) {
                radialColChart.currentHoveredEl = d3
                    .select(radialColChart.$element[0])
                    .select('.group-rcc-el-center-circle');
                radialColChart.currentHoveredElColor = _.last(radialColChart.arrayColors);
                radialColChart.currentHoveredEl.style(
                    'fill',
                    _.last(radialColChart.arrayTextures).url(),
                );
            } else {
                radialColChart.currentHoveredEl = d3
                    .select(radialColChart.$element[0])
                    .selectAll('.group-rcc-el-rect-' + i + ',.group-rcc-el-circle-' + i);
                radialColChart.currentHoveredElColor = radialColChart.arrayColors[i];
                radialColChart.currentHoveredEl.style(
                    'fill',
                    radialColChart.arrayTextures[i].url(),
                );
            }
        }

        function onMouseLeave(/*d, i*/) {
            // rest hide hover tooltip and fill color
            radialColChart.hoverHide();
            radialColChart.currentHoveredEl.style('fill', radialColChart.currentHoveredElColor);
        }
    };

    RadialColChartController.prototype.hoverShow = function(d, i, isCenter) {
        var radialColChart = this;
        var key = radialColChart.yaxis.key;
        var content = '';
        var top, left;
        if (!isCenter) {
            content =
                '<span style="border-bottom: 3px solid ' +
                this.getField(this.yaxis.color, d) +
                '">' +
                this.getField(this.yaxis.label, d) +
                ' ' +
                _.get(d, this.yaxis.key) +
                '% </span>';

            left = _.get(d3, 'event.clientX', 0) - 40;
            top =
                _.get(d3, 'event.clientY', 0) +
                (jQuery('#content').scrollTop() || jQuery(window).scrollTop()) -
                this.spToolbarHeaderHeight -
                40;
        } else {
            _.each(_.orderBy(this.dataset, [key], ['desc']), function(item) {
                content +=
                    '<div id="radial-col-chart-center-tooltip" class="center-hover-tooltip"> ' +
                    '<div class="tip-item"> <i class="fa fa-circle" aria-hidden="true" style="color: ' +
                    radialColChart.getField(radialColChart.yaxis.color, item) +
                    '"></i> ' +
                    radialColChart.getField(radialColChart.yaxis.label, item) +
                    '</div>' +
                    '<div>' +
                    _.get(item, key) +
                    '% </div> ' +
                    '</div>';
            });

            top =
                _.get(d3, 'event.clientY', 0) +
                (jQuery('#content').scrollTop() || jQuery(window).scrollTop()) -
                this.spToolbarHeaderHeight;
            left = _.get(d3, 'event.clientX', 0) + 20;
        }

        this.hoverDivEl.html(content);
        this.hoverDivEl.style('display', 'block');
        this.hoverDivEl.style('top', top + 'px');
        this.hoverDivEl.style('left', left + 'px');
    };

    RadialColChartController.prototype.hoverHide = function() {
        this.hoverDivEl.html('');
        this.hoverDivEl.style('display', 'none');
    };

    /* ----------------------------
         | Helpers methods
         * ---------------------------- */

    RadialColChartController.prototype.getField = function(field, d) {
        if (_.isString(field)) {
            return field;
        }
        if (_.isObject(field)) {
            var key = _.get(field, 'key');
            var map = _.get(field, 'map');
            if (key && map) {
                return _.get(map, _.get(d, key));
            } else if (key) {
                return _.get(d, key);
            }
        }
    };

    RadialColChartController.prototype.getYAxisExtent = function(minOpt, maxOpt) {
        var radialColChart = this;
        var dataOpts = _.get(radialColChart, 'options');
        var yaxis = _.get(dataOpts, 'yaxis');
        var max = Number.NEGATIVE_INFINITY,
            maxtmp = max,
            min = Number.POSITIVE_INFINITY,
            mintmp = min;
        if (!_.isArray(yaxis)) {
            yaxis = [yaxis];
        }
        _.each(yaxis, function(item) {
            var extent = d3.extent(
                _.project(radialColChart, 'data.' + _.get(item, 'dataset'), _.get(item, 'key')),
            );
            mintmp = extent[0];
            maxtmp = extent[1];
            if (maxtmp >= max) {
                max = maxtmp;
            }
            if (mintmp <= min) {
                min = mintmp;
            }
        });
        return [minOpt || min, maxOpt || max];
    };

    RadialColChartController.prototype.translate = function(x, y) {
        return 'translate(' + x + ',' + y + ')';
    };

    RadialColChartController.prototype.resize = function() {
        this.width = this.rootDivEl.prop('offsetWidth');
        d3
            .select('#radial-col-chart-svg')
            .select('svg')
            .attr('width', this.width);
        d3.select('.group-rcc-els-center').remove();
        this.drawData();
    };

    RadialColChartController.prototype.attachListeners = function() {
        var radialColChart = this;
        if (!this.isFixedWidthChart) {
            // rerender the visu on window resize
            var resizeTimer;
            this.$window.onresize = function() {
                if (resizeTimer) {
                    radialColChart.$timeout.cancel(resizeTimer);
                    resizeTimer = undefined;
                }

                resizeTimer = radialColChart.$timeout(function() {
                    resizeTimer = undefined;
                    radialColChart.resize();
                }, 250);
            };
        }
    };

    RadialColChartController.prototype.ngSafeFcApply = function() {
        if (!this.$scope.$$phase && !this.$scope.$root.$$phase) {
            this.$scope.$digest();
        }
    };

    // once the data is here this fc will generate all the needed textures
    // in the same order as arrayColors
    RadialColChartController.prototype.generateTextures = function(arrayColors) {
        var self = this,
            t = null;
        self.arrayTextures = [];
        _.each(arrayColors, function(color) {
            t = self.textures
                .lines()
                .size(4)
                .strokeWidth(1.5)
                .stroke(color);
            self.arrayTextures.push(t);
            self.svg.call(t);
        });
    };

    var directive = {
        template,
        restricted: 'E',
        controller: RadialColChartController,
        controllerAs: 'radialColChart',
        scope: {},
        bindToController: {
            controllerAs: '@',
            data: '=',
            options: '=',
        },
    };

    return directive;
});
