import curry from './moduleA';

function plus(x, y, z, m, n) {
  return x + y + z + m + n
}

const fn = curry(plus);

export default fn;