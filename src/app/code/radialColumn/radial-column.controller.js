import textures from 'textures';
import * as d3 from 'd3';
import jQuery from 'jquery';
import _ from 'lodash';


/*
  global angular
  global document
  global window
*/
export default class RadialColChart {

    constructor ($log, $timeout, $element, $window) {
        'ngInject';
        this.$log = $log.getInstance(RadialColChart.name);
        this.$timeout = $timeout;
        this.$element = $element;
        this.$window = $window;
    }

    $onInit () {
        this.debug('$onInit');
        this.refreshing = true;
        this.onceReady();
        this.initialize();
        this.render()
            .renderSVG()
            .renderData()
            .events();

        this.onResize();
    }

    /** all init stuff goes here */
    initialize () {
        this.rootDiv = 'radial-col-chart';
        this.rootDivClass = `.${this.rootDiv}`;
        this.hoverDivClass = `.${this.rootDiv}-tooltip`;
        this.hoverDivElem = d3.select(this.$element[0]).select(this.hoverDivClass);

        this.margin = _.get(this.options, 'margin', { top: 0, right: 0, bottom: 0, left: 0 });
        this.width = _.get(this.options, 'width', 230);
        this.height = _.get(this.options, 'height', 230);
        this.barHeight = _.get(this.options, 'barHeight', 40);
        this.barWidth = _.get(this.options, 'barWidth', 18);
        this.rOffset = _.get(this.options, 'rOffset', 62);

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

        this.colorTexture = {};

        // some helper _ mixin
        _.mixin({
            'project': function (object, path, key) {
                return _.map(_.get(object, path), key);
            },
            'pickProject': function (object, path, keys) {
                return _.map(_.get(object, path), _.partialRight(_.pick, keys));
            },
        });
    }

    /** check if doc is ready */
    onceReady () {
        angular
            .element(document)
            .ready(this.onceReadyCallback.bind(this));
    }

    /** once doc is ready run this callback */
    onceReadyCallback () {
        if (!this.isFixedWidthChart && jQuery(this.rootDivClass).width() <= 0) {
            this.$timeout(this.onceReadyCallback.bind(this));
            return;
        }
    }

    /** rendering stuff goes here */
    render () {
        return {
            renderSVG: this.renderSVG.bind(this),
            preparData: this.preparData.bind(this),
            renderData: this.renderData.bind(this),
        };
    }

    renderSVG () {
        this.width = this.isFixedWidthChart ? this.width : jQuery(this.rootDivClass).width();
        this.svg = d3.select(this.$element[0])
            .select(this.rootDivClass)
            .style('height', this.height + 'px')
            .style('width', this.width + 'px')
            .select(`${this.rootDivClass}-svg`)
            .style('height', this.height + 'px')
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .append('g')
            .classed(`${this.rootDiv}-sg`, true);
        return this;
    }

    preparData () {
        let yaxis = _.get(this, 'options.yaxis');
        yaxis = _.isArray(yaxis) ? _.first(yaxis) : yaxis;
        let pickedKeys = [_.get(yaxis, 'key')];
        if (_.has(_.get(yaxis, 'color'), 'key')) {
            pickedKeys.push('color');
        }
        if (_.has(_.get(yaxis, 'label'), 'key')) {
            pickedKeys.push('label');
        }
        let dataset = _.pickProject(this, 'data.' + _.get(yaxis, 'dataset'), pickedKeys);
        return [yaxis, dataset];
    }

