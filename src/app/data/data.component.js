import { module } from 'angular';
import template from './data.component.html';

// import './data.component.scss';

class DataController {

    constructor ($log) {
        'ngInject';
        $log.debug('DataController');
    }

    $onInit () { }
}

const DataComponent = {
    template,
    restricted: 'E',
    controllerAs: 'data',
    controller: DataController,
};

export default module('app.data', [])
    .component('data', DataComponent);
