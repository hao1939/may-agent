import { expect, it } from "bun:test";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const fixture = fileURLToPath(new URL("../../test/fixtures/task-admission-probe.ts", import.meta.url));

for (const scenario of [
  "healthy",
  "startup-timeout",
  "response-timeout",
  "close",
  "error-then-healthy",
  "pinned-selection",
]) {
  it(`bounds real Task admission process lifecycle: ${scenario}`, async () => {
    const { stdout } = await execute(process.execPath, [fixture, scenario], { timeout: 8_000 });
    expect(JSON.parse(stdout.trim())).toEqual({ scenario, passed: true });
  }, 10_000);
}
