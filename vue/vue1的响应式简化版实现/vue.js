class Vue {
  constructor(options) {
    this.$options = options;
    this.$data = options.data;
    observe(this.$data);

    /* 做一层代理，vm[key] 会取 vm.$data[key] */
    const keys = Object.keys(this.$data);
    for (let i = 0, l = keys.length; i < l; i += 1) {
      const key = keys[i];
      Object.defineProperty(this, keys[i], {
        get() {
          return this.$data[key];
        },
        set(val) {
          this.$data[key] = val;
        },
      });
    }

    new Compile('#app', this)
  }
}

function observe(obj) {
  if (!isObject(obj)) return;
  let ob;
  if (obj.hasOwnProperty('_ob_') && obj._ob_ instanceof Observer) {
    /* 如果obj自己的属性里有了Observer的实例，就直接用 */
    ob = obj._ob_;
  } else {
    ob = new Observer(obj);
  }
  return ob;
}

/* 劫持数组, 生成一个vue中需要监听的数组用的prototype */
const arrayProto = Array.prototype;
const arrayMethods = Object.create(arrayProto);
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
];
methodsToPatch.forEach((method) => {
  const original = arrayProto[method];
  Object.defineProperty(arrayMethods, method, {
    value: function mutator(...args) {
      const result = original.apply(this, args);
      const ob = this._ob_;
      let inserted;
      switch (method) {
        case 'push':
        case 'unshift':
          inserted = args;
          break;
        case 'splice':
          inserted = args.slice(2);
          break;
      }
      if (inserted) ob.observeArray(inserted);
      /* 通知数组的变更 */
      ob.dep.notify();
      return result;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });
});

function defineReactive(obj, key, val) {
  /* 方法本身利用了闭包 使得数据在内存中长久存在 */
  /**
   * 如果val是个对象则递归处理，observe方法中判断了val是否为对象，是的话会返回一个Observer的实例
   * 这样就能使得 a: {b: 1} - a.b++ 触发a的get以及b的get和set，否则只会触发a的get
   */
  let childOb = observe(val);
  /* 为每个属性创建一个Dep实例，收集这个属性的所有watcher */
  const dep = new Dep();
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter() {
      if (Dep.target) {
        dep.addDep(Dep.target);
        if (childOb) {
          // childOb.dep.addDep(Dep.target);
        }
      }
      return val;
    },
    set: function reactiveSetter(newVal) {
      if (newVal === val) return;
      childOb = observe(newVal);
      val = newVal;
      dep.notify();
    },
  })
}

/* 每一个响应式对象（vm.$data），生成一个Observe的实例 */
class Observer {
  constructor(value) {
    this.value = value;
    this.dep = new Dep();
    /* 在value上定义一个_ob_，值为实例本身 */
    /* FIXME：_ob_在哪些场景下可以直接使用 */
    Object.defineProperty(value, '_ob_', {
      value: this,
      enumerable: false,
      writable: true,
      configurable: true,
    });
    if (Array.isArray(value)) {
      /* 处理数组 */
      Object.setPrototypeOf(value, arrayMethods)
      this.observeArray(value);
    } else {
      this.walk(value);
    }
  }

  walk(obj) {
    const keys = Object.keys(obj);
    let key;
    /* 实测 for循环 比 forEach 快 */
    for (let i = 0, l = keys.length; i < l; i += 1) {
      key = keys[i];
      defineReactive(obj, keys[i], obj[key]);
    }
  }

  observeArray(value) {
    for (let i = 0, l = value.length; i < l; i += 1) {
      observe(value[i]);
    }
  }
}

/**
 * 编译过程
 * 这里简单实现vue1的compile，即为每个属性创建一个watcher，粒度最细
 * 这样就不需要vdom，但是会产生大量watcher
 */
class Compile {
  constructor(el, vm) {
    this.$vm = vm;
    this.$el = document.querySelector(el);
    this.methods = ['click']; // 支持的event

    if (this.$el) {
      this.compile(this.$el);
    }
  }

  compile(el) {
    const nodes = el.childNodes;
    let node;
    for (let i = 0, l = nodes.length; i < l; i += 1) {
      node = nodes[i];
      if (this.isElement(node)) {
        this.compileElement(node);
      } else if (this.isInner(node)) {
        this.compileText(node)
      }

      if (node.childNodes) {
        /* 形如<p>{{123}}</p>中的{{}}需要递归遍历子节点 */
        this.compile(node);
      }
    }
  }

  compileElement(node) {
    const nodeAttrs = Array.from(node.attributes); // 类数组 NodeList
    for (let i = 0, l = nodeAttrs.length; i < l; i += 1) {
      const attr = nodeAttrs[i];
      const attrName = attr.name;
      const exp = attr.value;
      let dir;
      if (this.isDirective(attrName)) {
        dir = attrName.substring(2);
        if (this[dir]) {
          this[dir](node, exp);
        }
      } else if (/^@(.+)/.test(attrName)) {
        dir = RegExp.$1;
        if (this[dir]) {
          this[dir](node, dir, exp);
        }
      }
    }
  }

  /* 编译插值文本 */
  compileText(node) {
    /* 获取匹配表达式 */
    const exp = node.textContent.match(/\{\{(.*)\}\}/)[1].trim();
    this.update(node, exp, 'text');
  }

  text(node, exp) {
    this.update(node, exp, 'text');
  }

  html(node, exp) {
    this.update(node, exp, 'html')
  }

  /* FIXME: 优化 */
  click(node, dir, exp) {
    this.event(node, dir, exp);
  }

  /* 为所有动态绑定创建更新方法并执行一次，以及生成对应一个watcher */
  update(node, exp, dir) {
    const fn = this[`update${dir}`];
    if (fn) {
      fn(node, this.$vm[exp]);
      new Watcher(this.$vm, exp, function(val) {
        fn(node, val);
      })
    }
  }

  event(node, dir, exp) {
    let method = this.$vm.$options.methods[exp];
    method = method.bind(this.$vm);
    node.addEventListener(dir, method);
  }

  updatetext(node, value) {
    node.textContent = value;
  }

  updatehtml(node, value) {
    node.innerHTML = value;
  }

  /* 是否是元素 */
  isElement(node) {
    return node.nodeType === 1;
  }

  /* 判断是否是插值表达式{{xx}} */
  isInner(node) {
    return node.nodeType === 3 && /\{\{(.*)\}\}/.test(node.textContent);
  }

  /* 判断是否是指令 */
  isDirective(attrName) {
    return /^v\-/.test(attrName);
  }
}

/* 观察者 */
class Watcher {
  constructor(vm, key, updateFn) {
    this.vm = vm;
    this.key = key;
    this.updateFn = updateFn;

    Dep.target = this;
    this.vm[this.key];
    Dep.target = null;
  }

  update() {
    this.updateFn.call(this.vm, this.vm[this.key]);
  }
}

/* 收集者 */
class Dep {
  constructor() {
    this.deps = []
  }

  addDep(watcher) {
    this.deps.push(watcher)
  }

  notify() {
    this.deps.forEach(watcher => {
      watcher.update();
    })
  }
}

Dep.target = null;


/* utils */
function isObject(obj) {
  return typeof(obj) === 'object' && obj !== null;
}