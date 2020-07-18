在一个Vue实例的初始化过程中（也就是new Vue()的过程中），经过init->initState->initData，并将响应式数据data代理到实例上后，最终执行了observe方法。

observe方法内部会为对象类型且（非对象直接return）未做响应式处理的数据创建一个Observer实例。

在Observer初始化的过程中，会先为这个对象伴生一个dep订阅器实例，并将实例本身代理到对象的_ob_属性上（也就是说每个观察者对象有个_ob_属性可以获取自身，也就意味着可以通过_ob_.dep拿到自己的订阅器以及订阅器内部可能收集的订阅者）。

接着就是对数据做响应式处理，数组通过覆盖原链并且遍历再次observe每个元素；纯对象对属性的集合遍历调用defineReactive方法并再次observe这个属性的值。

最终目的是为每个对象创建一个Observer实例，这就意味着每个对象都会伴生一个dep，并且有一个_ob_的属性指向Observer实例，同时对纯对象的每个key也伴生一个dep，并对每个key用Object.defineProperty做代理拦截。

initData到这里就结束了，后面执行一些方法后，最终要执行vue的$mount方法，$mount方法内部会走到mountComponent。

mountComponent方法内部核心是：

```javascript
/* /core/instance/lifecycle.js */
new Watcher(vm, updateComponent, noop, {
  before () {
    if (vm._isMounted && !vm._isDestroyed) {
      callHook(vm, 'beforeUpdate')
    }
  }
}, true /* isRenderWatcher */)
```
这也说明Vue2是为每个Vue实例创建一个Watcher，所以才需要虚拟dom patch比较来找出新旧节点变化，复用未变化部分，变化部分执行相应dom操作。

在new Watcher的过程中要获取当前Watcher监听的数据的值，也就是执行get方法：
```javascript
/* core/observer/watcher.js */
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
/* core/observer/watcher.js */
updateComponent = () => {
  vm._update(vm._render(), hydrating)
}
```

其内部实际上是先通过vm._render()获取vdom，在调用vm._update()最终生成真实dom,这部分涉及到Vue渲染，patch，这里暂且不提。</br>
在这个过程中，会去获取所有render函数内用到的变量的值，如果是一个响应式数据，就会触发响应式数据的get:

