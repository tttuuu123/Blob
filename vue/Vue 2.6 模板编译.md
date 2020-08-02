模板编译的目的是将模板转换为渲染函数（template -> render()）。</br>
需要模板编译的原因：</br>
Vue1中watcher太多，导致响应式数据一复杂，容易崩溃。</br>
Vue2中为每个实例创建一个watcher（当然组件中还存在用户自定义的watcher以及computed的watcher），大大减少了watcher数量，</br>
但watcher被触发了update方法后，只知道这个组件发生了变化，无法像Vue1那样精确知道哪个dom要发生变化，所以需要vdom来进行比对，找出最小变化节点并操作它。</br>
同时不可能要求用户写vdom，而vdom是用js来描述视图，所以需要模板编译，让用户编写较为熟悉的Vue模板，通过编译将模板转为可以返回vdom的render函数。

编译的入口在扩展的$mount方法内：

```javascript
/* /platforms/web/entry-runtime-with-compiler.js 有删减 */
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  // ...
  const options = this.$options
  const { render, staticRenderFns } = compileToFunctions(template, {
    outputSourceRange: process.env.NODE_ENV !== 'production',
    shouldDecodeNewlines,
    shouldDecodeNewlinesForHref,
    delimiters: options.delimiters,
    comments: options.comments
  }, this)
  options.render = render
  options.staticRenderFns = staticRenderFns
  // ...
}
```

可以很明显的看出来compileToFunctions传入了模板template和一些配置，返回了一个render和staticRenderFns，并挂到了实例的options上。</br>
很明显要找到compileToFunctions这个方法：

```javascript
/*/platforms/web/compiler/index.js */
import { createCompiler } from 'compiler/index'
const { compile, compileToFunctions } = createCompiler(baseOptions)
export { compile, compileToFunctions }
```

所以compileToFunctions是createCompiler返回的：

```javascript
/* /compiler/index.js */
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  const ast = parse(template.trim(), options)
  if (options.optimize !== false) {
    optimize(ast, options)
  }
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
```

先看一下createCompilerCreator这个方法：
```javascript
/* /compiler/create-compiler.js 有删减 */
export function createCompilerCreator (baseCompile: Function): Function {
  return function createCompiler (baseOptions: CompilerOptions) {
    function compile (
      template: string,
      options?: CompilerOptions
    ): CompiledResult {
      const compiled = baseCompile(template.trim())
      return compiled
    }

    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
```

createCompilerCreator方法返回了compile方法，compile方法内返回的是将template作为参数传入baseCompile方法的结果，</br>
baseCompile方法就在createCompiler中定义的，光看代码也能看出来：</br>
第一步是获取到抽象语法树（ast），</br>
第二步是做一些优化（optimize），</br>
第三步是生成（generate），看返回结果生成的是render函数。</br>
createCompilerCreator作为一个高阶函数，执行后返回了一个createCompiler方法，这个方法执行后会返回前面要找的compileToFunctions这个方法。</br>

那么明显的要去看createCompileToFunctionFn方法了：

```javascript
/* /compiler/to-function.js 有删减 */
export function createCompileToFunctionFn (compile: Function): Function {
  const cache = Object.create(null)

  return function compileToFunctions (
    template: string,
    options?: CompilerOptions,
    vm?: Component
  ): CompiledFunctionResult {
    // compile
    const compiled = compile(template, options)
    // turn code into functions
    const res = {}
    const fnGenErrors = []
    res.render = createFunction(compiled.render, fnGenErrors)
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
      return createFunction(code, fnGenErrors)
    })

    return (cache[key] = res)
  }
}
```
createCompileToFunctionFn也是一个高阶函数，它返回的就是要找的compileToFunctions方法，</br>
这个方法内部定义了一个res的对象，上面有render和staticRenderFns方法（这两个方法是执行baseCompile方法得到的），缓存并返回了这个res。</br>

到这里就找全了compileToFunctions返回render和staticRenderFns的全过程了，编译过程也就结束了。

