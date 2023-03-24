const path = require('path');
const loaderUtils = require('loader-utils');

module.exports.default =  function loader (source) {
  if (this.resource.indexOf('src/index.js') > -1) {
    console.log(source);
    this.emitFile('entry.txt', source, null);
  }
  return source;
}

module.exports.raw = true;