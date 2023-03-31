const { ProgressPlugin } = require('webpack');

const PLUGIN_NAME = 'ProgressConsolePlugin';
const wait = (time) => new Promise(resolve => setTimeout(resolve, time));
const noop = () => ({});

class ProgressConsolePlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync(PLUGIN_NAME, async (_, callback) => {
      const reportProgress = ProgressPlugin.getReporter(compiler) || noop;
      for (let i = 0; i < 100; i += 1) {
        await wait(50);
        reportProgress(i / 100, `当前插件工作进度 ${i}%`);
      }
      reportProgress(1, '当前插件工作完成');
      await wait(1000);
      callback();
    });
  }
}

module.exports = ProgressConsolePlugin;
