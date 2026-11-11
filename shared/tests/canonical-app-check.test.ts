import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const checker = resolve(import.meta.dir, "../../scripts/check-canonical-agent-app.ts");

test.each([
  { content: undefined, error: undefined },
  { content: "[]", error: undefined },
  { content: '[{"handler":"old-job"}]', error: "retired agent cron declarations" },
  { content: '[{"handler":"old-job","enabled":false}]', error: "retired agent cron declarations" },
  { content: "[null]", error: "retired agent cron declarations" },
  { content: "{}", error: "expected a JSON array" },
  { content: "[", error: "invalid JSON" },
])("canonical App check enforces the retired cron contract for $content", async ({ content, error }) => {
  const root = mkdtempSync(join(tmpdir(), "canonical-app-check-"));
  try {
    const appDir = join(root, "projects/sample.app");
    const agentDir = join(appDir, "agents/owner");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(appDir, "app.ts"), "export default {};\n");
    if (content !== undefined) writeFileSync(join(agentDir, "cron.json"), content);
    const child = Bun.spawn([process.execPath, checker], {
      cwd: root, stdout: "pipe", stderr: "pipe", signal: AbortSignal.timeout(10_000),
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
    ]);
    expect(exitCode).toBe(error ? 1 : 0);
    if (error) expect(stderr).toContain(error);
    else expect(stdout).toContain("0 error(s)");
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 15_000);
