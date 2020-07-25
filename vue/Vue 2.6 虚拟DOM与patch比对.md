在响应式原理中提到过Vue初始化挂载过程中会执行$mount方法方法内部的mountComponent：

```javascript
/* /core/instance/lifecycle.js 有删减 */
export function mountComponent (
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  vm.$el = el
  callHook(vm, 'beforeMount')

  let updateComponent
 
  updateComponent = () => {
    vm._update(vm._render(), hydrating)
  }

  // we set this to vm._watcher inside the watcher's constructor
  // since the watcher's initial patch may call $forceUpdate (e.g. inside child
  // component's mounted hook), which relies on vm._watcher being already defined
  new Watcher(vm, updateComponent, noop, {
    before () {
      if (vm._isMounted && !vm._isDestroyed) {
        callHook(vm, 'beforeUpdate')
      }
    }
  }, true /* isRenderWatcher */)
  hydrating = false

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}
```

在响应式原理中提到了Vue为每个组件实例创建了一个Watcher，当初始化或者触发响应式执行该Watcher时，最终实际上执行的就是updateComponent方法。</br>
再从头看mountComponent方法，最开始执行了`callHook(vm, 'beforeMount')`，初始化过程中，在Watcher的updateComponent方法执行后，执行了`callHook(vm, 'mounted')`。</br>
大概率可以猜测这个updateComponent就是更新组件，内部可能有生成vdom，同时如果这个vdom内还有子组件，也会重新走子组件的初始化过程，</br>
所以可以推断出Vue的父子组件声明周期是:
  `父beforeCreate` -> `父created` -> `父beforeMount` -> `子beforeCreate` -> `子created` -> `子beforeMount` -> `子mounted` -> `父mounted`。</br>
即Vue是从上到下初始化，从下到上挂载。

回到updateComponent，内部先执行了`vm._render()`，这个方法就是编译过程，最终会得到虚拟DOM。</br>
然后将虚拟DOM作为参数传入vm._update方法中：

```javascript
/* /core/instance/lifecycle.js 有删减 */
Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
  const vm: Component = this
  const prevEl = vm.$el
  const prevVnode = vm._vnode
  vm._vnode = vnode
  if (!prevVnode) {
    // initial render
    vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)
  } else {
    // updates
    vm.$el = vm.__patch__(prevVnode, vnode)
  }
}
```

在_update方法中，当前vm上的_vnode就是上一次的vdom（新的vdom是vm._render方法执行后传入_update方法的）。</br>
如果不存在上一次的vdom，那说明是第一次，也就是初始化，</br>
则传入vm.$el，也就是真实dom；否则传入prevVnode和vnode，并执行__patch__方法。</br>
__patch__是在平台特有代码中指定的：

```javascript
/* /platforms/web/runtime/patch.js */
// install platform patch function
Vue.prototype.__patch__ = inBrowser ? patch : noop
```

显然的在浏览器内实际上是patch方法：

```javascript
/* /platforms/web/runtime/patch.js */
export const patch: Function = createPatchFunction({ nodeOps, modules })
```
patch是createPatchFunction的返回值，</br>
nodeOps就是web平台内原生操作dom的方法集合，</br>
modules则是web平台内设置attribute、class、style、事件及动画监听等的更新操作实现模块。</br>

重点来看patch方法的实现，这个方法会接收oldVnode和vnode（老vdom和新vdom）2个参数，下面就用oldVnode和vnode来指代：

```javascript
/* /core/vdom/patch.js */
function patch (oldVnode, vnode, hydrating, removeOnly)
```

```javascript
/* function patch */
if (isUndef(vnode)) {
  if (isDef(oldVnode)) invokeDestroyHook(oldVnode)
  return
}
```

首先，判断如果vnode不存在，oldVnode存在，则删除oldVnode。

```javascript
/* function patch */
if (isUndef(oldVnode)) {
  // empty mount (likely as component), create new root element
  isInitialPatch = true
  createElm(vnode, insertedVnodeQueue)
} else
```

其次，如果oldVnode不存在（且vnode存在），则执行创建vnode，</br>
要注意，上面提到了在初始化过程中，vnode是传了，不过传的是vm.$el，也就是真实dom，所以初始化过程走的是else内的逻辑：</br>

```javascript
/* function patch */
const isRealElement = isDef(oldVnode.nodeType)
if (!isRealElement && sameVnode(oldVnode, vnode)) {
  // patch existing root node
  patchVnode(oldVnode, vnode, insertedVnodeQueue, null, null, removeOnly)
} else
```

如果是oldVnode不是真实dom，且oldVnode和vnode是sameVnode，则执行patchVnode对比，这里跳过，先看else部分的逻辑：

```javascript
/* function patch */
const oldElm = oldVnode.elm
const parentElm = nodeOps.parentNode(oldElm)

createElm(
  vnode,
  insertedVnodeQueue,
  oldElm._leaveCb ? null : parentElm,
  nodeOps.nextSibling(oldElm)
)

if (isDef(parentElm)) {
  removeVnodes([oldVnode], 0, 0)
} else if (isDef(oldVnode.tag)) {
  invokeDestroyHook(oldVnode)
}
```

