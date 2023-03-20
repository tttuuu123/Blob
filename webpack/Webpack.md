# Webpack简单入个门

`个人学习笔记`

### 特点
* 一致且开放：
  + 一致性，可以忽略资源之间的差异：
    - 所有资源都是 Module；
    - 借助Loader，Webpack几乎可以处理任意类型资源；
  + 开放性：
    - 可以轻松接入TS、Babel等JS编译工具；Less、Sass等CSS预处理器；

### 理解
`Webpack打包流程大致可以划分：输入 -> 模块处理 -> 后处理 -> 输出`

### 流程
* 输入：从文件系统读入文件
* 模块处理：根据文件类型调用对应Loader，将结果转为AST，并分析依赖关系，进一步递归处理所有依赖文件
* 后处理：待所有模块处理完毕后执行，包括模块合并、注入运行时、产物优化。最终输出Chunk集合
* 输出：将Chunk写出到外部文件系统

##### 流程相关配置项
* 输入输出：
  + entry：定义项目入口文件
  + context：项目执行上下文路径
  + output：配置产物输出路径、名称等
* 模块处理：
  + resolve：配置模块路径解析规则
  + module：配置模块加载规则
  + externals：声明外部资源，Webpack会忽略这部分资源，跳过这些资源的解析和打包工作
* 后处理：
  + optimization：优化产物包体积
  + target：配置目标产物的目标运行环境
  + mode：声明环境
* 其他提效工具：
  + 开发效率：
    - watch：持续监听文件变化，持续构建
    - devtool：配置Sourcemap生成规则
    - devServer：配置HMR相关
  + 性能优化：
    - cache：缓存编译信息和编译结果
    - performance：配置产物超过阈值，如何告知开发者
  + 日志类：
    - stats：精确控制编译过程的日志内容
    - infrastructureLogging：控制日志输出方式

### 常用工具
* Babel

```javascript
  // webpack.config.js
  module.exports = {
    modules: {
      rules: [
        {
          test: /\.js$/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        }
      ]
    }
  };
```

* TS

```javascript
  // webpack.config.js
  module.exports = {
    modules: {
      rules: [
        {
          test: /\.ts$/,
          use: ['ts-loader']
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.js']
    }
  }
```

* ESLint

```javascript
  // .eslintrc
  {
    "extends": "standard"
  }
```

```javascript
  // webpack.config.js
  const path = require('path');
  const ESLintPlugin = require('eslint-webpack-plugin');

  module.exports = {
    entry: './src/index',
    mode: 'develop',
    output: {
      filename: '[name].[contenthash].js',
      path: path.join(__dirname, 'dist')
    },
    plugins: [new ESLintPlugin({ extensions: ['.js', '.ts'] })]
  }
```

* css
  + css-loader：解析css内容
  + style-loader：将css内容注入到页面`<style>`标签内
  + mini-css-extract-plugin：将css代码单独抽离成`.css`文件，通过`<link>`标签插入到页面
  
```javascript
  // webpack.config.js
  const HTMLWebpackPlugin = require('html-webpack-plugin');
  const MiniCssExtractPlugin = require('mini-css-extract-plugin');

  module.exports = {
    modules: {
      rules: [
        {
          test: /\.css$/i,
          use: [
            process.env.NODE_ENV === 'develop' ? 'style-loader' : MiniCssExtractPlugin.loader,
            "css-loader",
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: [require('autoprefixer')]
                }
              }
            }
          ]
        }
      ]
    },
    plugins: [
      new MiniCssExtractPlugin(),
      new HTMLWebpackPlugin()
    ]
  }
```

* img
  + file-loader：将图像引用转为url语句并生成相应图片文件
  + url-loader：设定阈值`limit`，对于小于阈值图片直接转为`base64编码`；大于阈值的图片则调用file-loader加载

```javascript
  // webpack.config.js
  module.exports = {
    module: {
      rule: [{
        test: /\.(png|jpg|jpeg)$/,
        use: [{
          loader: 'url-loader',
          options: {
            limit: 1024
          }
        }]
      }]
    }
  }
```

