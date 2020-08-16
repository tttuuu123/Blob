function isObject(data) {
  return typeof data === 'object' && data !== null;
}

function reactive(obj) {
  if (!isObject(obj)) return obj;

  return new Proxy(obj, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver);
      track(target, key);
      return isObject(result) ? reactive(result) : result;
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver);
      trigger(target, key);
      return result;
    },
    deleteProperty(target, key) {
      const result = Reflect.deleteProperty(target, key);
      trigger(target, key);
      return result;
    },
  })
}

/* 声明一个响应函数，放入effectStack备用 */
const effectStack = [];
function effect(fn) {
  const hoEffect = () => {
    try {
      effectStack.push(hoEffect);
      return fn()
    } finally {
      effectStack.pop();
    }
  }

  hoEffect();
  return hoEffect;
}

/**
 * 响应函数触发，就开始做依赖收集（记录映射关系）
 * WeakMap{Map: {Set: []}}
 * {target: {key: []}}
 */
const targetMap = new WeakMap();
function track(target, key) {
  const effect = effectStack[effectStack.length - 1];
  if (effect) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      depsMap = new Map();
      targetMap.set(target, depsMap);
    }

    let deps = depsMap.get(key);
    if (!deps) {
      deps = new Set();
      depsMap.set(key, deps);
    }
    deps.add(effect);
  }
}

/* setter或deleteProperty触发时，根据映射关系执行对应的effects */
function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (depsMap) {
    const deps = depsMap.get(key);
    if (deps) {
      deps.forEach((effect) => effect());
    }
  }
}
