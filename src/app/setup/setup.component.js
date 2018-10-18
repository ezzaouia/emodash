import { module } from 'angular';
import template from './setup.component.html';

import './setup.component.scss';

class SetupController {

    constructor($log) {
        'ngInject';
        // $log.debug('SetupController');
    }

    $onInit() { }

}

const SetupComponent = {
    template,
    restricted: 'E',
    controllerAs: 'setup',
    controller: SetupController,
};

export default module('app.setup', [])
    .component('setup', SetupComponent);