### 核心流程细解
* 初始化阶段：
  + 初始化参数：从配置文件、配置对象、shell参数中读取，与默认配置结合得出最终配置
  + 创建编译器对象：用参数创建`Compiler`对象
  + 初始化编译环境：注入内置插件、注入模块工厂、初始化RuleSet集合、加载配置的插件等
  + 开始编译：执行`Compiler`对象的run方法，创建`Compilation`对象
  + 确定入口：根据配置的`entry`找出所有的入口文件，调用`compilation.addEntry`将入口文件转换为`dependence`对象
* 构建阶段：
  + 编译模块(make)：从`entry`文件开始，调用对应`loader`将模块转为标准JS内容，调用JS解析器将内容转为AST对象，从中找出该模块的依赖模块，再递归处理依赖模块，直到所有入口依赖的文件都经过编译处理完毕
  + 完成模块编译：得到上一步完成后所有被依赖模块的编译内容和它们之间的依赖关系图
* 封装阶段：
  + 合并(seal)：根据入口和模块之间的依赖关系，组装成一个个包含多个模块的`Chunk`
  + 优化(optimization)：对`Chunk`做进一步优化，包括tree-shaking、terser、压缩等
  + 写入文件系统(emitAssets)：根据配置确定输出的路径和文件名，把文件内容写入到文件系统

### 性能
* 可能引起的性能问题：
  + 构建阶段
    - 需要将文件的相对引用路径转为绝对路径，这个过程可能涉及多次IO操作，执行效率取决于文件`层次深度`
    - 找到具体文件后，需要读入文件内容并调用`LoaderRunner`遍历Loader数组完成内容编译，这个过程需要执行密集CPU操作，执行效率取决于`Loader的数量与复杂度`
    - 需要将标准JS内容转为AST，并遍历AST找出模块的依赖资源，这个过程层需要执行密集CPU操作，执行效率取决于`代码复杂度`
    - 递归处理依赖资源，执行效率取决于`模块数量`
  + 封装阶段：
    - 根据`splitChunks`配置、`entry`配置，动态模块引用语句等，确定模块与Chunk映射关系，其中`splitChunks`相关的分包算法非常复杂，涉及大量CPU计算
    - 根据`optimization`配置执行一系列产物优化操作，其中诸如`Terser`插件需要执行大量AST相关计算，执行效率取决于`产物代码量`
