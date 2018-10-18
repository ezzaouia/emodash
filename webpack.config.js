// A bit of imports
const helpers = require('./utils/helpers');

// load webpack config by env: dev || prod || test
switch (process.env.NODE_ENV) {
  case 'production':
    exportModule(helpers.getWebpackEnvConf('prod'));
    break;
  case 'test':
    exportModule(helpers.getWebpackEnvConf('test'));
    break;
  case 'development':
  default:
    exportModule(helpers.getWebpackEnvConf('dev'));
    break;
}

function exportModule (envConfigFilename) {
  module.exports = require(envConfigFilename);
}
