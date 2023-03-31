const { ProgressPlugin } = require('webpack');

const PLUGIN_NAME = 'ProgressConsolePlugin';
const wait = (time) => new Promise(resolve => setTimeout(resolve, time));
const noop = () => ({});

class ProgressConsolePlugin {
  apply(compiler) {
    // compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
    //   console.log(111111);
    //   compilation.hooks.finishModules.tapAsync({
    //     name: PLUGIN_NAME,
    //     context: true,
    //   }, async (context, _, callback) => {
    //     const reportProgress = context.getReporter(compiler) || noop;
    //     console.log(reportProgress);
    //     reportProgress(1, '当前插件工作完成');
    //     // for (let i = 0; i < 100; i += 1) {
    //     //   await wait(50);
    //     //   reportProgress(i / 100, `当前插件工作进度 ${i}%`);
    //     // }
    //     // reportProgress(1, '当前插件工作完成');
    //     // await wait(1000);
    //     callback();
    //   });
    // });
    compiler.hooks.emit.tapAsync(
      {
        name: 'MyPlugin',
        context: true,
      },
      (context, compiler, callback) => {
        const reportProgress = context && context.reportProgress;
        console.log(11111, reportProgress)
        if (reportProgress) reportProgress(0.95, 'Starting work');
        setTimeout(() => {
          if (reportProgress) reportProgress(0.95, 'Done work');
          callback();
        }, 1000);
      }
    );
  }
}

module.exports = ProgressConsolePlugin;
