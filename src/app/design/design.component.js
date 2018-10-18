import { module } from 'angular';
import template from './design.component.html';

// import './design.component.scss';

class DesignController {

    constructor($log) {
        'ngInject';
        // $log.debug('designController');

    }

    $onInit() { }

}

const DesignComponent = {
    template,
    restricted: 'E',
    controllerAs: 'design',
    controller: DesignController,
};

export default module('app.design', [])
    .component('design', DesignComponent);
