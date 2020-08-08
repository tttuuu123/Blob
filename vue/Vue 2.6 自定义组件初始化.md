任何一个Vue实例，首先有个根实例（`new Vue()`，这个跟实例中的data可以是对象，因为它是唯一的），然后有一个根组件（一般是`id="app"`的App根组件），然后才会是子组件,</br>
前文提过Vue中的组件是从上到下初始化（创建），从下到上挂载。

而从执行过程的角度看，父子组件的创建过程如下：

```javascript
/* stack trace */
Vue              // new Vue
Vue._init        // 父组件初始化
Vue.$mount       // 父组件想要挂载
mountComponent   // 真正的挂载函数
Watcher          // mountComponent内为每个实例创建一个watcher
get              // watcher实例的创建过程（即执行constroctor）会触发一次get方法
updateComponent  // 实例的watcher的get方法执行的就是updateComponent
Vue._update      // updateComponent内执行的就是_updata方法
patch            // 浏览器内_updata就是patch方法
createElm        // 创建父元素
createChildren   // 创建父元素的过程中在真实dom中插入父元素前，会创建子元素
createElm        // createChildren就是遍历父元素的children，并创建
createComponent  // 子元素被判定为component执行的方法
init             // 创建子组件
createComponentInstanceForVnode  // 创建子组件
VueComponent     // 子组件实例化
Vue._init        // 子组件的初始化
```

那么自定义组件的初始化过程（即自定义组件的声明）首先肯定要看Vue.component这个全局api。</br>
全局api在initGlobalAPI方法内声明的，自定义组件真正要看的是initAssetRegisters方法：</br>

```javascript
/* /core/global-api/assets.js 有删减 */
export function initAssetRegisters (Vue: GlobalAPI) {
  ASSET_TYPES.forEach(type => {
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id
          definition = this.options._base.extend(definition)
        }
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
```

正常定义组件是`Vue.component('comp', { ...options })`、</、r>
initAssetRegisters方法中也是接收两个参数id和definition，即这个例子中id就是'comp'，definition就是options，</br>
可以看到首先设置了组件name，如果用户未在definition中定义，就用id，</br>
其次调用extend方法生成构造函数。</br>
最后在全局的options中的components属性中加入这个自定义组件的id，值为这个自定义组件的构造函，即这个例子全局注册的是`Vue.options.components.comp = compCtor;`。

然后来看看自定义组件是如何转换为vnode的。</br>
首先在$mount过程中会先进行模板编译这个例子中comp就是编译为`_c('comp')`，而模板编译最终会返回一个render函数并添加在vm.$options上。
然后在组件watcher创建过程中执行了updateComponent，实际也就是执行了`vm._update(vm._render(), hydrating)`，
`vm._render()`内部核心就是从options中取出render函数，传入vm.$createElement()方法并执行得到vnode：

```javascript
/* /core/instance/render.js 有删减 */
Vue.prototype._render = function (): VNode {
  const vm: Component = this
  const { render, _parentVnode } = vm.$options
  vnode = render.call(vm._renderProxy, vm.$createElement)
  return vnode
```

vm.$createElement()是Vue中定义的用来创建元素节点的方法，而传入render方法中就是开发中（不写模板template）直接写渲染函数，Vue会提供的那个h()方法。</br>
vm.$createElement是initRender方法中定义的：</br>
vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)</br>
而createElement内真正执行的是_createElement方法：

```javascript
/* /core/vdom/create-element.js 有删减 */
export function _createElement (
  context: Component,
  tag?: string | Class<Component> | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number
): VNode | Array<VNode> {
  let vnode, ns
  if (typeof tag === 'string') {
    let Ctor
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag)
    if (config.isReservedTag(tag)) {
      vnode = new VNode(
        config.parsePlatformTagName(tag), data, children,
        undefined, undefined, context
      )
    } else if ((!data || !data.pre) && isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // component
      vnode = createComponent(Ctor, data, context, children, tag)
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
    }
  } else {
    // direct component options / constructor
    vnode = createComponent(tag, data, context, children)
  }
}
```

可以看到_createElement接收的参数是上下文，标签，数据，子元素。</br>
会根据传入的标签类型做不同的处理：</br>
  如果标签是字符串：</br>
    如果是原生的标签（config.isReservedTag，浏览器内的具体的原生标签可以在`/platforms/web/util/element.js`文件内看到），就创建一个与对应原生标签对应的vnode。</br>
    如果是组件（判断条件是，在当前上下文的$options的components内找到了这个tag标签），就去获取组件的构造函数。</br>
    否则直接生成vnode。</br>
  否则直接创建组件。

