const path = require('path');
const HTMLWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const StatoscopeWebpackPlugin = require('@statoscope/webpack-plugin').default;
const TerserPlugin = require('terser-webpack-plugin');

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
  // cache: {
  //   type: 'filesystem'
  // },
  // snapshot: {
  //   module: {
  //     hash: true,
  //   },
  //   resolve: {
  //     hash: true,
  //   }
  // },
  module: {
    rules: [
      {
        test: /\.js$/,
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
    // new StatoscopeWebpackPlugin()
  ],
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()]
  }
}

module.exports = config;