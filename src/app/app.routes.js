import { module } from 'angular';

function routeConfig($urlRouterProvider, $stateProvider, $locationProvider) {
    'ngInject';

    // $locationProvider.html5Mode(true).hashPrefix('!');

    $stateProvider
        .state('layout', {
            url: '/emodash',
            component: 'layout',
        })
        .state('layout.demo', {
            url: '/demo',
            component: 'intro',
        })
        .state('layout.visualizations', {
            url: '/visualizations',
            component: 'code',
        })
        .state('layout.emodash', {
            url: '/feedback',
            component: 'feedback',
        })
        .state('layout.setup', {
            url: '/setup',
            component: 'setup',
        })
        .state('layout.data', {
            url: '/data',
            component: 'data',
        })
        .state('layout.design', {
            url: '/design',
            component: 'design',
        })
        .state('layout.statistical analysis', {
            url: '/stats',
            component: 'stats',
        })
        .state('layout.think-aloud', {
            url: '/thinkaloud',
            component: 'thinkaloud',
        });

    $urlRouterProvider.otherwise('/emodash');
}

export default module('app.routes', ['ui.router']).config(routeConfig);
