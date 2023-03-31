import path from "path";
import webpack from "webpack";
import { merge } from "webpack-merge";

export function runCompile(options) {
  const opt = merge(
    {
      mode: 'production',
      entry: path.join(__dirname, './entry.js'),
      output: { path: path.resolve(__dirname, '../dist') },
    },
    options
  );

  return new Promise((resolve, reject) => {
    const compiler = webpack(opt);

    compiler.run((error, stats) => {
      if (error) {
        return reject(error);
      }
      return resolve({ stats, compiler });
    });
  });
}