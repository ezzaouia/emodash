'use strict';
/**
 * @author: @Med'eZ
 */
const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
const config = require('config');

const webpackBaseConfig = require('./webpack-base.config');
const helpers = require('../../utils/helpers');

module.exports = webpackMerge(webpackBaseConfig, {
  devtool: 'cheap-module-source-map',
  output: {
    path: helpers.root(config.get('build.dist_folder')),
    filename: '[name].' + config.get('build.js_bundle_name'),
    sourceMapFilename: '[name].map',
  },
  module: {

    rules: [
      {
        test: /\.(scss|css)$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
    ],

  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
  ],
  devServer: {
    contentBase: helpers.root(config.get('app.src_folder')),
    compress: true,
    hot: true,
    inline: true,
    port: process.env.PORT || config.get('env.dev.port'),
    host: process.env.HOST || config.get('env.dev.host'),
    watchOptions: {
      aggregateTimeout: 300,
      poll: 1000,
    },
  },
});
