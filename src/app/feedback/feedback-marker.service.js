import { module } from 'angular';
import template from './feedback.component.html';

import * as d3 from 'd3';
import * as _ from 'lodash';

export default module('app.feedback.srv', []).factory('FeedbackReportMarker', [
    function () {
        function FeedbackReportMarkerService() { }

        FeedbackReportMarkerService.prototype.resource = function (obj) {
            return obj;
        };

        FeedbackReportMarkerService.prototype.$save = function (params) { };

        FeedbackReportMarkerService.prototype.$update = function (params) { };

        FeedbackReportMarkerService.prototype.generateD3Path = function (cx, cy, radius, theta, dy) {
            theta = Math.PI * theta / 180;
            var xStart = cx + radius * Math.sin(theta);
            var yStart = cy + radius * Math.cos(theta);

            var xStop = cx - radius * Math.sin(theta);
            var yStop = yStart;

            var path =
                'M ' +
                xStart +
                ' ' +
                yStart +
                ' A ' +
                radius +
                ' ' +
                radius +
                ', 0, 1, 0, ' +
                xStop +
                ' ' +
                yStop +
                ' L ' +
                cx +
                ' ' +
                cy +
                dy;
            return path;
        };

        function generateAreaPoints(xExtend, yExtend, yTail) {
            var x = 0;
            var y = 0;
            var yCenter = y - yTail - yExtend;
            var yTop = y - yTail - 2 * yExtend;

            var points = [
                { x: x, y: y },
                { x: x + xExtend, y: yCenter },
                { x: x, y: yTop },
                { x: x - xExtend, y: yCenter },
                { x: x, y: y },
            ];
            return points;
        }

        FeedbackReportMarkerService.prototype.generateD3AreaPoints = function (ySize) {
            //Reference marker : 51, 46, 25 - that's a good shape found by Mohamed
            //which gives a 102px marker

            var refXExtend = 51;
            var refYExtend = 46;
            var refYTail = 25;
            var refYSize = 102;

            var xExtend = refXExtend * ySize / refYSize;
            var yExtend = refYExtend * ySize / refYSize;
            var yTail = refYTail * ySize / refYSize;
            return generateAreaPoints(xExtend, yExtend, yTail);
        };

        FeedbackReportMarkerService.prototype.d3Area = d3
            .area()
            .x(function (d) {
                return d.x;
            })
            .y1(function (d) {
                return d.y;
            })
            .y0(function (/*d*/) {
                return 0;
            })
            .curve(d3.curveBasis);

        FeedbackReportMarkerService.prototype.generatePlayerData = function (
            audioURL,
            runningDuration,
            markers,
            isEmodash,
        ) {
            var playerData = {
                streamURL: audioURL,
                estimateDuration: runningDuration,
                datasets: {
                    markers: _.map(markers, function (marker, iMarker) {
                        return _.extend(
                            {
                                text: iMarker + 1,
                                time: (marker.start + marker.stop) / 2,
                            },
                            marker,
                        );
                    }),
                },
                options: {
                    theme: 'dark',
                    encoding: {
                        markers: {
                            label: { show: false },
                            inline: { show: false },
                            value: { key: 'time', startkey: 'start', stopkey: 'stop' },
                            position: [
                                null, //transform is used for path symbol
                                { key: 'type', value: { positive: 29, negative: -29 } },
                            ],
                            transform: [
                                {
                                    tx: { key: 'time' },
                                    ty: { key: 'type', value: { positive: 8, negative: -8 } },
                                    theta: {
                                        key: 'type',
                                        value: { positive: null, negative: 180 },
                                    },
                                },
                                null, //position is used for icon symbol
                            ],
                            symbol: [
                                {
                                    type: 'path',
                                    value: this.d3Area(this.generateD3AreaPoints(35)),
                                },
                                { type: 'icon', key: 'text' },
                            ],
                            color: [
                                {
                                    key: 'type',
                                    value: { positive: '#4CAF50', negative: '#ff5252' },
                                },
                                { value: 'white' },
                            ],
                            cssclass: [
                                { value: 'player-clickable' },
                                { value: 'player-not-clickable player-noselect' },
                            ],
                            display: { child: true, group: 'g-player-slider' },
                            events: { click: true, mouseenter: true, mouseleave: true },
                        },
                    },
                    playerSlider: {
                        svgGroupClass: 'g-player-slider',
                        playerSliderHeight: 90,
                    },
                },
            };

            if (isEmodash) {
                _.set(playerData, 'options.encoding.markers.transform[0].ty.value', {
                    positive: 42,
                    negative: -42,
                });
                _.set(playerData, 'options.encoding.markers.position[1].value', {
                    positive: 61,
                    negative: -61,
                });
                _.set(playerData, 'options.playerSlider.playerSliderHeight', 200);
                _.set(playerData, 'options.margin', {
                    top: 0,
                    bottom: 0,
                    left: 20,
                    right: 8,
                    datasetLabelLeft: 0,
                    volumeSlider: 20,
                });

                _.set(playerData, 'options.encoding.chats', {
                    dataset: 'chats',
                    label: { show: true, text: '\uf1d7', cssclass: 'player-chats-label' },
                    inline: { show: false, cssclass: 'dataset-inline' },
                    cssclass: [
                        { value: 'player-chats' },
                        { value: 'player-chats player-noselect' },
                    ],
                    value: { startkey: 'time_from_start', stopkey: 'time_from_start' },
                    symbol: { type: 'line' },
                    datasetHeight: 20,
                    color: { key: 'key', value: { chats: 'rgb(81, 170, 232)' } },
                    events: { click: false, mouseenter: true, mouseleave: true },
                });
                _.set(playerData, 'options.encoding.docs', {
                    dataset: 'docs',
                    label: { show: true, text: '\uf15b', cssclass: 'player-docs-label' },
                    inline: { show: false, cssclass: 'dataset-inline' },
                    cssclass: [{ value: 'player-docs' }, { value: 'player-docs player-noselect' }],
                    value: { startkey: 'start', stopkey: 'stop' },
                    symbol: { type: 'line' },
                    datasetHeight: 20,
                    color: { key: 'key', value: { docs: '#dcc96b' } },
                    events: { click: false, mouseenter: true, mouseleave: true },
                });
                _.set(playerData, 'options.encoding.pos_emotions', {
                    dataset: 'pos_emotions',
                    label: { show: false },
                    inline: { show: false },
                    symbol: { type: 'stackedArea' },
                    display: { child: true, group: 'g-player-slider' },
                    yscale: { domain: [0, 100], range: [15, -15] },
                    transform: { ty: { value: 20 } },
                    color: { key: 'key', value: { happiness: '#64DD17', surprise: '#FFAB00' } },
                    cssclass: { value: 'positive-stacked-area' },
                    value: { key: 'data.timestamp' },
                });
                _.set(playerData, 'options.encoding.neg_emotions', {
                    dataset: 'neg_emotions',
                    label: { show: false },
                    inline: { show: false },
                    symbol: { type: 'stackedArea' },
                    display: { child: true, group: 'g-player-slider' },
                    yscale: { domain: [0, 100], range: [-15, 15] },
                    transform: { ty: { value: -22 } },
                    color: {
                        key: 'key',
                        value: {
                            sadness: '#00B8D4',
                            fear: '#AA00FF',
                            frustration: '#D50000',
                            disgust: '#212121',
                            contempt: '#006064',
                            anger: '#D50000',
                        },
                    },
                    cssclass: { value: 'negative-stacked-area' },
                    value: { key: 'data.timestamp' },
                });
            }
            return playerData;
        };

        return new FeedbackReportMarkerService();
    },
]);