    renderData () {
        let self = this;
        self.colorToTexture = [];
        let color = null;
        let processedData = this.preparData();

        self.yaxis = processedData[0];
        self.dataset = processedData[1];

        let barHeight = self.barHeight;
        let barWidth = self.barWidth;
        let radius = barWidth / 2;
        let apothem = radius / Math.tan(Math.PI / self.dataset.length);
        let rOffset = self.rOffset;
        let scaleMinOffset = apothem - radius + 1.2, scaleMaxOffset = barHeight + radius + apothem;

        if (self.dataset.length === 2) {
            scaleMinOffset = 0;
            scaleMaxOffset = barHeight;
        }

        let yScale = d3.scaleLinear().domain([0, 100])
            .range([scaleMinOffset, scaleMaxOffset])
            .clamp(true);

        // central group
        let groupRdlClCCir = self.svg
            .append('g')
            .classed(`${this.rootDiv}-sgg`, true)
            .attr('transform', `translate(${self.width / 2}, ${self.height / 2})`);

        // chart element
        let group = groupRdlClCCir
            .selectAll(`${this.rootDiv}-sgge`)
            .data(self.dataset);

        // background
        group.enter()
            .append('rect')
            .attr('width', barWidth)
            .attr('height', yScale(100))
            .attr('x', -radius)
            .attr('y', 0)
            .style('fill', '#eee')
            .attr('transform', function (d, i) { return 'rotate(' + (360 * i / self.dataset.length) + ')'; })
            .classed(`${this.rootDiv}-sg-bgrec`, true);

        group.enter()
            .append('circle')
            .attr('cx', 0)
            .attr('cy', yScale(100))
            .attr('r', radius)
            .style('fill', '#eee')
            .attr('transform', function (d, i) { return 'rotate(' + (360 * i / self.dataset.length) + ')'; })
            .classed(`${this.rootDiv}-sg-bgcir`, true);

        // data
        self.rdlClDataCirEl = group
            .enter()
            .append('circle')
            .attr('cx', 0)
            .attr('cy', function (d) { return yScale(_.get(d, self.yaxis.key)); })
            .attr('r', radius)
            .style('fill', function (d) { return self.getField(self.yaxis.color, d); })
            .attr('transform', function (d, i) { return 'rotate(' + (360 * i / self.dataset.length) + ')'; })
            .attr('class', function (d, i) { return `sg-ink-${i}`; })
            .classed('cursor-pointer', true);

        self.rdlClDataRecEl = group
            .enter()
            .append('rect')
            .attr('width', barWidth)
            .attr('height', function (d) { return yScale(_.get(d, self.yaxis.key)); })
            .attr('x', -radius)
            .attr('y', 0)
            .style('fill', function (d) {
                color = self.getField(self.yaxis.color, d);
                self.texturize(color);
                return color;
            })
            .attr('transform', function (d, i) { return 'rotate(' + (360 * i / self.dataset.length) + ')'; })
            .attr('class', function (d, i) { return `sg-ink-${i}`; })
            .classed('cursor-pointer', true);

        group.enter()
            .append('text')
            .attr('x', 0)
            .attr('y', 0)
            .attr('transform', function (d, i) {
                let theta = -2 * Math.PI * i / self.dataset.length;
                let r = barHeight + rOffset;
                return `translate(${r * Math.sin(theta)},${r * Math.cos(theta)})`;
            })
            .text(function (d) {
                return self.getField(self.yaxis.label, d);
            })
            .classed(`${self.rootDiv}-sg-label`, true);

        self.rdlClDataCCirEl = groupRdlClCCir
            .append('circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', radius / Math.sin(Math.PI / self.dataset.length) - 1)
            .style('fill', '#fff')
            .style('stroke-width', 1)
            .style('stroke', '#fff')
            .select(function () { return this.parentNode.appendChild(this.cloneNode(true)); })
            .style('fill', '#eee')
            .style('stroke-width', 1)
            .style('stroke', '#fff')
            .classed('sg-ccir cursor-pointer', true);

        self.texturize('#eee');

        this.refreshing = false;
        return this;
    }

    resize () {
        this.width = jQuery(this.rootDivClass).width();
        d3.select(this.$element[0])
            .select(`${this.rootDivClass}-svg`)
            .select('svg')
            .attr('width', this.width)
            .select(`${this.rootDivClass}-sgg`)
            .remove();

        this.renderData();
    }

    onResize () {
        if (!this.isFixedWidthChart) {
            let resizeTimer;
            this.$window.onresize = () => {
                if (resizeTimer) {
                    this.$timeout.cancel(resizeTimer);
                    resizeTimer = undefined;
                }
                resizeTimer = this.$timeout(() => {
                    resizeTimer = undefined;
                    this.resize();
                }, 250);
            };
        }
    }

