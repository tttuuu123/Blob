在一个Vue实例的初始化过程中，经过init->initState->initData，并将响应式数据data代理到实例上后，最终执行了observe方法。

observe方法内部会为对象类型且（非对象直接return）未做响应式处理的数据创建一个Observer实例。

在Observer初始化的过程中，会先为这个对象伴生一个dep订阅器实例，并将实例本身代理到对象的_ob_属性上（也就是说每个观察者对象有个_ob_属性可以获取自身，也就意味着可以通过_ob_.dep拿到自己的订阅器以及订阅器内部可能的订阅者）。

接着就是对数据做响应式处理，数组通过覆盖原链并且遍历再次observe每个元素；纯对象对属性的集合遍历调用defineReactive方法并再次observe这个属性的值。

最终目的是为每个对象创建一个Observer实例，这就意味着每个对象都会伴生一个dep，并且有一个_ob_的属性指向Observer实例，同时对纯对象的每个key也伴生一个dep，并对每个key用Object.defineProperty做代理拦截。

initData到这里就结束了，后面执行一些方法后，最终要执行vue的$mount方法，$mount方法内部会走到mountComponent。

mountComponent方法内部核心是：

```javascript
new Watcher(vm, updateComponent, noop, {
  before () {
    if (vm._isMounted && !vm._isDestroyed) {
      callHook(vm, 'beforeUpdate')
    }
  }
}, true /* isRenderWatcher */)
```

在new Watcher的过程中要获取当前Watcher监听的数据的值，也就是执行get方法：
```javascript
get () {
  pushTarget(this)
  let value
  const vm = this.vm
  try {
    value = this.getter.call(vm, vm)
  } catch (e) {
    if (this.user) {
      handleError(e, vm, `getter for watcher "${this.expression}"`)
    } else {
      throw e
    }
  } finally {
    // "touch" every property so they are all tracked as
    // dependencies for deep watching
    if (this.deep) {
      traverse(value)
    }
    popTarget()
    this.cleanupDeps()
  }
  return value
}
```

get方法内部先将Dep.target指向了这个Watcher实例，然后调用getter方法，也就是传入的updateComponent方法

```javascript
updateComponent = () => {
  vm._update(vm._render(), hydrating)
}
```

其内部实际上是先通过vm._render()获取vdom，在调用vm._update()最终生成真实dom。
在这个过程中，会要去获取所有render函数内用到的变量的值，如果是一个响应式数据，就会触发响应式数据的get:

```javascript
get: function reactiveGetter() {
  const value = getter ? getter.call(obj) : val
  if (Dep.target) {
    dep.depend()
    if (childOb) {
      childOb.dep.depend()
      if (Array.isArray(value)) {
        dependArray(value)
      }
    }
  }
  return value
},
```

因为Dep.target指向了这个Watcher实例，所以执行了dep.depend()，要注意这个方法内部实际实行的是Watcher实例的addDep，最终会在Watcher实例内存一个dep实例，同时在dep实例内存入当前的Watcher，
也就是说这一步是双向的。

如果当前这个key的值也是个对象，即
let childOb = !shallow && observe(val) 
这一步，childOb有值，那么会为当前这个key的值，也就是子对象的的dep实例内收集当前的Watcher。

这也说明Vue2是为每个Vue实例创建一个Watcher，所以才需要虚拟dom patch比较来找出新旧节点变化，复用未变化部分，变化部分执行相应dom操作。同时也可以看出Vue初始化会为所有响应式数据做好处理。

以上就是初始响应式部分的完整的逻辑。


下面说一些零碎的：

- 响应式数据的set方法：
```javascript
  val = newVal
  childOb = !shallow && observe(newVal)
  dep.notify()
```
  先赋值，修改后的值newVal也可能是个对象，所以调用observe方法，并更新childOb的值，然后调用当前key伴生的dep去通知Watcher更新。

- 在数据劫持的get方法中childOb.dep.depend()的作用：
  1、响应式数据的响应式逻辑实现：
    由于数组是对象，上文说过Vue的响应式处理会为每个对象创建一个Observer实例，所以可以从数组上拿到他自身的_ob_，
    调用数据的7种方法，最终执行的就是_ob_.dep.notify()，而这个ob实例dep内的Watcher就是在childOb.dep.depend()这一步收集的。

  2、Vue提供 修改/删除 纯对象属性/数组元素 的 set/delete方法：
    如果传入的target是响应式数据，那就会调用defineReactive(target._ob_.value, key, val)，
    然后执行target._ob_.dep.notify()去通知Watcher更新。



