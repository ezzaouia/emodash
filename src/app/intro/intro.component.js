import { module } from 'angular';
import template from './intro.component.html';

import './intro.component.scss';

class IntroController {

    constructor ($log) {
        'ngInject';
        $log.debug('IntroController');

    }

    $onInit () { }

}

const IntroComponent = {
    template,
    restricted: 'E',
    controllerAs: 'intro',
    controller: IntroController,
};

export default module('app.intro', [])
    .component('intro', IntroComponent);