```javascript
/* core/observer/index.js */
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

因为Dep.target指向了这个Watcher实例，所以执行了dep.depend()，要注意这个方法内部实际实行的是Watcher实例的addDep：
```javascript
/* core/observer/watcher.js */
addDep (dep: Dep) {
  const id = dep.id
  if (!this.newDepIds.has(id)) {
    this.newDepIds.add(id)
    this.newDeps.push(dep)
    if (!this.depIds.has(id)) {
      dep.addSub(this)
    }
  }
}
```
最终会在Watcher实例内存一个dep实例，同时在dep实例内存入当前的Watcher，也就是说这一步是双向收集的。

如果当前这个key的值也是个对象，即<br />
```javascript
/* core/observer/index.js */
let childOb = !shallow && observe(val);
```
这一步，childOb有值，那么会为当前这个key的值，也就是子对象的的dep实例内收集当前的Watcher。<br />

以上就是初始响应式部分的完整的逻辑，同时也可以看出Vue初始化会为所有响应式数据做好处理。。

当后续改变响应式数据时，通常会触发set方法
```javascript
/* core/observer/index.js */
val = newVal
childOb = !shallow && observe(newVal)
dep.notify()
```
先赋值，修改后的值newVal也可能是个对象，所以调用observe方法，并更新childOb的值，然后调用当前key伴生的dep去通知Watcher更新。</br>
dep的notify方法内部是调用该dep收集到的每个watcher实例的update方法，通常情况下是触发queueWatcher(watcher)，这涉及到Vue批量异步更新策略。


下面说一些零碎的：
- 在数据劫持的get方法中childOb.dep.depend()的作用：<br />
  1、响应式数据的响应式逻辑实现：<br />
    由于数组是对象，上文说过Vue的响应式处理会为每个对象创建一个Observer实例，所以可以从数组上拿到他自身的_ob_，<br />
    调用数据的7种方法，最终执行的就是_ob_.dep.notify()，而这个ob实例dep内的Watcher就是在childOb.dep.depend()这一步收集的。<br />

  2、Vue提供 修改/删除 纯对象属性/数组元素 的 set/delete方法：<br />
    如果传入的target是响应式数据，那就会调用defineReactive(target._ob_.value, key, val)，<br />
    然后执行target._ob_.dep.notify()去通知Watcher更新。<br />

- Vue 响应式的设计会生成多少个Observer实例，多少个dep实例：<br />
  只要调用了对数据调用了observe方法，并且该数据是对象，就会生成一个Observer实例，并且伴生一个dep实例。<br />
  同样的，在defineReactive方法中，会为每一个key也伴生一个dep实例。<br />
  举个粟子:<br />
  ```javascript
  data: {
    a: {
      b: 1,
      c: [],
    },
  };
  observe(data);
  ```
  首先要分清楚
  key是
  ```javascript
  data
  ```
  value是
  ```javascript
  {
    a: {
      b: 1,
      c: [],
    },
  }
  ```
  Observer构造函数内执行的是：
  ```javascript
  /* core/observer/index.js */
  this.dep = new Dep()
  if (Array.isArray(value)) {
    if (hasProto) {
      protoAugment(value, arrayMethods)
    } else {
      copyAugment(value, arrayMethods, arrayKeys)
    }
    this.observeArray(value)
  } else {
    this.walk(value)
  }
  ```
  因为这个值是对象，所以Vue会为这个值创建一个Observer实例，并且伴生一个dep实例，然后因为这个值不是数组，是个纯对象，所以Observer会对值内每个key调用defineReactive方法。<br />
  在defineReactive方法有两行核心代码是：
  ```javascript
  /* core/observer/index.js */
  const dep = new Dep();
  let childOb = !shallow && observe(val)
  ```
  说明了Vue会为纯对象值的每个key都伴生一个dep实例，然后检测这个key对应的val是不是对象，如果是，则会为这个对象创建一个Observer实例，然后继续重复上述流程。</br>
  在这个递归过程中会在defineReactive方法中碰到一个key是c的数组，数组也是对象，那么Vue为其调用observe方法后也会为其创建一个Observer实例，</br>
  在Observer的构造器中检测是数组，就先做原型替换（如果检测到不支持_proto_，就执行copyAugment，简单粗暴的在这个数组上定义改写后的7种method属性），然后执行了observeArray方法：
  ```javascript
  /* core/observer/index.js */
  observeArray(items: Array < any > ) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
  ```
  该方法即使为数组中每个对象元素继续建立响应式。</br>
  以上就是数据响应式完整的创建步骤。</br>
  综上，这个例子中，Observer实例数量有data的值，a的值和c的值合计3个；dep的实例有3个Observer伴生的加上b合计4个。</br>
  当然在实际场景中，自2.4.0版本起，Vue新增了两个实例属性$attrs和$listeners，Vue的响应式中会首先对这2个key调用defineReactiv方法(这2个key的值默认是个空对象)，</br>
  所以实际上的Observer实例和dep实例还是有更多额外因素的，比如要考虑父亲节点传入的属性，以及实例本身的inheritAttrs选项的值等。

- Vue的响应式优化：<br />
  上文提到了Vue会对要做响应式处理的数据内每个对象，对象的key都分别做对应的响应式处理。</br>
  实际项目中很可能遇到纯展示的场景，而这些场景使用的数据是对象，那么这个对象实际上没必要做响应式处理。</br>
  那么可以对这个对象本身调用Object.freeze()方法冻结它，这样就可以Vue就只会为其创建一个Observer实例。</br>
  同时，Vue内部的空对象也是这么定义的：
  ```javascript
  export const emptyObject = Object.freeze({})
  ```