如果oldVnode是真实dom，则获取了oldElm这个dom节点，以及它的父节点parentElm。</br>
这里要先补充说明下，Vue初始化会先把我们常写的template内容直接输出到页面上，</br>
换句话说template内的插值表达式{{XXX}}，在页面也是显示的{{XXX}}，称其为宿主模板</br>
然后执行了createElm，它是把解析出来的真实dom，追加到宿主模板后面（insert到老节点nextSibling后），最后把宿主模板删除。</br>
这就是初始化过程中真实dom的挂载，这个过程会非常快，所以需要借住断点才能看到。</br>
这么做的原因是初始化的这个模板可能非常复杂，那么在浏览器内存中创建完这个dom树后，一次性追加渲染到页面上，效率更高。</br>
这也是Vue的$mount方法中，如果传入一个el元素，那么这个el元素最终会被这个vm最终生成的真实dom覆盖的原因。

初始化过程中的patch说完后，后续响应式触发_update方法后，如果oldVnode和vnode是sameVnode，就会回到上文说的执行patchVnode比对。</br>
首先看一下满足什么条件是sameVnode：

```javascript
/* /platforms/web/runtime/patch.js */
function sameVnode (a, b) {
  return (
    a.key === b.key && (
      (
        a.tag === b.tag &&
        a.isComment === b.isComment &&
        isDef(a.data) === isDef(b.data) &&
        sameInputType(a, b)
      ) || (
        isTrue(a.isAsyncPlaceholder) &&
        a.asyncFactory === b.asyncFactory &&
        isUndef(b.asyncFactory.error)
      )
    )
  )
}
```

首要条件是a和b的key是绝对相等（undefined === undefined为true），</br>
其次 a和b的标签类型相等 且 a和b同为或同不为注释 且 a和b同有或同不有data 且 若a和b同为input标签则其input的type也要相等。</br>
|| 后面是异步组件，这里不做讨论。

满足了sameVnode后，则进入patchVnode方法：</br>
patchVnode首先判断了`if (oldVnode === vnode)`，若oldVnode与vnode相等，直接返回。</br>
在判断了`if (isTrue(vnode.isStatic) && isTrue(oldVnode.isStatic))`，若oldVnode与vnode均为静态节点，直接返回。</br>
静态节点的标记发生在编译过程中，将template模板转换为ast后，Vue会做一次优化，就是标记出静态节点。</br>

patchVnode主要是比较2个vnode，然后进行属性更新、（⽂本更新或⼦节点更新）。</br>

先看属性更新：

```javascript
/* function patchVnode */
if (isDef(data) && isPatchable(vnode)) {
  for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode)
  if (isDef(i = data.hook) && isDef(i = i.update)) i(oldVnode, vnode)
}
```

这段代码不做展开，实际做的事情就是把vnode上的所有属性（在modules中定义的一些模块）全部复制一遍到oldVnode上，一小段attributes更新代码演示：

```javascript
/* /platforms/web/runtime/modules/attrs.js 有删改 */
const oldAttrs = oldVnode.data.attrs || {}
const attrs = vnode.data.attrs || {}
for (key in attrs) {
  cur = attrs[key]
  old = oldAttrs[key]
  if (old !== cur) {
    setAttr(elm, key, cur)
  }
}
```

属性更新完后，执行了：

```javascript
/* function patchVnode */
const oldCh = oldVnode.children
const ch = vnode.children
    
if (isUndef(vnode.text)) {
  if (isDef(oldCh) && isDef(ch)) {
    if (oldCh !== ch) updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly)
  } else if (isDef(ch)) {
    if (process.env.NODE_ENV !== 'production') {
      checkDuplicateKeys(ch)
    }
    if (isDef(oldVnode.text)) nodeOps.setTextContent(elm, '')
    addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue)
  } else if (isDef(oldCh)) {
    removeVnodes(oldCh, 0, oldCh.length - 1)
  } else if (isDef(oldVnode.text)) {
    nodeOps.setTextContent(elm, '')
  }
} else if (oldVnode.text !== vnode.text) {
  nodeOps.setTextContent(elm, vnode.text)
}
```

翻译一下就是：</br>
若vnode不是文本节点：</br>
  若oldCh和ch都存在，且不等，则对比这连个节点（updateChildren方法）；</br>
  否则，若ch存在，即老节点不存在，新节点存在，则说明是新增，插入新节点ch；</br>
  否则，若oldCh存在，即老节点存在，新界点不存在，则说明是删除，删除oldCh；</br>
  否则，若老节点是文本节点，即老节点是文本节点，新界点不是文本节点，则直接将元素的文本内容置为空；</br>
否则，若老节点的文本与新界节点的文本不同，则用新节点文本更新老节点的文本；</br>

下面重点看一下若oldCh和ch都存在，且不等，则对比这连个节点（updateChildren方法）这个场景，updateChildren方法实际上就是常听到的diff算法的实现。

<!-- Todo：虚拟节点的作用 -->

