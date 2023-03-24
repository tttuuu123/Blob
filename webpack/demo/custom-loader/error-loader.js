module.exports =  function loader (source, map, data) {
  // const logger = this.getLogger('logger-error');
  // logger.error('错误');
  // this.emitError('错误');
  // return source;
  this.callback(Error('错误'), source, map, data);
}