function flatAll(array) {
    const value = [];

    function* generator(array) {
        for (let i = 0; i < array.length; i += 1) {
            if (Array.isArray(array[i])) {
                yield* generator(array[i]);
            } else {
                yield array[i];
            }
        }
    }

    function run(fn) {
        const iterator = fn(array);
        let result = iterator.next();
        value.push(result.value);
        while (!result.done) {
            value.push(result.value);
            result = iterator.next();
        }
        return value;
    }

    return run(generator)

    // for (let num of generator(array)) {
    //     value.push(num)
    // }
    // return value;
}


/**
 * flatAll([1, 2, 3, [4, 5, [6, 7]]])
 * [1, 2, 3, 4, 5, 6 ,7]
 */