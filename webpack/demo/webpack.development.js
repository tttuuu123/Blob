const path = require('path');
const HTMLWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const StatoscopeWebpackPlugin = require('@statoscope/webpack-plugin').default;
const TerserPlugin = require('terser-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');

const config = {
  mode: 'production',
  profile: true,
  entry: './src/index.js',
  output: {
    filename: '[name].[contenthash].js',
    path: path.join(__dirname, 'dist')
  },
  cache: {
    type: 'filesystem'
  },
  snapshot: {
    module: {
      hash: true,
    },
    resolve: {
      hash: true,
    }
  },
  module: {
    // noParse: /lodash/,
    rules: [
      {
        test: /\.js$/,
        exclude: {
          not: [/node_modules\/lodash/]
        },
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.(png|jpeg|jpg)$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 1024
            }
          }
        ]
      }
    ],
  },
  plugins: [
    new MiniCssExtractPlugin(),
    new HTMLWebpackPlugin(),
    // new StatoscopeWebpackPlugin()
    new ESLintPlugin()
  ],
  watchOptions: {
    ignored: /node_modules/
  }
}

module.exports = config;