function isObject(o) {
    return typeof o === 'object' && o !== null;
}

function deepClone(o) {
    let map = new WeakMap();
    function dp(data) {
        if (map.has(data)) {
            return map.get(data);
        }
        let result = {};
        map.set(data, result)
        if (isObject(data)) {
            if (Array.isArray(data)) {
                result = [];
                data.forEach((item) => {
                    if (isObject(item)) {
                        result.push(dp(item));
                    } else {
                        result.push(item);
                    }
                });
            } else {
                Object.keys(data).forEach((key) => {
                    if (isObject(data[key])) {
                        result[key] = dp(data[key]);
                    } else {
                        result[key] = data[key];
                    }
                });
            }
        } else {
            result = data;
        }
        return result;
    }
    return dp(o);
}

var a = {
    b: {
        a: 1,
    },
    c: [1, 2, {a: 1}]
}

a.d = a;

console.log(deepClone(a))