* 性能分析-如何收集、分析Webpack打包过程的性能数据：
  + 数据收集
    - 添加`profile: true`配置
    ```javascript
      // webpack.config.js
      module.exports = {
        // ...
        profile: true
      }
    ```
    - 运行编译命令，并添加`--json`参数，参数值为最终生成的统计文件名
    ```javascript
      // shell
      npx webpack --json=stats.json
    ```
  + `stats`对象收集了Webpack打包过程中许多信息
    - `modules`：本次打包处理的所有模块列表，内容包含模块大小、所属`Chunk`、构建原因、依赖模块等。`modules.profile`属性，包含了构建该模块时，解析路径、编译、打包、子模块打包等各个环节花费的时间
    - `chunks`：构建过程的`chunks`列表，数组包含`chunk`名称、大小、包含模块等
    - `assets`：编译后最终输出的产物列表、文件路径、文件大小等
    - `entrypoints`：`entry`列表
    - `children`：子`Compiler`对象的性能数据，例如`extract-css-chunk-plugin`插件内部就会创建子`Compiler`来做CSS抽取工作
    ![stats](./images/stats.png)
  + 可视化分析
    - Webpack Analysis<br />
      webpack官方提供的可视化分析工具，只需将`stats.json`文件导入页面，就可以看到分析
    - Statoscope<br />
      安装
      ```shell
        // install
        npm i -D @statoscope/webpack-plugin
      ```
      注册插件
      ```javascript
        // webpack.config.js
        const StatoscopeWebpackPlugin = require('@statoscope/webpack-plugin').default;
        
        module.exports = {
          // ...
          plugins: [new StatoscopeWebpackPlugin()]
        }
      ```
      运行`npx webpack`命令，编译结束默认打开编译分析视图
      ![statoscope](./images//statoscope.png)

##### 持久化缓存
* 持久化缓存-webpack5新特性<br />
  将首次构建的过程与结果数据持久化保存到本地文件系统，在下次构建时跳过解析、链接、编译等一系列耗时操作，直接复用上次的Module/ModuleGraph/Chunk对象数据，迅速构建出最终产物。
  + cache配置
    - type：缓存类型，支持`'memory' | 'filesystem'`，设置为`'filesystem'`开启持久缓存
    - cacheDirectory：缓存文件路径，默认为`nodule_modules/.cache/webpack`
    - buildDependencies：额外依赖文件，当这些文件内容变化，缓存会失效而执行完成编译构建，一般设置为各种配置文件
      ```javascript
        // webpack.config.js
        module.exports = {
          // ...
          cache: {
            type: 'filesystem',
            buildDependencies: {
              config: [
                path.join(__dirname, '.babelrc')
              ]
            }
          }
        }
      ```
    - managedPaths：受控目录，Webpack构建时会跳过新旧代码哈希值与时间戳对比，直接使用缓存副本，默认值为`[./node_modules]`
    - profile：是否输出缓存过程详细日志，默认`false`
    - maxAge：缓存失效时间，默认`5184000000`，即`60天`
  + 原理<br />
    Webpack的构建过程，大致可分为三个阶段，初始化、构建阶段、生成阶段。<br />
    构建阶段包括：读入文件、执行loader链、解析AST、解析依赖。<br />
    生成阶段包括：代码转译、收集运行时依赖、生成chunk、产物优化。<br />
    这个过程中存在许多CPU密集型操作，例如调用Loader链加载文件，遇到babel-loader、eslint-loader、ts-loader等工具时可能需要重复生成AST；分析模块依赖时需要遍历AST，执行大量计算。<br />
    而Webpack5的持久化缓存功能则是将构建结果保存到文件系统中，在下一次编译时比对每个文件的内容哈希或时间戳，未发生变化的文件则跳过编译操作，直接使用缓存副本。
  + Webpack4可以使用`cache-loader`（只缓存Loader执行结果），`hard-source-webpack-plugin`（效果与Webpack5自带的Cache对齐）

##### 并行构建
* 并行构建
  + HappyPack（作者不维护）<br />
    HappyPack能将文件加载（Loader）操作拆到多个子进程中并发进行，子进程执行完毕再将结果返回到主进程，从而提升构建性能。<br />
    - 使用<br />
      * 安装
        ```shell
          npm i -D happypack
        ```
      * 配置<br />
        使用`happypack/loader`替代原本的Loader序列<br />
        使用`HappyPackPlugin`注入代理执行Loader序列的逻辑
          ```javascript
            const os = require('os');
            const HappyPack = require('happypack');
            const happyThreadPool = HappyPack.ThreadPool({
              // 设置进程池大小
              size: os.cpus().length - 1,
            });

            module.exports = {
              // ...
              modules: {
                rules: [{
                  test: /\.js$/,
                  use: 'happypack/loader?id=js'
                }, {
                  test: /\.css$/,
                  use: 'happypack/loader?id=styles'
                }]
              },
              plugins: [
                new HappyPack({
                  id: 'js',
                  loaders: ['babel-loader', 'eslint-loader'],
                }),
                new HappyPack({
                  id: 'styles',
                  loaders: ['style-loader', 'css-loader']
                })
              ]
            }
          ```
  + Thread-loader<br />
    与HappyPack功能类似，但是由Webpack官方维护
    - 使用<br />
      * 安装
        ```shell
          npm i -D thread-loader
        ```
      * 配置<br />
        将`thread-loader`放在`use`数组首位，确保最先运行
        ```javascript
          module.exports = {
            // ...
            module: {
              rules: [{
                test: /\.js$/,
                use: ['thread-loader', 'babel-loader', 'eslint-loader']
              }]
            }
          }
        ```
    - 缺点<br />
      * 在Thread-loader中运行的Loader不能调用emitAsset等接口，这会导致`style-loader`这类加载器无法正常工作，解决方法是将这类Loader放在`thread-loader`之前，例如`['style-loader', 'thread-loader', 'css-loader']`
      * Loader中无法获取`compilation`、`compiler`等实例对象，也无法获取Webpack配置
* 并行压缩<br />
  Webpack4默认使用`Uglify-js`实现代码压缩，Webpack5使用`Terser`——一种性能更好与兼容性更好的JS代码压缩混淆工具。
  + Terser
    ```javascript
      const TerserPlugin = require('terser-webpack-plugin');

      module.exports = {
        // ...
        // Webpack5 默认开启
        optimization: {
          minimize: true,
          minimizer: [new TerserPlugin()]
        }
      }
    ```
* 总结<br />
  并行确实能提升系统运行效率，但Node单线程架构下，所有并行计算都依托于派生子进程执行，而创建进程这个动作开销就很大——约`600ms`，所以上述并行方案需要根据项目大小按需使用。

##### 构建优化
* `lazyCompilation`<br />
  实验性特性，用于实现`entry`或异步模块的按需编译。
  ```javascript
    // webpack.config.js
    module.exports = {
      // ...
      experiments: {
        lazyCompilation: true
      }
    }
  ```
  启用`lazyCompilation`后，代码中通过异步语句导入的模块以及未被访问到的`entry`都不会立即编译，而是页面正式请求该模块资源时才开始构建，可以极大提升冷启动速度。<br />
  尚在试验阶段，建议开发环境使用。
* 约束Loader执行范围<br />
  Loader在执行过程中需要密集CPU操作，为此可以使用`module.rules.include`、`module.rules.exclude`等配置项，限定Loader执行范围（通常可以排除`node_modules`文件夹）。
  ```javascript
    // webpack.config.js
    module.exports = {
      // ...
      module: {
        rules: [{
          test: /\.js$/,
          exclude: /node_modules/,
          use: ['babel-loader', 'eslint-loader']
        }]
      }
    }
  ```
  配置`exclude: /node_modules/`属性后，Webpack在处理`node_modules`中的文件时会直接跳过这个`rule`项。<br />
  此外`include`与`exclude`支持通过`and/not/or`属性配置组合过滤逻辑：
  ```javascript
    // webpack.config.js
    module.exports = {
      // ...
      module: {
        rules: [{
          test: /\.js$/,
          exclude: {
            and: [/node_modules/],
            not: [/node_modules\/lodash/]
          },
          use: ['babel-loader', 'eslint-loader']
        }]
      }
    }
  ```
  通过这种能力，可以将部分需要转译处理的NPM包（例如代码中包含ES6语法），纳入Loader处理范围。
* 使用`noParse`跳过文件编译<br />
  很多库已经做好打包处理，不需要二次编译即可在浏览器运行，例如Vue2的`node_modules/vue/dist/vue.runtime.esm.js`、Lodash的`node_modules/lodash/lodash.js`<br />
  这些文件作为独立、内聚的模块，可以使用`module.noParse`配置项跳过：
  ```javascript
    // webpack.config.js
    module.exports = {
      // ...
      module: {
        noParse: /lodash|react/
      }
    }
  ```
  配置后，所有命中该配置项的文件都会跳过前置的构建、分析动作，内容被直接合并进`Chunk`。<br />
  同时要注意：
    + 命中`noParse`配置项的文件不能存在对其它文件的依赖，除非运行环境支持用到的模块化导入方案
    + 由于跳过内容分析过程，Webpack无法标记该文件的导出值，即无法实现`Tree-shaking`
* 开发模式禁用产物优化
  ```javascript
    // webpack.config.js
    module.exports = {
      // ...
      mode: 'development',
      optimization: {
        removeAvailableModules: false, // 如果当前模块已经包含在父级模块，Webpack从chunk中检测出这些模块并移除
        removeEmptyChunks: false, // 如果chunk为空，Webpack检测并移除这些chunk
        splitChunks: false, // 关闭代码分包
        minimize: false, // 关闭代码压缩
        concatenateModules: false, // 关闭模块合并
        usedExports: false, // 关闭Tree-shaking
      }
    }
  ```
* 最小化`watch`监听范围<br />
  在`watch`模式下（`npx webpack --watch`），Webpack会持续监听项目目录下所有代码文件，发生变化时执行`rebuild`命令。<br />
  通常，部分资源不会频繁更新，例如`node_modules`，此时可通过`watchOptions.ignored`配置项忽略这些文件：
  ```javascript
    // webpack.config.js
    module.exports = {
      // ...
      watchOptions: {
        ignored: /node_modules/
      }
    }
  ```
* 优化`eslint`性能<br />
  在开发模式下使用`eslint`实时代码检查，会带来比较高昂且不必要的性能成本，可以使用`eslint-webpack-plugin`替代。<br />
  `eslint-webpack-plugin`会在模块构建完毕（`compilation.hooks.succeedModule`钩子)后执行检查，不会阻塞文件加载流程。
  + 安装
    ```shell
      npm i -D eslint-webpack-plugin
    ```
  + 使用
    ```javascript
    const ESLintPlugin = require('eslint-webpack-plugin');
    
    module.exports = {
      // ...
      plugins: [new ESLintPlugin(options)]
    }
    ```
  + 其他
    - 可以使用编辑器自带插件完成ESLint检查
    - 使用`husky`，在代码提交前执行ESLint检查

