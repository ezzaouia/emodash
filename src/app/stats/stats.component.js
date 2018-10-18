import { module } from 'angular';
import template from './stats.component.html';

import './stats.component.scss';

class StatsController {

    constructor($log) {
        'ngInject';
        // $log.debug('statsController');
    }

    $onInit() { }

}

const StatsComponent = {
    template,
    restricted: 'E',
    controllerAs: 'stats',
    controller: StatsController,
};

export default module('app.stats', [])
    .component('stats', StatsComponent);
