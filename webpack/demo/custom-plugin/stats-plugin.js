const PLUGIN_NAME = 'StatsPlugin';

class StatsPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.statsFactory.tap(PLUGIN_NAME, (factory) => {
        factory.hooks.result.for('module').tap(PLUGIN_NAME, (module) => {
          // 添加自定义信息
          module.customStatsInfo = ~~(Math.random() * 100);
        });
      });
    });
  }
}

module.exports = StatsPlugin;
