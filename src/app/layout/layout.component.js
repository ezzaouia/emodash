import { module } from 'angular';
import * as _ from 'lodash';

import template from './layout.component.html';

import './layout.component.scss';

const allSessionsInfo = require('../code/common/sessions_info.json');

class LayoutController {
    constructor($log, $state, $stateParams, $rootScope, $timeout) {
        'ngInject';

        $log.debug('LayoutController');
        this.$state = $state;
        this.$log = $log;
        this.$rootScope = $rootScope;
        this.$timeout = $timeout;

        this.sidebarItems = [
            'demo',
            'setup',
            'data',
            'design',
            'visualizations',
            'emodash',
            'statistical analysis',
            'think-aloud',
        ];

        this.section = _.replace($state.$current.name, 'layout.', '');
        this.sessionsInfo = allSessionsInfo;
        this.coach = '';
    }

    uiSref(section) {
        this.isStateChangeStart = true;
        this.$timeout(() => {
            this.isStateChangeStart = false;
            this.$state.go('layout.' + section);
        }, 1500);
    }

    $onInit() {
        this.uiSref('demo');
    }
}

const LayoutComponent = {
    template,
    restricted: 'E',
    controllerAs: 'layout',
    controller: LayoutController,
};

export default module('app.layout', []).component('layout', LayoutComponent);