    getField (field, d) {
        if (_.isString(field)) { return field; }
        if (_.isObject(field)) {
            var key = _.get(field, 'key');
            var map = _.get(field, 'map');
            if (key && map) {
                return _.get(map, _.get(d, key));
            } else if (key) {
                return _.get(d, key);
            }
        }
    }

    /** register DOM event handlers */
    events () {
        let events = _.extend({}, {
            'sg-ink': {
                'mouseenter': {
                    h: this.handleInkMouseenter,
                    e: [this.rdlClDataRecEl, this.rdlClDataCirEl, this.rdlClDataCCirEl],
                },
                'mouseleave': {
                    h: this.handleInkMouseleave,
                    e: [this.rdlClDataRecEl, this.rdlClDataCirEl, this.rdlClDataCCirEl],
                },
            },
            'sg-ccir': {
                'mouseenter': {
                    h: this.handleCCirMouseenter,
                    e: [this.rdlClDataCCirEl],
                },
                'mouseleave': {
                    h: this.handleCCirMouseleave,
                    e: [this.rdlClDataCCirEl],
                },
            },
        });

        _.each(events, (val, key) => {
            _.each(val, (eventObj, evtName) => {
                _.each(eventObj.e, (e) => e.on(evtName, eventObj.h.bind(this, key)));
            });
        });
    }

    handleInkMouseenter (className, d, i) {
        this.hColor = _.get(d, 'color');
        this.fillTexture(`.${className}-${i}`, this.hColor).showTooltip(d, i, false);
    }

    handleInkMouseleave (className, d, i) {
        this.fillColor(`.${className}-${i}`, this.hColor).hideTooltip();
    }

    handleCCirMouseenter (className, d, i) {
        this.hColor = '#eee';
        this.fillTexture(`.${className}`, this.hColor).showTooltip(null, null, true);
    }

    handleCCirMouseleave (className, d, i) {
        this.fillColor(`.${className}`, this.hColor).hideTooltip();
    }

    fillTexture (className, color) {
        let t = _.get(this.colorTexture, d3.color(color));
        this.svg.selectAll(className).style('fill', t.url());
        return this;
    }

    fillColor (className, color) {
        this.svg.selectAll(className).style('fill', color);
        return this;
    }

    showTooltip (d, i, isCenter) {
        let self = this;
        let key = self.yaxis.key;
        let content = '';
        let top, left;
        // build content & position
        if (!isCenter) {
            content = '<span style="border-bottom: 3px solid ' + this.getField(this.yaxis.color, d) + '">' + this.getField(this.yaxis.label, d) + ' ' + _.get(d, this.yaxis.key) + '% </span>';
            left = _.get(d3, 'event.clientX', 0) - 40;
            top = _.get(d3, 'event.clientY', 0) + (jQuery('#content').scrollTop() || jQuery(window).scrollTop()) - this.spToolbarHeaderHeight - 50;
        } else {
            _.each(_.orderBy(this.dataset, [key], ['desc']), function (item) {
                content += '<div class="radial-col-chart-center-tooltip" class="center-hover-tooltip"> ' +
                    '<div> <i class="fa fa-circle" aria-hidden="true" style="color: ' + self.getField(self.yaxis.color, item) + '"></i> ' +
                    self.getField(self.yaxis.label, item) +
                    '</div>' +
                    '<div>' + _.get(item, key) + '% </div> ' +
                    '</div>';
            });

            top = _.get(d3, 'event.clientY', 0) + (jQuery('#content').scrollTop() || jQuery(window).scrollTop()) - this.spToolbarHeaderHeight;
            left = _.get(d3, 'event.clientX', 0) + 20;
        }

        this.hoverDivElem.html(content);
        this.hoverDivElem.style('display', 'block');
        this.hoverDivElem.style('top', top + 'px');
        this.hoverDivElem.style('left', left + 'px');
    }

    hideTooltip () {
        this.hoverDivElem.html('');
        this.hoverDivElem.style('display', 'none');
    }

    texturize (color) {
        let t = textures.lines().size(4).strokeWidth(1.5).stroke(color);
        this.colorTexture[d3.color(color)] = t;
        this.svg.call(t);
    }

    debug (...msg) {
        this.$log.debug(...msg);
    }
}
