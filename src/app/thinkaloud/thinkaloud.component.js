import { module } from 'angular';
import template from './thinkaloud.component.html';

import './thinkaloud.component.scss';

class ThinkaloudController {
    constructor($log) {
        'ngInject';
        // $log.debug('ThinkaloudController');
    }

    $onInit() {}
}

const ThinkaloudComponent = {
    template,
    restricted: 'E',
    controllerAs: 'thinkaloud',
    controller: ThinkaloudController,
};

export default module('app.thinkaloud', []).component('thinkaloud', ThinkaloudComponent);
