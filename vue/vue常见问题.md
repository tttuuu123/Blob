- key的作用和原理

  源码见`src/core/vdom/patch.js`

  ```javascript
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

  主要作用是在Vue的diff算法，也就是updateChildren方法中用来比较两个节点是否相等，具体作用可以见`Vue 2.6 vdom与patch`文末的粟子，<br />
  可以看出，不加key或者key使用不适当（例如使用列表循环体下标作key），易触发Vue的强制更新，失去了dom节点复用。

  总结：
    - key的作用主要是为了高效的更新虚拟DOM，其原理是Vue在patch过程中通过key精确判断两个节点是否是同一个，<br />
      从而避免强制更新，使得整个patch过程更加高效，减少dom操作，提高性能。<br />
    - 官方文档中，在[多个元素的过渡](https://cn.vuejs.org/v2/guide/transitions.html#%E5%A4%9A%E4%B8%AA%E5%85%83%E7%B4%A0%E7%9A%84%E8%BF%87%E6%B8%A1)中提到了：<br />
      > 当有相同标签名的元素切换时，需要通过 key attribute 设置唯一的值来标记以让 Vue 区分它们，否则 Vue 为了效率只会替换相同标签内部的内容。
      > 即使在技术上没有必要，给在 <transition> 组件中的多个元素设置 key 是一个更好的实践。


- diff算法</br>
  只要涉及到虚拟dom，就会需要diff算法。<br />
  在`src/core/instance/lifecycle.js`的mountComponent方法中可以看出在Vue中watcher实例是和组件一一对应也就是只要创建一个组件，就会有一个watcher，这是为了降低watcher的粒度（降低了内存消耗），提高稳定性。但是组件中可能存在很多个data中的属性使用，为了精确知道哪些属性发生变化，所以需要diff算法执行新旧两个虚拟dom比较，比对出变化的地方。<br />
  在`src/core/vdom/patch.js`中的patchVnode方法中，可以看出diff算法是深度优先、同层比较，而在updateChildren方法中可以看出diff算法是优先首尾比较（针对web平台的优化），这样更加高效。

  总结：
    - diff算法是虚拟dom的必然产物：通过新旧虚拟dom比对，将变化之处更新到真实dom上；另外，diff算法高效的执行了比对过程，降低了时间复杂度O(n)。
    - Vue2中为了降低watcher粒度，每个组件对应一个watcher，需要diff算法精确比对变化之处。
    - Vue中diff的执行时机是组件实例执行更新函数：响应式set触发通知，watcher添加到异步更新队列，在事件循环中清空这些队列，在这个过程中，队列内所有watcher会执行更新函数，也就是调用了组件的渲染函数和更新函数（mountComponent），这个过程中会对比新旧两次虚拟dom，这个过程称为patch。
    - diff过程整体遵循深度优先、同层比较：两个节点比较会根据他们是否拥有子节点或文本节点不同做不同操作；比较两组子节点的算法是优先首尾比较做四次尝试，没有找到则遍历查找，查找结束后再根据剩余节点的情况做不同处理（批量创建或者删除）。而通过key可以精确比对相同节点，整个patch过程非常高效。


- Vue组件化的理解</br>
  Vue中的组件定义可以分为两种：全局组件和单文件组件。</br>
  对于全局组件：</br>
  在`src/core/global-api/assets.js`中的`ASSET_TYPES`存放了`['component', 'filter', 'directive']`,</br>
  遍历`ASSET_TYPES`给Vue加上了对应的静态方法，如果是`component`且是个纯对象，将其配置对象通过Vue的extend方法转换为构造函数，</br>
  然后在当前Vue的构造函数的选项中加上compoonents选项`this.options[type + 's'][id] = definition`。（在Vue 2.6 自定义组件初始化一文中有阐述）
  对于单文件组件：</br>
  实际是一个配置对象，`vue-loader`会编译`template`为`render函数`，最终导出的依然是组件配置对象。

  组件化可以有很好的复用性、维护性。</br>
  组件的实例在`执行$mount`中会调用`mountComponent`，在这个过程中会创建一个watcher与这个组件对应，</br>
  也就是说在代码运行过程中这个组件的数据发生变化，只会触发这个组件的watcher进入异步更新队列，最终只调用这个组件的渲染函数和更新函数。</br>
  那么可以合理的切割组件粒度，将数据频繁变化的部分提取成组件，那么后续频繁执行的渲染函数、更新函数、打补丁函数、比对新旧dom的范围就小了，这样代码执行效率就更高了。</br>

  组件化的实现全局组件是在Vue根实例生成前就注册在Vue的选项中，而局部组件是在`src/core/vdom/patch.js`中的`createElm`方法执行时实例化和挂载的。

  总结：
    - 组件是Vue核心特性之一，使开发者可以使用小型、独立和通常可以复用的组件构建大型应用。
    - 组件化开发能提高引用开发效率、隔离性高提高了测试性、复用性等。
    - 组件按使用分类可以分为：页面组件（比如路由导航的组件）、业务组件、通用组件（引用的外部通用库）。
    - Vue组件是基于配置的，我们通常编写是组件的配置项（options），Vue后续会基于配置项生成构造函数。
    - Vue中常见的组件化技术：props，自定义事件，插槽等，它们主要用于组件通信、扩展等。
    - 合理的划分组件，可以提高应用性能（watcher只会更新对应的组件）。
    - 组件应该是高内聚、低耦合。
    - 组件应该遵循单项数据流原则。


- Vue的设计原则</br>
  Vue官网对自己的定义和特点：</br>
    - 渐进式JavaScript框架
    - 易用、灵活和高效

  [渐进式JavaScript框架](https://cn.vuejs.org/v2/guide/#Vue-js-%E6%98%AF%E4%BB%80%E4%B9%88)：</br>
  > Vue (读音 /vjuː/，类似于 view) 是一套用于构建用户界面的渐进式框架。</br>
  > 与其它大型框架不同的是，Vue 被设计为可以自底向上逐层应用。</br>
  > Vue 的核心库只关注视图层，不仅易于上手，还便于与第三方库或既有项目整合。</br>
  > 另一方面，当与现代化的工具链以及各种支持类库结合使用时，Vue 也完全能够为复杂的单页应用提供驱动。</br>

  易用性：</br>
  Vue提供数据响应式、声明式模板语法和基于配置的组件系统等核心特性。用户只需要关心核心业务，只要工会写js、html和css就可以编写Vue应用。

  灵活性：</br>
  渐进式框架最大的优点就是灵活性。如果应用足够小，只需要Vue核心库即可，随着应用不断扩大，可以引入路由、状态管理、vue-cli等库和工具。

  高效性：</br>
  虚拟dom和diff算法的使用使得应用拥有高性能（超快虚拟DOM和最省心的优化）。</br>
  并且在Vue3中引入Proxy对数据响应式的改进以及编译器中的对静态内容编译的改进都会使得应用更加高效。


- 对MVC和MVVM的理解</br>

  V是View 很简单，就是用户看到的视图。</br>
  M是Model 同样很简单，一般就是本地数据和数据库中的数据。</br>
  基本上，我们写的产品就是通过接口从数据库中读取数据，然后将数据经过处理展现到用户看到的视图上。</br>
  当然我们还可以从视图上读取用户的输入，然后又将用户的输入通过接口写入到数据库中。</br>
  但是，如何将数据展示到视图上，然后又如何将用户的输入写入到数据中，不同的人就产生了不同的看法，从此出现了很多种架构设计。</br>

  传统的 MVC 架构通常是使用控制器更新模型，视图从模型中获取数据去渲染。当用户有输入时，会通过控制器去更新模型，并且通知视图进行更新。</br>
  但是 MVC 有一个巨大的缺陷就是控制器承担的责任太大了，随着项目愈加复杂，控制器中的代码会越来越臃肿，导致出现不利于维护的情况。</br>

  在 MVVM 架构中，引入了 ViewModel 的概念。ViewModel 只关心数据和业务的处理，不关心 View 如何处理数据，在这种情况下，View 和 Model 都可以独立出来，任何一方改变了也不一定需要改变另一方，并且可以将一些可复用的逻辑放在一个 ViewModel 中，让多个 View 复用这个 ViewModel。

  以 Vue 框架来举例，ViewModel 就是组件的实例vm，View 就是模板或者说就是vm.$el，Model 就是vm.$data，在引入 Vuex 的情况下是完全可以和组件分离的。（可以参考[官方文档](https://012.vuejs.org/guide/)）。</br>
  ViewModel通过实现一套数据响应式机制自动响应Model中数据变化； </br>
  同时Viewmodel会实现一套更新策略自动将数据变化转换为视图更新； </br>
  通过事件监听响应View中用户交互修改Model中数据。 </br>
  这样在ViewModel中就减少了大量DOM操作代码。 </br>
  MVVM在保持View和Model松耦合的同时，还减少了维护它们关系的代码，使用户专注于业务逻辑，兼顾开发效率和可维护性。</br>

  总结：</br>
    - 它们设计的目标都是为了解决Model和View的耦合问题。
    - MVC模式出现较早主要应用在后端，如Spring MVC、ASP.NET MVC等，在前端领域的早期也有应用，如Backbone.js。它的优点是分层清晰，缺点是数据流混乱，灵活性带来的维护性问题。
    - MVVM模式在前端领域有广泛应用，它不仅解决MV耦合问题，还同时解决了维护两者映射关系的大量繁杂代码和DOM操作代码，在提高开发效率、可读性同时还保持了优越的性能表现。
    - 对于 MVVM 来说，其实最重要的并不是通过双向绑定或者其他的方式将 View 与 ViewModel 绑定起来，而是通过 ViewModel 将视图中的状态和用户的行为分离出一个抽象，这才是 MVVM 的精髓。


- Vue性能优化
  - 路由懒加载，按需加载

    ```javascript
    const router = new VueRouter({ 
     routes: [ 
       { path: '/foo', component: () => import('./Foo.vue') }   ] 
    })
    ```

  - keep-alive缓存页面

  - 使用v-show复用DOM</br>
    复杂dom组件利用v-show隐藏显现，而非v-if每次重新渲染

  - v-for 遍历避免同时使用 v-if

  - 长列表性能优化</br>
    如果列表是纯粹的数据展示，不会有任何改变，就不需要做响应化。（Object.freeze或者Object.defineProperty设置configurable设置为true）</br>
    如果是大数据长列表，可采用虚拟滚动，只渲染少部分区域的内容。（vue-virtual-scroller、vue-virtual-scroll-list）

  - 事件的销毁</br>
    Vue 组件销毁时，会自动解绑它的全部指令及事件监听器，但是仅限于组件本身的事件。
  
  - 图片懒加载</br>
    （vue-lazyload）

  - 第三方插件按需引入</br>
    像element-ui这样的第三方组件库可以按需引入避免体积太大。

  - 无状态的组件标记为函数式组件 

  - 合理切割子组件</br>
    将dom变化频繁的部分抽取为组件，让组件的watcher管理自己的更新。

  - 变量本地化
    `const xx = this.xx`，不要频繁的使用`this.xx`，尤其涉及到计算属性。

    ```javascript
    <script> 
    import { heavy } from '@/utils' 

    export default { 
     props: ['start'], 
     computed: { 
       base () { return 42 }, 
       result () { 
         const base = this.base // 不要频繁引用this.base
         for (let i = 0; i < 1000; i++) { 
           result += heavy(base) 
         } 
         return result 
       } 
      } 
    } 
    </script>
    ```

    - SSR


- Vue3新特性

  总结：</br>
  - 更快：</br>
      虚拟DOM重写 </br>
      优化slots的生成：避免不必要的父子组件重新渲染（父子组件可以单独渲染） </br>
      静态树提升：将静态树缓存(内存换时间) </br>
      静态属性提升：patch跳过属性不会变的节点（但是只是跳过本身，孩子还是继续要patch） </br>
      基于Proxy的响应式系统：提高初始化速度，节省内存开销，但是低版本浏览器不支持</br>
  - 更小：通过摇树优化核心库体积 </br>
  - 更容易维护：TypeScript + 模块化 </br>
  - 更加友好：</br>
      跨平台：编译器核心和运行时核心与平台无关，使得Vue更容易与任何平台（Web、Android、iOS）一起使用 
  - 更容易使用：</br>
      改进的TypeScript支持，编辑器能提供强有力的类型检查和错误及警告 </br>
      更好的调试支持 </br>
      独立的响应化模块 </br>
      Composition API </br>


- vuex的使用和理解

  [Vuex 是什么？](https://vuex.vuejs.org/zh/#%E4%BB%80%E4%B9%88%E6%98%AF-%E7%8A%B6%E6%80%81%E7%AE%A1%E7%90%86%E6%A8%A1%E5%BC%8F)
  > Vuex 是一个专为 Vue.js 应用程序开发的状态管理模式。
  > 它采用集中式存储管理应用的所有组件的状态，并以相应的规则保证状态以一种可预测的方式发生变化。
  > Vuex 也集成到 Vue 的官方调试工具 devtools extension，提供了诸如零配置的 time-travel 调试、状态快照导入导出等高级调试功能。

  [什么情况下我应该使用 Vuex？](https://vuex.vuejs.org/zh/#%E4%BB%80%E4%B9%88%E6%83%85%E5%86%B5%E4%B8%8B%E6%88%91%E5%BA%94%E8%AF%A5%E4%BD%BF%E7%94%A8-vuex)
  > Vuex 可以帮助我们管理共享状态，并附带了更多的概念和框架。这需要对短期和长期效益进行权衡。
  > 如果您不打算开发大型单页应用，使用 Vuex 可能是繁琐冗余的。
  > 确实是如此——如果您的应用够简单，您最好不要使用 Vuex。一个简单的 store 模式就足够您所需了。
  > 但是，如果您需要构建一个中大型单页应用，您很可能会考虑如何更好地在组件外部管理状态，Vuex 将会成为自然而然的选择。

  总结：<br />
    - vuex是vue专用的状态管理库。它以全局方式集中管理应用的状态，并且保证状态变更的可预测性。
    - vuex主要解决多组件之间状态共享的问题。<br />
      利用组件之间的通信，也可以做到状态共享，但是在多组件之间保持状态的一致性很麻烦。<br />
      vuex通过抽取组件的共享状态，以全局单例模式管理，任何组件都能以一致的方式获取和修改状态，响应式数据保证了单向数据流，使代码更易维护。
    - vuex并非必须。
    - vuex实现单向数据流借助了vue的数据响应特性，所以它依赖vue（state作为data，getter作为computed）。


- vue组件通信方式

  $parent/$children：一般通用框架需要（通用框架不能强制用户安装vuex，例如element-ui就基于$parent/$children封装出了dispatch/broadcast方法）。

  $attrs/$listeners：一般用于高级组件，可以降低工作量。

  provide/inject：可以传this，当前实例的data内的数据是响应式的。

  总结：
    - 父子组件</br>
      props</br>
      $emit/$on</br>
      $parent/$children</br>
      ref</br>
      $attrs/$listeners</br>
    - 兄弟组件（利用一个中间人）
      $parent</br>
      $root</br>
      eventbus</br>
      vuex</br>
    - 跨层级</br>
      eventbus</br>
      vuex</br>
      provide/inject


- vue-router保护指定路由的安全

  全局守卫、路由独享守卫和组件内守卫区别：</br>
  作用范围不同。</br>
  组件实例获取：只有组件内实例能获取</br>
  触发顺序不同：[完整的导航解析流程](https://router.vuejs.org/zh/guide/advanced/navigation-guards.html#%E5%AE%8C%E6%95%B4%E7%9A%84%E5%AF%BC%E8%88%AA%E8%A7%A3%E6%9E%90%E6%B5%81%E7%A8%8B)。

  前后端路由区别：</br>
  前端路由一般是和显示的内容相关，后端则是和逻辑相关。

  总结：
    - vue-router中保护路由安全通常使用导航守卫来做。
    - 全局守卫beforeEach</br>
      路由独享守卫beforeEnter</br>
      组件内守卫beforeRouterEnter</br>
    - 这些钩子函数被注册到router上，当路由发生变化，router准备导航前会批量执行这些hooks。


- nextTick原理

  总结：
    - nextTick是Vue提供的一个全局API，由于vue的异步更新策略导致对数据的修改不会立刻体现在dom上，如果i想获取更新后的dom状态，就需要使用nextTick。
    - vue在更新dom时是异步执行的。只要监听到数据变化，就会开启一个队列，并缓冲同一事件循环中发生的所有数据变更。
    -  microtask因为其高优先级特性，能确保队列中的微任务在一次事件循环前被执行完毕。
    - 因为兼容性问题，vue做了microtask向macrotask的降级方案。


- vue2数据响应式理解

  缺点：</br>
  初始化的递归遍历造成性能损失。</br>
  新增或删除属性需要使用$set/$delete。</br>
  不支持es6的Map/Set。

  vue3利用es6的proxy代理的优点：</br>
  编程体验一致，不需要$set/$delete的额外api。</br>
  初始化性能和内存消耗大幅改善。</br>
  响应式的实现代码抽取为独立的reactivity包，使用更为灵活，甚至不需要引入vue。

  总结：
    - 数据响应式就是使数据变化可以被检测并且对变化的数据做出响应。
    - mvvm框架中要解决的一个核心问题就是连接数据层和视图层，通过数据驱动应用。数据响应式可以使数据发生变化就做出更新处理。
    - vue通过数据响应式加上虚拟dom和patch算法（实现了最省心的优化），使用户只需操作数据，避免频繁的dom操作，提高了开发效率，降低开发难度。
    - vue2中的响应式会根据数据类型做不同处理。</br>
      纯对象：用Object.defineProperty()的方式来劫持数据。</br>
      数组：覆盖该数组原型的七种方法，使得这些方法可以额外的做更新通知。
    - 缺点
    - vue3利用es6的proxy代理