import { module } from 'angular';
import template from './feedback.component.html';

import './helpers/index.scss';
import './feedback.component.scss';

const FeedbackComponent = {
    template,
    restricted: 'E',
};

export default module('app.feedback', [])
    .component('feedback', FeedbackComponent);
