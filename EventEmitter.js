class EventEmitter {
  constructor() {
    this.events = Object.create(null);
  }

  on(event, cb) {
    if (!Array.isArray(this.events[event])) {
      this.events[event] = [];
    }
    this.events[event].push(cb);
  }

  once(event, cb) {
    function h(...args) {
      this.off(event, h);
      cb.apply(this, args);
    }
    this.on(event, h);
  }

  off(event, cb) {
    if (event) {
      if (cb) {
        this.events[event] = this.events[event].filter((fn) => fn != cb);
      } else {
        this.events[event] = [];
      }
    } else {
      this.events = Object.create(null);
    }
  }

  emit(event, ...args) {
    (this.events[event] || []).forEach((fn) => fn.apply(this, args));
  }
}
