import { runCompile } from './helpers';
import ConsolePlugin from '../custom-plugin/console-plugin';

describe("foo plugin", () => {
  it("should inject foo banner", async () => {
    const {
      stats: { compilation },
      compiler,
    } = await runCompile({
      plugins: [new ConsolePlugin()],
    });
    const { warnings, errors, assets } = compilation;

    expect(warnings).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });
});
