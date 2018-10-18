
import { module } from 'angular';

export default module('app.scopeApply', [])
    .service('scopeApply', function () {
        return function (scope) {
            if (!scope.$$phase) {
                scope.$apply();
            }
        };
    });
