'use strict';

// A bit of imports
const path = require('path');

function root(...args) {
  return path.join(path.resolve(__dirname, '..'), ...args);
}

function getWebpackEnvConf(__ENV) {
  let WPConf = root('config', 'webpack');
  return `${WPConf}/webpack-${__ENV}.config.js`;
}

exports.root = root;
exports.getWebpackEnvConf = getWebpackEnvConf;
