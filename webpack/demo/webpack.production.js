const path = require('path');
const { ProgressPlugin } = require('webpack');
const HTMLWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const ConsoleWebpackPlugin = require('./custom-plugin/console-plugin');
const ProgressConsolePlugin = require('./custom-plugin/progress-console-plugin');
const StatsPlugin = require('./custom-plugin/stats-plugin');

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
    filename: '[name].js',
    path: path.join(__dirname, 'dist')
  },
  experiments: {
    topLevelAwait: true,
  },
  // externals: {
  //   lodash: 'lodash'
  // },
  module: {
    rules: [
      {
        test: /\.js$/,
        // exclude: {
        //   not: [/node_modules\/lodash/]
        // },
        use: [
          {
            loader: path.resolve(__dirname, './custom-loader/console-loader.js')
          },
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
            },
          },
          // {
          //   loader: path.resolve(__dirname, './custom-loader/emit-file-loader.js')
          // },
          // {
          //   loader: path.resolve(__dirname, './custom-loader/error-loader.js')
          // }
          // {
          //   loader: path.resolve(__dirname, './custom-loader/validate-loader/validate-loader.js'),
          // }
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
    new CleanWebpackPlugin(),
    new ConsoleWebpackPlugin(),
    // new ProgressPlugin({
    //   activeModules: false,
    //   entries: false,
      // handler(percentage, message, ...args) {
      //   console.info(`${percentage.toFixed(2) * 100}%`, message, ...args);
      // }
    // }),
    // new ProgressConsolePlugin(),
    new StatsPlugin()
  ],
  optimization: {
    usedExports: true,
    minimize: false,
    minimizer: [
      '...',
      // new TerserPlugin(),
      new CssMinimizerPlugin()
    ],
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendors: {
          name() {
            return 'vendors';
          },
          test: /[\\/]node_modules[\\/]/i,
          maxSize: 1024 * 10,
          minSize: 0,
          maxInitialRequests: Infinity,
        },
        commons: {
          name: 'commons',
          chunks: 'initial',
          minChunks: 2,
        },
      }
    },
    runtimeChunk: {
      name: 'runtime'
    }
  },
}

module.exports = config;