### Chunk
* 按官方文档，Chunk可以分为两种：
  + `initial` is the main chunk for the entry point. This chunk contains all the modules and their dependencies that you specify for an entry point.
  + `non-initial` is a chunk that may be lazy-loaded. It may appear when dynamic import or SplitChunksPlugin is being used.
* 具体规则：
  + 根据`entry`配置创建对应数量的Chunk
  + 遍历构建阶段找到的所有Module，同一Entry下的模块分配到Entry对应的Chunk中
  + 遍历到异步模块创建新的Chunk
  + 根据SplitChunksPlugin的配置继续对上述Chunk执行**裁剪、拆分、合并、代码调优**
  + 最终，将这些Chunk输出成最终的产物（Asset）文件
* 作用：
  + 一方面作为Module容器，根据默认的**分包策略**决定合并哪些模块打包。
  + 一方面根据`SplitChunks`设定的策略优化Chunk，决定最终输出产物。
* 默认分包策略：
  + 策略
    - Initial Chunk：entry模块及相应子模块打包成Initial Chunk。
    - Async Chunk：通过import('./xx').then()等语句导入的异步模块及相应子模块组成的Async Chunk。
    - Runtime Chunk：运行时代码抽离成Runtime Chunk，可通过`entry.runtime`配置项设置。
  + 问题<br />
    `Initial Chunk`和`Async Chunk`在默认规则下会带来两个比较明显的问题
    - 模块重复打包
      如果多个Chunk依赖同一个Module，那么这个Module会不受限制地重复打包进这些Chunk。<br />
      例如有两个`entry`同时依赖`c模块`，那么Webpack默认会把`c模块`同时打包进两个`entry`的Chunk。
    - 弊端<br />
      Webpack会将Entry模块、异步模块所有代码都单独打入一个单独的包，随着项目迭代，包体积的增长可能导致应用响应时间越来越长。这种打包方式存在两个弊端：
      * 资源冗余：客户端必须等应用所有代码加载完毕才能启动运行，但可能用户当前访问的页面只需要其中一部分代码。
      * 缓存失效：大部分资源打入同一个包中，任何改动都可能导致缓存失效。
  + 优化-更合理的分包策略
    - 将被多个Chunk依赖的包抽离成独立Chunk。
    - `node_modules`中资源变更通常较少，可以抽离成独立包，这样业务代码的变动并不会导致第三方库资源缓存失效。
