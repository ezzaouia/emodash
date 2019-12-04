import { module } from 'angular';

import AppTheme from './app.theme';
import AppRoutes from './app.routes';

import EventUtils from './code/common/event-utils.service';
import EmodashDataService from './code/common/emodash-data.service';
import NgScopeApply from './code/common/ng-scope-apply.service';

import Layout from './layout/layout.component';
import Code from './code/code.component';
import Intro from './intro/intro.component';
import Setup from './setup/setup.component';
import Data from './data/data.component';
import Design from './design/design.component';
import Stats from './stats/stats.component';
import Thinkaloud from './thinkaloud/thinkaloud.component';
import Player from './code/player/player.directive';
import RadialColumn from './code/radialColumn/radial-column.directive';
import SessionsTimeline from './code/sessionsTimeline/sessions-timeline.directive';
import PlayerInteraction from './code/playerInteraction/player-interaction.directive';

import FeedbackReports from './feedback/helpers/feedback-reports.service';
import FeedbackController from './feedback/feedback.controller';
import EmodashController from './feedback/emodash.controller';
import FeedbackService from './feedback/feedback-marker.service';
import FeedbackComponent from './feedback/feedback.component';

import './app.component.scss';

export default module('app', [
    'ngMaterial',
    'angular-logger',
    'pascalprecht.translate',
    AppTheme.name,
    AppRoutes.name,

    EventUtils.name,
    EmodashDataService.name,
    NgScopeApply.name,

    Layout.name,
    Code.name,
    Intro.name,
    Setup.name,
    Data.name,
    Design.name,
    Stats.name,
    Player.name,
    Thinkaloud.name,
    RadialColumn.name,
    SessionsTimeline.name,
    PlayerInteraction.name,

    FeedbackReports.name,
    FeedbackService.name,
    EmodashController.name,
    FeedbackController.name,
    FeedbackComponent.name,
])
    .component('app', {
        template: `<md-content ng-cloak>
                    <div ui-view></div>
               </md-content>`,
        restrict: 'E',
    })
    .config([
        '$translateProvider',
        function($translateProvider) {
            const fileNameConvention = {
                prefix: './assets/resources/i18n/locale-',
                suffix: '.json',
            };
            $translateProvider.useStaticFilesLoader(fileNameConvention);
            $translateProvider.preferredLanguage('en_US');
        },
    ])
    .filter('capitalize', function() {
        return function(string) {
            return !!string ? string.charAt(0).toUpperCase() + string.substr(1).toLowerCase() : '';
        };
    });
