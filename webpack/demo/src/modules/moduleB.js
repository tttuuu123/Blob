import curry from './moduleA';

function multiply(x, y, z, m, n) {
  return x * y * z * m * n
}

const fn = curry(multiply);

export default fn;

export const b = 1;