* `SplitChunksPlugin`
  + 特点：
    - 支持Module路径、Module被引用次数、Chunk大小、Chunk请求数等决定是否对Chunk做进一步拆分，这些策略可通过`optimization.splitChunks`配置项调整，常用优化：
      * 单独打包特定路径的内容，例如`node_modules`打包为`vendors`
      * 单独打包使用频率高的文件
    - 利用`optimization.splitChunks.cacheGroup`配置项对不同特点的资源做分组处理，并为这些分组设置针对性分包规则
    - 内置了`default`与`defaultVendors`两个`cacheGroup`，提供一些开箱即用的分包特性：
      * `node_modules`资源会命中`defaultVendors`规则，并被单独打包
      * 只有包体积超过20kb的Chunk才会被单独打包
      * 加载`Async Chunk`所需请求数不得超过30
      * 加载`Initial Chunk`所需请求数不得超过30
  + 设置分包范围<br />
    `SplitChunksPlugin`默认只对`Async Chunk`生效，可以通过`splitChunks.chunks`调整作用范围：
    - `all`：对`Initial Chunk`与`Async Chunk`都生效，建议使用
    - `initial`：只对`Initial Chunk`生效
    - `async`：只对`Async Chunk`生效
    - 函数`(chunk) => boolean`：该函数返回`true`时生效
  + 根据Module使用频率分包<br />
    `SplitChunksPlugin`支持按Module被Chunk引用次数决定是否分包。
    - 配置
      ```javascript
      // webpack.config.js
      module.exports = {
        // ...
        entry: {
          entry1: './src/entry-a.js',
          entry2: './src/entry-b.js'
        },
        optimization: {
          splitChunks: {
            // 引用次数大于等于2的模块分包
            minChunks: 2
          }
        }
      }
      ```
    - 例如对如下配置
      ```javascript
        // webpack.config.js
        module.exports = {
          // ...
          optimization: {
            splitChunks: {
              minChunks: 2
            }
          }
        }

        // module.js
        export default 'module';

        // async-module.js
        export module from './module.js';

        // entry-a.js
        import module from './module';
        import('./async-module');

        // entry-b.js
        import module from './module';
      ```
      针对上述配置，`entry-a`，`entry-b`视作`Initial Chunk`处理；`async-module`被`entry-a`异步方式引入，视作`Async Chunk`处理。对`module`模块来说，被引用数为3，因此该模块会被单独分包。最终产物（不考虑其他配置项条件）：
      * entry1.js
      * entry2.js
      * async-module.js
      * module.js
  + 限制分包数量<br />
    在`minChunks`基础上，为防止最终产物文件数量过多导致HTTP网络请求剧增，反而降低应用性能，Webpack提供`maxInitialRequest/maxAsyncRequest`配置项，用于限制分包数量：
    > “请求数”：指加载一个Chunk时所需加载的所有分包数。
    - `maxInitialRequest`：入口点的最大并行请求数
    - `maxAsyncRequest`：按需加载时的最大并行请求数
    - 入口点的最大并行请求数计算逻辑：
      * `Initial Chunk`算作一个请求
      * `Async Chunk`不算做一个并行请求
      * 通过`runtimeChunk`拆分出的runtime不算并行请求
      * 如果同时有两个Chunk满足拆分规则，但是`maxInitialRequest`或`maxAsyncRequest`的值只能再拆一个模块，那么体积更大的模块会被拆解
  + 更多配置项<br />
    除了上述根据模块使用频率和包数量这两个条件，Webpack还提供了一系列与Chunk有关分包判断规则，借助这些规则可以实现当包体积过小直接取消分包——防止产物过碎；当包体积过大时尝试对Chunk再做拆解——防止单个Chunk过大。相关配置项：
    - `minSize`：超过这个尺寸的Chunk才会被正式分包
    - `maxSize`：超过这个尺寸的Chunk会尝试进一步拆分出更小的Chunk
    - `maxAsyncSize`： 与`maxSize`相似，只对异步引入的模块生效
    - `maxInitialSize`：与`maxSize`相似，只对`entry`配置的模块生效
    - `enforceSizeThreshold`：超过这个尺寸的Chunk会被强制分包，忽略上述Size限制
  + `SplitChunksPlugin`工作流程
    - `SplitChunkPlugin`尝试将命中`minChunks`规则的Module统一抽到一个额外的Chunk对象；
    - 判断该Chunk是否满足`maxInitialRequests`阈值，若满足进行下一步：
    - 判断该Chunk的体积是和`minSize`配置项：
      * 如果体积小于`minSize`取消此次分包，对应Module依然并入原来的Chunk；
      * 如果Chunk体积大于`minSize`，则判断是否超过`maxSize`、`maxAsyncSize`、`maxInitialSize`声明的阈值，如果超过尝试将该Chunk继续分割成更小的部分；
  + 限制分包体积
    > 虽然`maxSize`等阈值规则会产生更多的包体，但缓存粒度会更小，命中率相对会更高，配和持久化缓存和HTTP2的多路复用能力，网络性能反而会有正向收益。
    





    



