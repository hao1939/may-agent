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

test("canonical App check enforces workflow export contracts, paired tests, and reachability", async () => {
  const root = mkdtempSync(join(tmpdir(), "canonical-workflow-check-"));
  try {
    const appDir = join(root, "projects/sample.app");
    const workflowDir = join(appDir, "agents/owner/workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(appDir, "app.ts"),
      'export default { task: () => ({ intent: { workflow: "valid-flow" } }) };\n',
    );
    writeFileSync(
      join(workflowDir, "valid-flow.ts"),
      'export const name = "valid-flow";\nexport const description = "Valid workflow";\nexport async function execute() {}\n',
    );
    writeFileSync(join(workflowDir, "valid-flow.test.ts"), "// paired test\n");

    const passRun = Bun.spawn([process.execPath, checker], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      signal: AbortSignal.timeout(10_000),
    });
    const [passCode, passOut] = await Promise.all([
      passRun.exited,
      new Response(passRun.stdout).text(),
    ]);
    expect(passCode).toBe(0);
    expect(passOut).toContain("0 error(s)");

    // Introduce contract errors: mismatched name, missing test, orphan workflow, and broken app.ts workflow binding
    writeFileSync(
      join(workflowDir, "orphan-flow.ts"),
      'export const name = "wrong-name";\nexport const description = "";\n',
    );
    writeFileSync(
      join(appDir, "app.ts"),
      'export default { task: () => ({ intent: { workflow: "non-existent-flow" } }) };\n',
    );

    const failRun = Bun.spawn([process.execPath, checker], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      signal: AbortSignal.timeout(10_000),
    });
    const [failCode, , failErr] = await Promise.all([
      failRun.exited,
      new Response(failRun.stdout).text(),
      new Response(failRun.stderr).text(),
    ]);
    expect(failCode).toBe(1);
    expect(failErr).toContain('exported workflow name "wrong-name" must match file slug "orphan-flow"');
    expect(failErr).toContain("workflow must export a non-empty description");
    expect(failErr).toContain("workflow must export execute(ctx)");
    expect(failErr).toContain("missing paired unit test");
    expect(failErr).toContain('orphan workflow "orphan-flow"');
    expect(failErr).toContain('binds missing workflow "non-existent-flow"');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 15_000);

