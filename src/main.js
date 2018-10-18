/* global document */
import { bootstrap } from 'angular';
import { element } from 'angular';
import app from  './app';
import './styles.scss';

element(document).ready(() => bootstrap(document, [app.name]));
