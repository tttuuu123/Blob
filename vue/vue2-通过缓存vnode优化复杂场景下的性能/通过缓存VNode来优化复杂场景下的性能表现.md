### 敏感场景下缓存VNode提高性能

#### 什么是vnode
用普通js对象来描述dom结构，因为不是真实dom，所以称之为虚拟dom。

#### 为什么vue需要diff算法
* diff算法是虚拟dom的必然产物：通过新旧虚拟dom比对，将变化之处更新到真实dom上。
* diff算法高效的执行了比对过程，降低了时间复杂度O(n)。
* Vue2中为了降低watcher粒度，每个组件对应一个watcher，需要diff算法精确比对变化之处。

#### [vue2中能否拿到vnode](https://cn.vuejs.org/v2/api/#render)
```javascript
render
类型：(createElement: () => VNode) => VNode

详细：
字符串模板的代替方案，允许你发挥 JavaScript 最大的编程能力。该渲染函数接收一个 createElement 方法作为第一个参数用来创建 VNode。
如果组件是一个函数组件，渲染函数还会接收一个额外的 context 参数，为没有实例的函数组件提供上下文信息。
```

#### 什么是敏感场景
举个粟子：我们有一个长列表（len>1000）。
```html
<demo-ul>
  <demo-li
    v-for="(item, i) in data"
    :key="i"
    :checked="item.checked"
    @select="(val) => onSelect(val, i)">
    {{ item.checked }}
  </demo-li>
</demo-ul>
```
```javascript
const data = [];
for (let i = 0; i < 1000; i += 1) {
  data.push({
    index: i,
    checked: Math.random() > 0.5
  });
}

/* root */
new Vue({
  el: '#app',
  data: {
    data,
  },
  methods: {
    onSelect(val, i) {
      this.$set(this.data[i], 'checked', !this.data[i].checked);
    },
  }
})
```
当我们点击某一个`demo-li`组件时，我们期望仅进行该组件的新旧vnode比对。
但是当我们使用data时，`Dep.target`指向的是root对应的watcher（下文称为rootWatcher），所以data以及data内所有的对象对应的dep是被rootWatcher订阅的。触发onSelect事件时，`data[i]`这个对象的set触发，dep发布通知，rootWatch进入`watcher queue`。后续在patch过程中比对的就是rootWatcher，也就是整个root的template都会去进行比对。

#### 所以我们有办法只比对点击的这个`demo-li`么
```javascript
// vue-dev/src/core/vdom/patch.js
function patchVnode (
  oldVnode,
  vnode,
  insertedVnodeQueue,
  ownerArray,
  index,
  removeOnly
) {
  if (oldVnode === vnode) {
    return
  }
}
```
在vue的patch比对过程中，新旧vnode的对比会先比较是否相等，如果相等就直接return了。
而`render`函数执行时每次都会返回一个新的vnode，所以两次比对一定是false的。


```javascript
Vue.component('demo-li', {
  props: {
    checked: Boolean,
  },
  created() {
    this._cacheVNode = null;
    this._latestChecked = null;
  },
  render(h) {
    // 条件可以根据开发场景自由定义
    if (this._cacheVNode && this.checked === this._latestChecked) return this._cacheVNode;
    this._latestChecked = this.checked;
    this._cacheVNode = h(
      'li', 
      {
        class: 'li',
        slot: 'default',
      },
      [
        h('span', {
          attrs: {
            class: 'checkbox',
          },
          domProps: {
            innerHTML: 'btn'
          },
          on: {
            click: (e) => {
              this.$emit('select', !this.checked);
            }
          },
        }),
        ['状态： ', this.$slots.default]
      ]
    );
    return this._cacheVNode
  },
})
```
我们发现`render`函数返回的是一个vnode，所以可以缓存一下上一次的vnode，如果条件符合，就直接复用上一次的vnode。

#### benchmark
最后来写一个benchmark测试一下优化前后的渲染时间。
```javascript
onSelect(val, i) {
  const start = window.performance.now();
  this.$set(this.data[i], 'checked', !this.data[i].checked);
  setTimeout(() => {
    this.renderTime = `${(window.performance.now() - start).toFixed(2)}ms`;
  })
}
```
这个renderTime得到的结果就是一个比较精确的vue一次批量异步更新执行的时间。
当然也可以通过Chrome的performance面板看效果。

#### 我不会写render函数？
* Vue2下可以使用Vue.compile api来帮你将template转为render函数。
* Vue3下可以直接使用[v-memo](https://v3.cn.vuejs.org/api/directives.html#v-memo)。

#### 最后，附上完整的demo
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>opt example</title>
    <!-- 引入一个vue -->
    <script src="../../dist/vue.js"></script>
  </head>
  <body>
    <!-- app -->
    <div id="app">
      <div>renderTime: {{ renderTime }}</div>
      <demo-ul>
        <demo-li
          v-for="(item, i) in data"
          :key="i"
          :checked="item.checked"
          @select="(val) => onSelect(val, i)">
          {{ item.checked }}
        </demo-li>
      </demo-ul>
    </div>

    <script>
      function genVNode(h, childVNode) {
        return h('span', {
          attrs: {
            class: 'house'
          },
        }, [childVNode]);
      }

      Vue.component('demo-li', {
        props: {
          checked: Boolean,
        },
        created() {
          this._cacheVNode = null;
          this._latestChecked = null;
        },
        render(h) {
          if (this._cacheVNode && this.checked === this._latestChecked) return this._cacheVNode;
          let depth = 100;
          let curVNode = h('span', {
            attrs: {
              class: 'checkbox',
            },
            domProps: {
              innerHTML: 'btn'
            },
            on: {
              click: (e) => {
                this.$emit('select', !this.checked);
              }
            },
          });
          while (depth --) {
            curVNode = genVNode(h, curVNode)
          }

          this._latestChecked = this.checked;
          this._cacheVNode = h(
            'li', 
            {
              class: 'li',
              slot: 'default',
            },
            [
              ['状态： ', this.$slots.default],
              curVNode
            ]
          );
          return this._cacheVNode
        },
      })

      Vue.component('demo-ul', {
        render(h) {
          return h(
            'ul', 
            {
              class: 'ul',
            },
            this.$slots.default);
        },
        created() {
          this.cacheVNode = null;
        }
      })

      new Vue({
        el: '#app',
        data: {
          data: [],
          renderTime: 0
        },
        created() {
          const data = [];
          for (let i = 0; i < 1000; i += 1) {
            data.push({
              index: i,
              checked: Math.random() > 0.5
            });
          }
          this.data = data;
        },
        methods: {
          onSelect(val, i) {
            const start = window.performance.now();
            this.$set(this.data[i], 'checked', !this.data[i].checked);
            setTimeout(() => {
              this.renderTime = `${(window.performance.now() - start).toFixed(2)}ms`;
            })
          },
        }
      })
    </script>
  </body>
</html>
```
