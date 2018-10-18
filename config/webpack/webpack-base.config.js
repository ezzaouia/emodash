'use strict';
/**
 * @author: @Med'eZ
 */

// A bit of imports
const HtmlWebpackPlugin = require('html-webpack-plugin');
const config = require('config');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const helpers = require('../../utils/helpers');

// webpack config
module.exports = {
  entry: {
    'vendors': config.get('app.vendors_file'),
    'main': config.get('app.main_file'),

  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    modules: [helpers.root(config.get('app.src_folder')), helpers.root('node_modules')],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        include: [
          helpers.root('app.src_folder'),
        ],
        exclude: [helpers.root('node_modules')],
        loader: 'eslint-loader',
      },
      {
        test: /\.ts$/,
        include: [
          helpers.root('app.src_folder'),
        ],
        exclude: [helpers.root('node_modules')],
        use: ['ng-annotate-loader', 'awesome-typescript-loader'],
      },
      {
        test: /\.js$/,
        include: [
          helpers.root('app.src_folder'),
        ],
        exclude: [helpers.root('node_modules')],
        use: [
          {
            loader: 'babel-loader',
            options: {
              plugins: ['transform-class-properties', 'add-module-exports'],
              presets: [
                ['es2015', { modules: false }],
                'stage-0',
              ],
            },
          },
          'ng-annotate-loader',
        ],
      },
      {
        test: /\.html$/,
        exclude: [helpers.root(config.get('app.template'))],
        use: ['raw-loader'],
      },
      {
        test: /\.(jpg|png|gif|svg)$/,
        use: 'file-loader',
      },
      {
        test: /\.(eot|svg|ttf|woff|woff2)$/,
        use: 'file-loader',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: config.get('app.title'),
      template: config.get('app.template'),
    }),
    new ExtractTextPlugin({
      filename: '[name].[contenthash].css',
      allChunks: true,
    }),
  ],
  performance: {
    hints: 'warning',
    maxAssetSize: 10000000,
    maxEntrypointSize: 10000000,
  },
};
