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
第一步是获取到抽象语法树（AST），</br>
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

下面来看编译过程的细节。</br>
回到baseCompile这个方法，看看它内部到底怎么做的。

第一步是解析抽象语法树`const ast = parse(template.trim(), options)`，那就是这个parse方法了,</br>
parse方法就是个解析器，解析template,返回抽象语法树（AST），也就是用js对象描述dom结构，</br>
解析器内部分了HTML解析器、⽂本解析器和过滤器解析器。

第二部是`optimize(ast, options)`，也就是优化，</br>

```javascript
/* /compiler/optimizer.js */
export function optimize (root: ?ASTElement, options: CompilerOptions) {
  if (!root) return
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  isPlatformReservedTag = options.isReservedTag || no
  // first pass: mark all non-static nodes.
  markStatic(root)
  // second pass: mark static roots.
  markStaticRoots(root, false)
}
```

optimize方法就是个优化器，作用是在AST中找出静态⼦树并打上标记。</br>
静态⼦树是在AST中永远不变的节点，如纯⽂本节点。</br>
看源码可以看出实际上第一步Vue是标记静态节点`markStatic(root)`，实际做的是给所有非静态节点打上标记`node.static = false`,</br>
然后第二步标记静态根节点`markStaticRoots(root, false)`，同时要注意下，Vue对于静态根节点的判定要求整个根节点必须有一个以上静态子节点，才会去做标记，否则认为为这个节点打上静态根节点标记是得不偿失的，不如每次都重新渲染。</br>

静态节点的判定：

```javascript
/* /compiler/optimizer.js */
function isStatic (node: ASTNode): boolean {
  if (node.type === 2) { // expression
    return false
  }
  if (node.type === 3) { // text
    return true
  }
  return !!(node.pre || (
    !node.hasBindings && // no dynamic bindings
    !node.if && !node.for && // not v-if or v-for or v-else
    !isBuiltInTag(node.tag) && // not a built-in
    isPlatformReservedTag(node.tag) && // not a component
    !isDirectChildOfTemplateFor(node) &&
    Object.keys(node).every(isStaticKey)
  ))
}
```

标记静态⼦树的好处：</br>
每次重新渲染，不需要为静态⼦树创建新节点；</br>
虚拟DOM中patch时，可以跳过静态⼦树；</br>

generate方法就是个代码生成器，作用是将AST转换为（字符串类型的）code。

```javascript
/* /compiler/codegen/index.js */
export function generate (
  ast: ASTElement | void,
  options: CompilerOptions
): CodegenResult {
  const state = new CodegenState(options)
  const code = ast ? genElement(ast, state) : '_c("div")'
  return {
    render: `with(this){return ${code}}`,
    staticRenderFns: state.staticRenderFns
  }
}
```

可以看出来generate方法就是对AST调用genElement方法递归处理，返回了一段（字符串类型的）code。</br>
来以两个例子看下genElement的作用：

- 第一个是genFor，Vue是怎么处理v-for指令的：

```html
<div id="demo">
  <p v-for="item in arr" :key="item">{{item}}</p>
</div>
<script>
  const app = new Vue({
    el: '#demo',
    data: {
      arr: [1, 2, 3],
    },
  })
</script>
```

这个简单的v-for例子生成的ast中根节点是`tag: "div",`，它的childeren中有一个`tag: "p"`

```javascript
/* tag: "div" */
{
  attrs: [{…}],
  attrsList: [{…}],
  attrsMap: {id: "demo"},
  children: [{…}],
  end: 77,
  parent: undefined,
  plain: false,
  rawAttrsMap: {id: {…}},
  start: 0,
  static: false,
  staticRoot: false,
  tag: "div",
  type: 1,
}
/* chidlren中的tag: "p" */
{
  alias: "item",
  attrsList: [],
  attrsMap: {v-for: "item in arr", :key: "item"},
  children: [{…}],
  end: 68,
  for: "arr",
  key: "item",
  parent: {type: 1, tag: "div", attrsList: Array(1), attrsMap: {…}, rawAttrsMap: {…}, …},
  plain: false,
  pre: undefined,
  rawAttrsMap: {v-for: {…}, :key: {…}},
  rawAttrsMap: {
    :key: {
      end: 54,
      name: ":key",
      start: 43,
      value: "item",
    },
    v-for: {
      end: 42,
      name: "v-for",
      start: 23,
      value: "item in arr",
    },
  },
  start: 20,
  static: false,
  staticRoot: false,
  tag: "p",
  type: 1,
}
```

可以看到v-for指令最终在ast描述的对象中多了几个属性`for: "arr"`、`alias: "item"`，`key: "item"`，同时还在`attrsMap`和`rawAttrsMap`中存了映射关系，</br>
`rawAttrsMap`中存就是指令在模板字符串中的开始和结束下标的映射关系。

```javascript
export function genFor (
  el: any,
  state: CodegenState,
  altGen?: Function,
  altHelper?: string
): string {
  const exp = el.for
  const alias = el.alias
  const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''
  const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''

  el.forProcessed = true // avoid recursion
  return `${altHelper || '_l'}((${exp}),` +
    `function(${alias}${iterator1}${iterator2}){` +
      `return ${(altGen || genElement)(el, state)}` +
    '})'
}

/* 由ast生成的code */
_l((arr),function(item){return _c('p',{key:item},[_v(" "+_s(item))])})
```

针对`<p v-for="item in arr" :key="item">{{item}}</p>`，code就是生成了以item为别名（item），arr为表达式（exp），</br>
然后继续递归调用genElement生成文本节点`{{item}}`的code，其中`_l()`方法是（Vue定义的）专门处理for循环的函数。

- 同样的来看下第二个genIf，看看v-if指令是怎么处理的：

```html
<div id="demo">
  <p v-if="show">show</p>
</div>
<script>
  const app = new Vue({
    el: '#demo',
    data: {
      show: true,
    },
  })
</script>
```

带v-if指令的ast和普通ast相比也是多了几个属性，最主要的就是`if: "show"`和`ifConditions: [...]`，同样也在`attrsMap`和`rawAttrsMap`中存了映射关系，</br>

```javascript
/* 有删减 */
function genIfConditions (
  conditions: ASTIfConditions,
  state: CodegenState,
  altGen?: Function,
  altEmpty?: string
): string {
  const condition = conditions.shift()
  return `(${condition.exp})?${
    genTernaryExp(condition.block)
  }:${
    genIfConditions(conditions, state, altGen, altEmpty)
  }`

  /* 由ast生成的cod */
  (show)?_c('p',[_v("show")]):_e()
}
```

可以看到v-if指令生成的code就是个三元表达式，`show`为真就生成渲染方法，否则生成一个空的vnode。</br>

```javascript
/* /core/vdom/vnode.js */
export const createEmptyVNode = (text: string = '') => {
  const node = new VNode()
  node.text = text
  node.isComment = true
  return node
}
```

`_c`就是`createElement`，创建元素节点。</br>
`_v`就是`createTextVNode`，创建文本节点。</br>
`_e`就是`createEmptyVNode`，创建空节点。</br>
表达式会先⽤toString格式化，别名_s。</br>
其余都可以在/core/instance/render-helpers/index.js中看到，是在initRender方法中挂载在实例上的。





