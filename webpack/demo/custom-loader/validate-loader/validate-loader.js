const { validate } = require('schema-utils');
const schema = require('./schema.json');

module.exports =  function loader (source) {
  // const options = this.getOptions(schema);
  const options = this.getOptions();
  validate(schema, options)
  return source;
}