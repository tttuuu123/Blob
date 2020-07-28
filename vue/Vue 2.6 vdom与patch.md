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
patch是工厂函数createPatchFunction的返回值，</br>
nodeOps就是平台原生操作dom的方法集合，</br>
modules则是平台特有的属性操作集合。</br>

重点来看patch方法的实现，这个方法会接收oldVnode和vnode（老vdom和新vdom）2个参数，下面就用oldVnode和vnode来指代：

```javascript
/* /core/vdom/patch.js */
function patch (oldVnode, vnode, hydrating, removeOnly) {
  if (oldVnode === vnode) {
      return
    }
  const elm = vnode.elm = oldVnode.elm
}
```

要注意：在patch方法中，因为开始时候，vnode的真实dom还未创建，所以先赋值vnode的真实dom（elm）为oldVnode的elm，后续实际做的就是将vnode上的属性和dom变化更新到vnode的elm上。</br>
Vue会在后面大量操作这个elm，要记住这个elm即是老节点的真实dom，也是进行dom操作后，反应新节点变化的真实dom，换句话说老节点的真实dom和新节点的真实dom是同步变化的，所以操作elm就会直接在浏览器页面上体现。

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
然后执行了createElm，它是把解析出来的真实dom，追加到宿主模板后面（insert到老节点nextSibling后），最后把宿主模板删除（所以说$mount是个覆盖操作）。</br>
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

patchVnode主要是比较2个vnode，然后进行属性更新和（⽂本更新或⼦节点更新）。</br>

先看属性更新：

```javascript
/* function patchVnode */
if (isDef(data) && isPatchable(vnode)) {
  for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode)
  if (isDef(i = data.hook) && isDef(i = i.update)) i(oldVnode, vnode)
}
```

这段代码不做展开，实际做的事情就是把vnode上的所有属性全部更新（执行cbs内收集的modules中定义的一些模块的勾子方法）一遍，一小段attributes更新代码演示：

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

