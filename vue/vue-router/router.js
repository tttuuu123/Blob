/**
 * 目标
 * 实现VueRouter类和install⽅法
 * 实现两个全局组件：router-view⽤于显示匹配组件内容，router-link⽤于跳转
 * 监控url变化：监听hashchange或popstate事件
 * 响应最新url：创建⼀个响应式的属性current，当它改变时获取对应组件并显示
 */

let _Vue;
class VueRouter {
  constructor(options) {
    this.$options = options;

    this.routeMap = new Map();
    this.$options.routes.forEach((route) => {
      this.routeMap.set(route.path, route);
    });

    // const initial = window.location.hash.slice(1) || '/';
    // _Vue.util.defineReactive(this, 'current', initial); // 劫持current，做响应式处理，current变化，router-view组件触发render
    this.current = this.current = window.location.hash.slice(1) || '/';
    _Vue.util.defineReactive(this, 'matched', []);
    this.match();

    window.addEventListener('hashchange', this.onHashChange.bind(this))
    // window.addEventListener('load', this.onHashChange.bind(this))
  }

  onHashChange() {
    // 源码中获取hash做了其他处理，因为window.location.hash在各个浏览器中表现不一致，firefox会pre-decode
    this.current = window.location.hash.slice(1);
    this.matched = [];
    this.match();
  }

  match(routes) {
    routes = routes || this.$options.routes;
    for (const route of routes) {
      if (route.path === '/' && this.current === '/') {
        this.matched.push(route);
        return;
      }
      if (route.path !== '/' && this.current.indexOf(route.path) !== -1) {
        this.matched.push(route);
        if (route.children && route.children.length > 0) {
          this.match(route.children);
        }
        return;
      }
    }
  }
}

const isDef = v => v !== undefined;

VueRouter.install = (Vue) => {
  _Vue = Vue;

  // 挂载$router
  Vue.mixin({
    beforeCreate() {
      if (isDef(this.$options.router)) {
        this._routerRoot = this;
        this._router = this.$options.router;
        Vue.util.defineReactive(this, '_route', this._router.current)
      } else {
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this;
      }
      
    },
  });

  Object.defineProperty(Vue.prototype, '$router', {
    get() {
      return this._routerRoot._router;
    },
  });

  Object.defineProperty(Vue.prototype, '$route', {
    get() {
      return this._routerRoot._route;
    },
  });

  // 实现 router-view
  Vue.component('router-link', {
    props: {
      to: {
        type: String,
        required: true,
      },
    },
    render(h) {
      return h('a', {
        attrs: {
          href: `#${this.to}`,
        },
      }, this.$slots.default)
    },
  });

  // 实现 router-link, 支持嵌套路由
  Vue.component('router-view', {
    render(h) {
      // 标记当前router-view深度
      this.$vnode.data.routerView = true;

      let depth = 0;
      let parent = this.$parent;
      while(parent) {
        const vnodeData = parent.$vnode && parent.$vnode.data;
        if (vnodeData) {
          if (vnodeData.routerView) {
            depth += 1;
          }
        }
        parent = parent.$parent;
      }

      let comp = null;
      const route = this.$router.matched[depth];
      if (route) {
        comp = route.component;
      }

      // const route = this.$router.routeMap.get(this.$router.current);
      // const comp = route ? route.component : null;
      return h(comp);
    },
  });
}