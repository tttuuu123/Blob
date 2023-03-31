const PLUGIN_NAME = 'ConsoleWebpackPlugin';

class ConsoleWebpackPlugin {
  apply(compiler) {
    // compiler.hooks.entryOption.tap(PLUGIN_NAME, (context, entry) => {
    //   console.log(11111111);
    //   console.log('entryOption: ');
    //   console.log(context, entry);
    //   console.log(22222222);
    // });

    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      console.log(11111111);
      console.log('logger: ');
      const logger = compilation.getLogger(PLUGIN_NAME);
      // console.log(logger);
      // 异步的
      logger.info('消息')
      console.log(22222222);
      // compilation.hooks.optimizeModules.tap(PLUGIN_NAME, (modules) => {
      //   console.log(11111111);
      //   console.log('modules: ');
      //   console.log(modules);
      //   console.log(22222222);
      // });
    });

    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      // compilation.errors.push(Error('ConsolePlugins上报的错误'));
      compilation.warnings.push(Error('ConsolePlugins上报的异常'));
    });
  }
}

module.exports = ConsoleWebpackPlugin;