for (key in oldAttrs) {
  if (isUndef(attrs[key])) {
    if (!isEnumeratedAttr(key)) {
      elm.removeAttribute(key)
    }
  }
}
```

遍历vnode的attributes，如果某个attribute和oldAttrs的不同，则重新在vnode的el上给这个attribute赋值；</br>
遍历oldAttrs的attributes，如果某个attribute在vnode上不存在（且这个attribute不是contenteditable或draggable或spellcheck），则在vnode的el上删除这个attribute。

属性更新完后，执行了⽂本更新或⼦节点更新：

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
  若oldCh和ch都存在，且不等，则对比这两个节点的子节点（updateChildren方法）；</br>
  否则，若ch存在，即老节点的子节点不存在，新节点的子节点存在，则说明是新增，插入新节点的ch；</br>
  否则，若oldCh存在，即老节点的子节点存在，新节点的子节点不存在，则说明是删除，删除oldCh；</br>
  否则，若oldVnode是文本节点，即老节点是文本节点，新节点不是文本节点，则直接将elm的文本内容置为空；</br>
否则，若oldVnode的文本与vnode的文本不同，则用新节点文本更新老节点的文本；</br>

下面重点看一下若oldCh和ch都存在，且oldVnode和vnode不等，则对比这两个节点的子节点（updateChildren方法）这个场景，updateChildren方法实际上就是常听到的diff算法的实现。

updateChildren方法的代码很长，但是逻辑很简单：</br>
深度优先，同层比较。</br>

```javascript
/* function updateChildren */
let oldStartIdx = 0
let newStartIdx = 0
let oldEndIdx = oldCh.length - 1
let oldStartVnode = oldCh[0]
let oldEndVnode = oldCh[oldEndIdx]
let newEndIdx = newCh.length - 1
let newStartVnode = newCh[0]
let newEndVnode = newCh[newEndIdx]
```

首先定义了新旧节点的起始下标和节点，结尾下标和节点。</br>
也就是说新旧节点分别的有双指针分别从头尾开始向对方遍历。</br>

```javascript
/* function updateChildren */
while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
  if (isUndef(oldStartVnode)) {
    oldStartVnode = oldCh[++oldStartIdx] // Vnode has been moved left
  } else if (isUndef(oldEndVnode)) {
    oldEndVnode = oldCh[--oldEndIdx]
  }
  // ...
}
```

循环的中止条件是新或旧节点的子节点的首尾指针交叉，并且判断了如果旧节点不存在，就相应的指针进位。</br>
这里一定要注意，Vue的diff比对的新旧节点的虚拟dom中的子节点，而操作的是新旧节点的真实dom，</br>
也就是说在这个过程中，虚拟dom是不变的，而真实dom会随着比对过程中的条件直接做出相应变化。

Vue专门做了一个优化：在项目中，例如常见的列表操作，大多数情况下新旧两个节点，要么头和头会相同，要么头和尾会相同，反之亦然，</br>
所以优先比对新旧两个节点的头头、尾尾、头尾、尾头是否相等（这里的头尾并不是指的子节点的头节点和尾节点，而是当前的开始节点和结尾节点）：</br>

```javascript
/* function updateChildren 头头 */
else if (sameVnode(oldStartVnode, newStartVnode)) {
  patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue, newCh, newStartIdx)
  oldStartVnode = oldCh[++oldStartIdx]
  newStartVnode = newCh[++newStartIdx]
}
```

新旧节点的头头如果是sameVnode，那么直接将两个头指针直接进位，并且要递归遍历这两个sameVnode的字节点。尾尾逻辑与此相同。

```javascript
/* function updateChildren 头尾 */
else if (sameVnode(oldEndVnode, newStartVnode)) { // Vnode moved left
  patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue, newCh, newStartIdx)
  canMove && nodeOps.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm)
  oldEndVnode = oldCh[--oldEndIdx]
  newStartVnode = newCh[++newStartIdx]
}
```

新旧节点的头尾如果是sameVnode，和新旧节点的头头如果是sameVnode的逻辑相比，仅多了一步：</br>
在parentElm（上文提到并强调的elm）上将oldEndVnode的真实dom插入到oldStartVnode的真实dom之前。尾头逻辑与此相同。

```javascript
/* function updateChildren */
idxInOld = isDef(newStartVnode.key)
? oldKeyToIdx[newStartVnode.key]
: findIdxInOld(newStartVnode, oldCh, oldStartIdx, oldEndIdx)
if (isUndef(idxInOld)) { // New element
  createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm, false, newCh, newStartIdx)
} else {
  vnodeToMove = oldCh[idxInOld]
  if (sameVnode(vnodeToMove, newStartVnode)) {
    patchVnode(vnodeToMove, newStartVnode, insertedVnodeQueue, newCh, newStartIdx)
    oldCh[idxInOld] = undefined
    canMove && nodeOps.insertBefore(parentElm, vnodeToMove.elm, oldStartVnode.elm)
  } else {
    // same key but different element. treat as new element
    createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm, false, newCh, newStartIdx)
  }
}
```

如果首尾四种情况都没找到，则从newCh中拿出第一个节点，去oldCh中遍历查找，</br>
如果没找到，就是创建；</br>
如果找到了，就对vnodeToMove和newStartVnode执行一次patchVnode（patchVnode在上文讲过，作用是比较2个vnode，然后进行属性更新和（⽂本更新或⼦节点更新）），</br>
并将vnodeToMove.el移动到oldStartVnode.elm前；</br>
还有一种不常见的场景：两个节点的key相同，但元素不同，那么直接创建。</br>

至此，循环结束，进行收尾：

```javascript
/* function updateChildren */
if (oldStartIdx > oldEndIdx) {
  refElm = isUndef(newCh[newEndIdx + 1]) ? null : newCh[newEndIdx + 1].elm
  addVnodes(parentElm, refElm, newCh, newStartIdx, newEndIdx, insertedVnodeQueue)
} else if (newStartIdx > newEndIdx) {
  removeVnodes(oldCh, oldStartIdx, oldEndIdx)
}
```

如果老节点的首尾指针交叉，说明新节点的children还有未比对的（新增的节点），那么就批量的创建这些节点，并追加到结尾。</br>
如果新节点子节点的首尾指针交叉，说明老节点有多余的（待删除的节点），那么就批量删除这些节点。

至此patch方法就全部说完了，最终返回了vnode.elm，也就是上文强调的elm。


- 虚拟DOM的作用：</br>
  虚拟DOM简单说就是一个描述真实DOM的JS对象。</br>
  1、将各种变化先在虚拟DOM也就是JS对象操作，开销更小，效率更高，最终将变化映射真实DOM上，并且通过diff算法可以得到最小DOM操作，配合异步更新策略，可以很好的减少浏览器的渲染次数，提升了性能。</br>
  2、通过虚拟DOM，可以实现跨平台开发（将不同平台操作DOM的方法映射为框架内操作DOM的方法），不过Vue的weex听说已经死了。</br>
  3、可以加入兼容性代码</br>
  4、在Vue中引入虚拟DOM很大程度上减少了Watcher的数量，一个组件一个Watcher实例，状态变化通知Watcher进行patch比对。

- 模拟一次虚拟dom diff过程：</br>
  页面初始化有个数组arr=[1, 2, 3]，一秒后将其反转：</br>

    初始化页面上的宿主模板可能是:
    ```html
    <div id="app">
      <p v-for="item in a" :key="item"> {{item}}</p>
    </div>
    ```
    因为是初始化，所以在__patch__方法中传入的宿主真实dom和第一次执行render后得到的虚拟dom，所以在patch方法内判定后会走createElm方法，执行createChildren方法并追加到宿主模板后面：
    ```html
    <div id="app">
      <p v-for="item in a" :key="item"> {{item}}</p>
    </div>

    <div id="app">
      <p>1</p>
      <p>2</p>
      <p>3</p>
    </div>
    ```
    然后执行removeVnodes将宿主模板移除：
    ```html
    <div id="app">
      <p>1</p>
      <p>2</p>
      <p>3</p>
    </div>
    ```
    1s后arr反转为[3, 2, 1]，那么又进入了patch，这次因为oldVnode和vnode都存在虚拟dom，并且是sameVnode，所以走patchVnode逻辑。</br>
    patchVnode判断了oldVnode和vnode都有子节点，且不等，所以走updateChildren逻辑，下面重点关注下updateChildren也就是diff算法的执行过程。</br>
    首先定义了4个游标和对应的节点，节点这里以arr中的值代替：
    ```javascript
    oldStartIdx = 0
    oldEndIdx = 2
    newStartIdx = 0
    newEndIdx = 2
    oldStartVnode = 1
    oldEndVnode = 3
    newStartVnode = 3
    newEndVnode = 1
    ```
    第一轮比对：
    ```javascript
    /**
     * ->1 2 3
     *   3 2 ->1
     */
    ```
    显然会找到`sameVnode(oldStartVnode, newEndVnode) === true`，老节点的开始节点和新节点的结尾节点相同。</br>

    这里补充一下：</br>
    这个时候会先执行`patchVnode(oldStartVnode, newEndVnode)`,</br>
    对这两个相等的节点递归比对，很明显，这两个节点本身却是是相同的，并且都有一个子节点，也就是文本节点1，但是这两个子节点的地址不同，所以又进入了updateChildren，</br>
    在updateChildren中，这两个子节点的的开始节点是sameVnode，并且子节点不再又子节点了，while循环执行了一次直接退出。后续的比较2，3都会有这样一个过程，不再赘述。</br>

    回到上文，老节点的开始节点和新节点的结尾节点相同，那么就会先做移动操作，这里要注意了，是将`oldStartVnode.elm`插入到`nodeOps.nextSibling(oldEndVnode.elm)`之前，</br>
    这里oldStartVnode是1，oldEndVnode是3，`nodeOps.nextSibling(oldEndVnode.elm)`就是节点3的下一个节点，所以是将节点1插入到节点3的下一个节点之前，也就是末尾。</br>
    （一定要注意，操作的是真实dom，而虚拟dom是不变的）:
    ```html
    <div id="app">
      <p>2</p>
      <p>3</p>
      <p>1</p>
    </div>
    ```
    然后将oldStartIdx和newEndIdx进位:
    ```javascript
    oldStartIdx = 1
    oldEndIdx = 2
    newStartIdx = 0
    newEndIdx = 1
    oldStartVnode = 2
    oldEndVnode = 3
    newStartVnode = 3
    newEndVnode = 2
    ```
    新旧首尾节点都未交叉，继续执行循环，第二轮比对：
    ```javascript
    /**
     * 1 ->2 3
     * 3 ->2 1
     */
    ```
    这一轮又找到了找到`sameVnode(oldStartVnode, newEndVnode) === true`，和第一轮的执行一样，将节点2插入到节点3的下一个节点（这里就是节点1）之前：</br>
    ```html
    <div id="app">
      <p>3</p>
      <p>2</p>
      <p>1</p>
    </div>
    ```
    然后将oldStartIdx和newEndIdx进位:
    ```javascript
    oldStartIdx = 2
    oldEndIdx = 2
    newStartIdx = 0
    newEndIdx = 0
    oldStartVnode = 3
    oldEndVnode = 3
    newStartVnode = 3
    newEndVnode = 3
    ```
    新旧首尾节点都未交叉，继续执行循环，第三轮比对：
    ```javascript
    /**
     *   1 2 ->3
     * ->3 2 1
     */
    ```
    这一轮明显的oldStartVnode和newStartVnode就是sameVnode，再和第一轮一样比对下两个节点的子节点，然后既然头头相同，只要简单的执行进位操作就好了：
    ```javascript
    oldStartIdx = 3
    oldEndIdx = 2
    newStartIdx = 1
    newEndIdx = 0
    ```
    在进入下一轮循环前，判断oldStartIdx > oldEndIdx退出循环。

    这就是一次完整的diff过程，同时也要注意，我举的粟子是带key的，如果不带key，那么因为undefined === undefined，那么两个节点对比中，key肯定相等，而其他条件也相等，</br>
    所以第一轮比对，老节点的开始节点1和新节点的开始节点3就会判定会sameVnode，然后走patchVnode的过程中，会先把属性全部更新到真实dom上，那么实际上页面就变成了：</br>
    ```html
    <div id="app">
      <p>3</p>
      <p>2</p>
      <p>3</p>
    </div>
    ```
    后续几轮也同样，换句话说就不存在相同节点复用这个说法了，所以在Vue中，经常看到列表循环要加key，且不推荐用下标index作为key。




