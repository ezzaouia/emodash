const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
const config = require('config');

// const DefinePlugin = require('webpack/lib/DefinePlugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
// const IgnorePlugin = require('webpack/lib/IgnorePlugin');
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin');
// const NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
// const ProvidePlugin = require('webpack/lib/ProvidePlugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const OptimizeJsPlugin = require('optimize-js-plugin');
// const CompressionPlugin = require('compression-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const HashedModuleIdsPlugin = require('webpack/lib/HashedModuleIdsPlugin');
const ModuleConcatenationPlugin = require('webpack/lib/optimize/ModuleConcatenationPlugin');


const WebpackBaseConfig = require('./webpack-base.config');
const helpers = require('../../utils/helpers');

module.exports = webpackMerge(WebpackBaseConfig, {
    devtool: 'source-map',
    output: {
        path: helpers.root(config.get('build.dist_folder')),
        filename: '[name].[hash].' + config.get('build.js_bundle_name'),
        sourceMapFilename: '[file].map',
        chunkFilename: '[name].[hash].chunk.js',
    },
    module: {

        rules: [

            {
                test: /\.css$/,
                loader: ExtractTextPlugin.extract({
                    fallback: 'style-loader',
                    use: 'css-loader',
                }),
            },
            {
                test: /\.scss$/,
                loader: ExtractTextPlugin.extract({
                    fallback: 'style-loader',
                    use: 'css-loader!sass-loader',
                }),
            },

        ],
    },
    plugins: [
        new ModuleConcatenationPlugin(),
        new OptimizeJsPlugin({
            sourceMap: false,
        }),
        new ExtractTextPlugin('[name].[contenthash].css'),
        new UglifyJsPlugin(),
        new HashedModuleIdsPlugin(),
        new LoaderOptionsPlugin({
            minimize: true,
            debug: false,
            options: {
                htmlLoader: {
                    minimize: true,
                    removeAttributeQuotes: false,
                    caseSensitive: true,
                    customAttrSurround: [
                        [/#/, /(?:)/],
                        [/\*/, /(?:)/],
                        [/\[?\(?/, /(?:)/],
                    ],
                    customAttrAssign: [/\)?\]?=/],
                },
            },
        }),
        new CopyWebpackPlugin([
            { from: helpers.root(config.get('build.assets_folder')), to: helpers.root(config.get('build.dist_assets_folder')) },
        ]),
        new webpack.HotModuleReplacementPlugin(),
    ],
});
