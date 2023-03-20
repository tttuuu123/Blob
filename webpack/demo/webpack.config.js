const path = require('path');
const HTMLWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const config = {
  mode: 'production',
  profile: true,
  entry: {
    foo: {
      import: './src/index.js',
      // runtime: 'common-runtime',
    }
  },
  output: {
    filename: '[name].[contenthash].js',
    path: path.join(__dirname, 'dist')
  },
  module: {
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
          MiniCssExtractPlugin.loader,
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
    new CleanWebpackPlugin()
  ],
  optimization: {
    minimize: false,
    // minimizer: [new TerserPlugin()]
    splitChunks: {
      chunks: 'all',
      maxSize: 1024 * 3,
      enforceSizeThreshold: 1024 * 10
    },
  },
}

module.exports = config;