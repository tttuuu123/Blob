当一个数据做过响应式处理后，修改这个数据，无论其是纯对象，数组亦或基本类型，最终触发的都是：
```javascript
/**
 * 触发场景有
 * - 代理拦截的set方法中触发
 * - 调用数据的7种方法操作修改数组元素
 * - $set和$delete方法
 */
dep.notify()
```

而dep的notify方法内部做的是执行所有收集到的Watcher的update方法：

```javascript
/* core/observer/dep.js */
notify () {
  const subs = this.subs.slice()
  for (let i = 0, l = subs.length; i < l; i++) {
    subs[i].update()
  }
}
```

update方法内部这么做的：
```javascript
/* core/observer/watcher.js */
update () {
  if (this.lazy) {
    this.dirty = true
  } else if (this.sync) {
    this.run()
  } else {
    queueWatcher(this)
  }
}
```

其中，lazy的判定是给计算属性（computed）使用，sync是给监听属性（watch）使用，那么明显的改值触发的就是最后一个queueWatcher了：

```javascript
/* core/observer/scheduler.js 有删减 */
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  if (has[id] == null) {
    has[id] = true
    queue.push(watcher)
    // queue the flush
    if (!waiting) {
      waiting = true
      nextTick(flushSchedulerQueue) // 一次更新中只执行一次
    }
  }
}
```

Vue在Watcher实例内部会为每个Watcher伴生一个唯一标识（一个自增的id），在触发了queueWatcher后会根据`has[id]`将还未入队的Watcher入队（**这一步很关键，说明了在一次更新中，重复的Watcher只有第一次会入队**），最后执行了`nextTick(flushSchedulerQueue)`。

首先看nextTick方法：

```javascript
/* core/util/next-tick.js 有删减 */
export function nextTick (cb?: Function, ctx?: Object) {
  callbacks.push(() => cb.call(ctx))
  if (!pending) {
    pending = true
    timerFunc() // 一次更新中只执行一次
  }
}
```

接收一个cb方法，在callbacks数组中放入这个cb方法，然后执行了timerFunc方法，</br>
这个timerFunc在通常情况下是这样定义的：

```javascript
/* core/util/next-tick.js 有删减 */
function flushCallbacks () {
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

const p = Promise.resolve()
timerFunc = () => {
  p.then(flushCallbacks)
}
```

明显的，`p.then(flushCallbacks)`将flushCallbacks方法存入了微任务队列中等待宿主环境执行（如果不支持Promise，Vue会按照`Promise` -> `MutationObserver` -> `setImmediate` -> `setTimeout`做降级处理）。</br>
在`flushCallbacks`方法中就是遍历（收集了`flushSchedulerQueue`的）callbacks，执行每个回调。</br>
即nextTick方法作用就是将传入的cb加入到callbacks数组中，这个数组会在微任务队列中等待遍历执行内部的每个cb。

回到上文的queueWatcher方法中，可以看到：

```javascript
if (!waiting) {
  waiting = true
  nextTick(flushSchedulerQueue)
}
```

分析过nextTick方法就是将传入的cb在某个微任务中执行，而queueWatcher中执行过一次nextTick方法后就将waiting置为true，所以后续只会对`has[id]`不存在的Watcher执行`queue.push(watcher)`入队，
而不会再执行nextTick方法，这说明在一次更新过程中，所有Watcher触发的更新只会在第一个Watcher的update方法执行后，调用一次nextTick方法将flushSchedulerQueue作为cb加入到callbacks数组中。

那么再来看flushSchedulerQueue：

```javascript
/* core/observer/scheduler.js 有删减 */
function flushSchedulerQueue () {
  flushing = true
  let watcher, id
  queue.sort((a, b) => a.id - b.id)

  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    id = watcher.id
    has[id] = null
    watcher.run()
  }
}
```

flushSchedulerQueue内部就是将之前的queue遍历执行watcher的run方法。</br>
所以这个方法也解释了为什么一次更新中nextTick只需要调用一次，因为nextTick方法是将flushSchedulerQueue这个方法在微任务中执行，</br>
而flushSchedulerQueue方法内部才是真正的遍历执行queue中收集的所有Watcher的run方法，</br>
当创建了flushSchedulerQueue后，后续的更新Watcher只需要加入queue中就可以等待被执行了。

当Watcher的run方法执行后，内部调用了一次Watcher的get方法，响应式原理一文中有介绍过get方法内部会调用getter方法，</br>
而getter方法通常就是updateComponent方法，最终走到了渲染机制那边。

以上就是Vue的批量异步更新原理，配合`Vue 异步更新 脑图`看更为清晰。

举个粟子：

```javascript
const node = document.getElementById('tar');
Promise.resolve().then(() => {
  console.log('promise1');
});
this.$nextTick(() => {
  console.log('1:', node.innerText);
});
this.a = '第一次改变';
Promise.resolve().then(() => {
  console.log('promise2');
});
this.$nextTick(() => {
  console.log('2:', node.innerText);
});
this.a = '第二次改变';
this.$nextTick(() => {
  console.log('3:', node.innerText);
});
Promise.resolve().then(() => {
  console.log('promise3');
});
```

在浏览器的事件循环中会不停的从（多个）消息队列中挑选出一个最老的任务（宏任务）执行，每个宏任务都关联了一个微任务队列，在主函数执行完毕，当前宏任务结束之前，会遍历执行这个微任务队列。

而Vue中也要关注两个队列queue和callbacks：

callbacks是收集nextTick(cb)的cb，并封装一个遍历执行callbacks中每个回调的方法（flushCallbacks()）加入到微任务队列中等待执行，</br>
上文代码注释中提到该方法一次更新中只会执行一次，因为后续调用nextTick方法只需要加入到callbacks中即可，这说明了所有nectTick方法的回调在一次更新过程中会依次执行。

queue是queueWatcher方法中收集的所有Watcher的集合，所以当被劫持的属性的set方法触发后，当前（未入队过的）Watcher就会入队，</br>
并同样的封装一个遍历执行queue中每个回调的方法（flushSchedulerQueue()），</br>
然后调用`nextTick(flushSchedulerQueue)`（上文注释中提到一次更新中也只会执行一次），加入callbacks，</br>
这说明了所有属性的更改触发的所有Watcher是作为一个整体（queue）被加入callbacks中的。</br>

换而言之，callbacks可能是这样的一个集合`[nextTickCb, flushSchedulerQueue, nextTickCb]`。</br>
而微任务队列中可能是这样的一个集合`[microtask, flushCallbacks, microtask]`。</br>
flushCallbacks方法是遍历执行callbacks，flushSchedulerQueue方法是遍历执行queue。

搞清楚了这点，上述这个粟子就很简单了，打印顺序是 `promise1` -> `1: init` -> `2: 第二次改变` -> `3: 第二次改变` -> `promise2` -> `promise3`。

