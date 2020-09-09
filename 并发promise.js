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


/**
 * 上面的方法仅仅是控制了并发
 * 但是不够健壮
 * 同时不能获取到最终的返回结果集
 */

function createCb(i) {
    return () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(i);
            }, Math.random() * 2 * 1000);
        });
    }
}

const cbs = [];
for (let i = 0; i < 30; i += 1) {
    cbs.push(createCb(i));
}

function myPromiseAll(cbs, limit) {
    return new Promise((resolve) => {
        const result = new WeakMap();
        const _cbs = [...cbs];
        let finishedCount = 0;
    
        async function run() {
            if (_cbs.length) {
                const cb = _cbs.shift();
                const ret = await cb().catch(() => null);
                finishedCount += 1;
                result.set(cb, ret);
                if (finishedCount === cbs.length) {
                    resolve(cbs.map((cb) => result.get(cb)));
                } else {
                    run();
                }
            }
        }

        const promiseList = new Array(Math.min(cbs.length, limit)).fill(Promise.resolve()).map((promise) => promise.then(run));
        Promise.all(promiseList);
    });
}

myPromiseAll(cbs, 5).then((result) => {
    console.log(result);
});