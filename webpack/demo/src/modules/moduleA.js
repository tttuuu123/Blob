export default function curry(fn) {
  const target = fn.length;
  const args = [];
  const help = (...innerArgs) => {
    args.push(...innerArgs);
    if (args.length >= target) {
      const temp = [...args];
      args.length = 0;
      return fn.apply(null, temp);
    }
    return help;
  }
  return help;
}