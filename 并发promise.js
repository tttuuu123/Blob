function myPromise(cbs, limit) {
    const result = new WeakMap();
    let _cbs = [...cbs];
    let cb = null;

    function run() {
        if (_cbs.length > 0) {
            cb = _cbs.shift();
            return (function() {
                setTimeout(() => {
                    result.set(cb, cb());
                    run();
                }, 1000);
            })()
        }
    }

    const promiseList = new Array(Math.min(cbs.length, limit)).fill(Promise.resolve()).map((promise) => promise.then(run));
    return Promise.all(promiseList).then(() => cbs.map(item => result.get(item)))
}


function cb1() {
    console.log(1);    
}

const cbs1 = new Array(10).fill(cb1);
myPromise(cbs1, 2);