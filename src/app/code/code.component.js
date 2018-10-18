import { module } from 'angular';
import * as _ from 'lodash';

import template from './code.component.html';
import './code.component.scss';

import blocPlyrStaticDataset from './playerInteraction/bloc-player-interactions.json';

class CodeController {

  constructor($log, $scope, $q, EmodashDataService) {
    'ngInject';
    this.$log = $log;
    this.$q = $q;
    this.$scope = $scope;
    this.EmodashRestApi = EmodashDataService.emodashDataApi;

    // intro - emodash video demo
    this.playerData = {
      streamURL: 'assets/videos/blured.mp4',
      estimateDuration: 780,
      streamMetadata: { Type: 'video', extension: 'mp4' },
      datasets: {
        pos_emotions: {},
        neg_emotions: {},
      },
      options: {
        theme: 'light',
        encoding: {
          pos_emotions: {
            dataset: 'pos_emotions',
            label: { show: false },
            inline: { show: false },
            symbol: { type: 'stackedArea' },
            display: { child: true, group: 'g-player-slider' },
            yscale: { domain: [0, 100], range: [15, -40] },
            transform: { ty: { value: 20 } },
            color: { key: 'key', value: { happiness: '#64DD17', surprise: '#FFAB00' } },
            cssclass: { value: 'positive-stacked-area' },
            value: { key: 'data.timestamp' },
          },
          neg_emotions: {
            dataset: 'neg_emotions',
            label: { show: false },
            inline: { show: false },
            symbol: { type: 'stackedArea' },
            display: { child: true, group: 'g-player-slider' },
            yscale: { domain: [0, 100], range: [-15, 40] },
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
          }
        },
        playerSlider: {
          svgGroupClass: 'g-player-slider',
          playerSliderHeight: 90,
        },
      },
    };

    // radial column data
    this.balanceChartOpts = EmodashDataService.balanceChartDataOptions;
    this.radialColChartOpts = EmodashDataService.radialColChartDataOptions;

    this.radialColChartData1 = EmodashDataService.radialColChartData1;
    this.radialColChartData2 = EmodashDataService.radialColChartData2;
    this.radialColChartData3 = EmodashDataService.radialColChartData3;
    this.radialColChartData4 = EmodashDataService.radialColChartData4;
    this.sessionsTlOptions = { width: 700 };

    // sessions timeline
    this.sessionsTlData = null;

    // player interactions
    this.domain = 1800 / 3;
    const interval = 3;
    this.interactionsJsonDataset = [];
  }

  $onInit() {
    let self = this, player;
    // player interaction
    let sessionViewPromise = this.EmodashRestApi.getStreamgraphData({ streamgraph: 'streamgraph' }).$promise
    let historyViewPromise = this.EmodashRestApi.getHistoryViewData().$promise

    this.$q.when(sessionViewPromise).then((emotionsData) => {
      this.playerData.datasets.pos_emotions = {
        data: _.map(
          emotionsData,
          _.partialRight(_.pick, ['happiness', 'surprise', 'timestamp']),
        ),
        keys: ['happiness', 'surprise'],
      };
      this.playerData.datasets.neg_emotions = {
        data: _.map(
          emotionsData,
          _.partialRight(_.pick, ['contempt', 'disgust', 'fear', 'sadness', 'anger', 'timestamp']),
        ),
        keys: ['contempt', 'disgust', 'fear', 'sadness', 'anger'],
      };

      this.$scope.player.datasetsChanged();
    });

    this.$q.when(historyViewPromise).then(data => {

      this.sessionsTlData = data;
    });

  }

}

const CodeComponent = {
  template,
  restricted: 'E',
  controllerAs: 'code',
  controller: CodeController,
};

export default module('app.code', [])
  .component('code', CodeComponent);
