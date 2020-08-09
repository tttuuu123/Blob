Vue中的事件可以分为自定义事件和原生事件。

```html
<div id="demo">
  <p @click="onPClick">原生事件</p>
  <Comp @comp-click="onCompClick" />
</div>

<script>
  const app = new Vue({
    components: {
      Comp: {
        template: `<div @click="$emit('comp-click')">自定义事件</div>`,
      },
    },
    el: "#demo",
    methods: {
      onPClick() {
        console.log('原生');
      },
      onCompClick() {
        console.log('自定义');
      },
    },
  });

  console.log(app.$options.render);
</script>
```

这段模板对应的渲染函数是：

```javascript
ƒ anonymous() {
  with(this){
    return _c(
      'div',
      {attrs:{"id":"demo"}},
      [
        _c('p',{on:{"click":onPClick}},[_v("原生事件")]),
        _v(" "),
        _c('comp',{on:{"comp-click":onCompClick}})
      ]
    ,1)
  }
}
```

可以看到对于原生标签p，点击事件click是定义在on属性上，还包括了事件名称和事件的回调函数。</br>
而对于自定义事件comp-click实际上同p标签在render函数内的表现是一样的。</br>
所以可以看出在编译阶段，原生和自定义事件的解析没有区别。</br>
实际上的区分是在patch函数内在创建这个dom元素，也就是createElm方法内处理的。

- 对于原生标签的事件，createElm方法内有：

```javascript
/* /core/vdom/patch.js createElm部分 */
const data = vnode.data
if (isDef(data)) {
  invokeCreateHooks(vnode, insertedVnodeQueue)
}
```

如果原生标签定义了data属性（这个data就是渲染函数的第二个参数），就会执行invokeCreateHooks方法，创建勾子：

```javascript
/* /core/vdom/patch.js 有删减 */
function invokeCreateHooks (vnode, insertedVnodeQueue) {
  for (let i = 0; i < cbs.create.length; ++i) {
    cbs.create[i](emptyNode, vnode)
  }
}
```

这个cbs是在createPatchFunction函数内定义的，内部收集了modules中定义的一些模块的勾子方法。

```javascript
/* /core/vdom/patch.js 有删减 */
const hooks = ['create', 'activate', 'update', 'remove', 'destroy']

export function createPatchFunction (backend) {
  let i, j
  const cbs = {}

  const { modules, nodeOps } = backend

  for (i = 0; i < hooks.length; ++i) {
    cbs[hooks[i]] = []
    for (j = 0; j < modules.length; ++j) {
      if (isDef(modules[j][hooks[i]])) {
        cbs[hooks[i]].push(modules[j][hooks[i]])
      }
    }
  }
}
```

可以看到invokeCreateHooks是执行了cbs中create内的所有回调函数执行了一遍。</br>
modules内定义的模块的勾子可以在`/platforms/web/runtime/modules/index.js`内看到。</br>

而原生事件走的是updateDOMListeners：

```javascript
/* /platforms/web/runtime/modules/events.js 有删减 */
function add (
  name: string,
  handler: Function,
  capture: boolean,
  passive: boolean
) {
  target.addEventListener(
    name,
    handler,
    supportsPassive
      ? { capture, passive }
      : capture
  )
}

function updateDOMListeners (oldVnode: VNodeWithData, vnode: VNodeWithData) {
  if (isUndef(oldVnode.data.on) && isUndef(vnode.data.on)) {
    return
  }
  const on = vnode.data.on || {}
  const oldOn = oldVnode.data.on || {}
  target = vnode.elm
  normalizeEvents(on)
  updateListeners(on, oldOn, add, remove, createOnceHandler, vnode.context)
  target = undefined
}
```

updateDOMListeners内会执行updateListeners，其内部执行了传入的add方法。</br>
可以看到最终原生事件还是使用的addEventListener，只不过在这个过程中做了很多异常以及兼容性处理。


- 而对于自定义组件上的自定义事件，在createElm会走createComponent方法，</br>
然后依次执行了组件勾子上的init，createComponentInstanceForVnode方法去创建组件实例（`return new vnode.componentOptions.Ctor(options)`），</br>
Vue中创建组件实例实际上就是`new Ctor`，所以又会去执行_init方法去初始化，在_init方法内又会执行initEvents方法初始化事件监听，initEvents内会执行了updateComponentListeners：

```javascript
/* /core/instance/events.js */
function add (event, fn) {
  target.$on(event, fn)
}

export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm)
  target = undefined
}
```

可以看到内部也是要执行updateListeners这个方法，但是要注意传入的add方法就是一个`target.$on`，而非原生事件的`target.addEventListener`，</br>
所以执行updateListeners时，其内部就是在实例上`$on`了事件，在以后会被实中定义的原生事件触发时执行的`$emit`触发（例子中的onCompClick是被组件内的div上原生事件click触发的）。

要注意自定义事件的监听者和派发者均是组件实例自身，同样的自定义组件上的自定义事件必然伴随着原生事件的监听和处理。