再来看createComponent，也就是自定义组件的vnode是如果创建的。

```javascript
/* /core/vdom/create-component.js 有删减 */
export function createComponent (
  Ctor: Class<Component> | Function | Object | void,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag?: string
): VNode | Array<VNode> | void {
  // install component management hooks onto the placeholder node
  installComponentHooks(data)

  // return a placeholder vnode
  const name = Ctor.options.name || tag
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )
  return vnode
}
```

从参数上看，第一个参数是Ctor，后续是数据，上下文，子元素，标签。</br>
第一个参数Ctor可以是构造函数、函数、配置对象，还可能没有，所以要做兼容处理，保证最后会生成一个构造函数。</br>
然后对数据做一些处理，例如对实例化传入的data和自身的data做一些合并，对函数式组件做一些处理，还包括自定义事件监听和原生事件监听。</br>
这样就到了核心方法installComponentHooks，这个方法提供了一些勾子以供以后创建组件dom的时候执行：

```javascript
/* /core/vdom/create-component.js */
function installComponentHooks (data: VNodeData) {
  const hooks = data.hook || (data.hook = {})
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    const existing = hooks[key]
    const toMerge = componentVNodeHooks[key]
    if (existing !== toMerge && !(existing && existing._merged)) {
      hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
    }
  }
}
```

installComponentHooks就是把用户（在data中定义的）自定义的勾子和Vue预定义的勾子做一个merge，预定义钩子就是hooksToMerge中来的。

```javascript
/* /core/vdom/create-component.js 有删减 */
const hooksToMerge = Object.keys(componentVNodeHooks)

const componentVNodeHooks = {
  init (vnode: VNodeWithData, hydrating: boolean): ?boolean {
    const child = vnode.componentInstance = createComponentInstanceForVnode(
      vnode,
      activeInstance
    )
    child.$mount(hydrating ? vnode.elm : undefined, hydrating)
  },
  prepatch (oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {},
  insert (vnode: MountedComponentVNode) {},
  destroy (vnode: MountedComponentVNode) {},
}
```

Vue预定义的组件勾子有init（创建），prepatch（更新），insert（插入），destroy（销毁）。</br>
其中init方法就是创建了自定义组件的实例，并挂载。

回到createComponent方法，在勾子install后，就会创建vnode，</br>
这里可以看到Vue为自定义组件的命名为 ``vue-component-${Ctor.cid}${name ? `-${name}` : ''}``，</br>
即例子`Vue.component('comp', { ...options })`的组件名可能是`vue-component-1-comp`。</br>
最后返回了vnode。

所以到这里是得到了自定义组件的vnode。</br>
后续会走patch方法，patch方法内要将vnode转换为真实dom会执行createElm。</br>

```javascript
/* /core/vdom/patch.js 有删减 */
function createElm (
    vnode,
    insertedVnodeQueue,
    parentElm,
    refElm,
    nested,
    ownerArray,
    index
  ) {
  if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
    return
  }
}
```

createElm会先判断当前vnode是否为自定义组件。

```javascript
/* /core/vdom/patch.js 有删减 */
function createComponent (vnode, insertedVnodeQueue, parentElm, refElm) {
  let i = vnode.data
  if (isDef(i)) {
    const isReactivated = isDef(vnode.componentInstance) && i.keepAlive
    if (isDef(i = i.hook) && isDef(i = i.init)) {
      i(vnode, false /* hydrating */)
    }
    // after calling the init hook, if the vnode is a child component
    // it should've created a child instance and mounted it. the child
    // component also has set the placeholder vnode's elm.
    // in that case we can just return the element and be done.
    if (isDef(vnode.componentInstance)) {
      initComponent(vnode, insertedVnodeQueue)
      insert(parentElm, vnode.elm, refElm)
      if (isTrue(isReactivated)) {
        reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm)
      }
      return true
    }
  }
}
```

createComponent作用是创建自定义组件，</br>
首先获取了组件的勾子，然后执行了组件勾子的init方法，init方法就是上文说的创建自定义组件的实例，并挂载。</br>
然后将这个组件插入到父元素上。</br>
这就是自定义组件初始化的过程了。
