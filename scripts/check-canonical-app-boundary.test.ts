import { afterEach, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function runBoundary(runtimeRoot: string, appsRoot: string) {
  const repoRoot = resolve(import.meta.dir, "..");
  return promisify(execFile)(process.execPath, ["scripts/check-canonical-app-boundary.ts"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      MAY_AGENT_VERIFY_RUNTIME_ROOT: runtimeRoot,
      MAY_AGENT_VERIFY_APPS_ROOT: appsRoot,
    },
    timeout: 10_000,
  });
}

test("canonical boundary recognizes import-type expressions and preserves allowed controls", async () => {
  const root = mkdtempSync(join(tmpdir(), "canonical-boundary-test-"));
  roots.push(root);
  const runtimeRoot = join(root, "runtime");
  const appsRoot = join(root, "projects");
  const appDir = join(appsRoot, "sample.app");
  const workflowDir = join(appDir, "agents", "worker", "workflows");
  const nestedWorkflowDir = join(appDir, "agents", "group", "worker", "workflows");
  mkdirSync(join(runtimeRoot, "packages", "sdk", "src"), { recursive: true });
  mkdirSync(join(runtimeRoot, "src"), { recursive: true });
  mkdirSync(join(runtimeRoot, "test"), { recursive: true });
  mkdirSync(workflowDir, { recursive: true });
  mkdirSync(nestedWorkflowDir, { recursive: true });
  writeFileSync(join(runtimeRoot, "packages", "sdk", "package.json"), JSON.stringify({ exports: {} }));
  writeFileSync(join(appDir, "app.ts"), 'import { defineApp } from "@may-agent/sdk/app";\nexport default defineApp;\n');
  for (const dir of [workflowDir, nestedWorkflowDir]) {
    writeFileSync(
      join(dir, "allowed.test.ts"),
      'type Runner = import("@may-agent/sdk/standalone").DirectRunOptions;\n',
    );
  }

  const allowed = await runBoundary(runtimeRoot, appsRoot);
  expect(allowed.stdout).toContain("Canonical App boundary: 0 error(s); Runtime + Apps");

  const deepImport = join(runtimeRoot, "test", "deep-import.ts");
  writeFileSync(deepImport, 'type Trace = import("../packages/sdk/src/event.js").EventTrace;\n');
  await expect(runBoundary(runtimeRoot, appsRoot)).rejects.toMatchObject({
    stderr: expect.stringContaining("deep-imports SDK source"),
  });
  unlinkSync(deepImport);

  const runtimeImport = join(appDir, "runtime-import.test.ts");
  writeFileSync(runtimeImport, 'type Bindings = import("@may-agent/sdk/runtime").WorkflowKernelBindings;\n');
  await expect(runBoundary(runtimeRoot, appsRoot)).rejects.toMatchObject({
    stderr: expect.stringContaining("Apps cannot import Host-internal @may-agent/sdk/runtime"),
  });
  unlinkSync(runtimeImport);

  const shallowBlocked = join(workflowDir, "blocked.ts");
  writeFileSync(shallowBlocked, 'type Runner = import("@may-agent/sdk/standalone").DirectRunOptions;\n');
  await expect(runBoundary(runtimeRoot, appsRoot)).rejects.toMatchObject({
    stderr: expect.stringContaining("App runtime declarations cannot import @may-agent/sdk/standalone"),
  });
  unlinkSync(shallowBlocked);

  writeFileSync(
    join(nestedWorkflowDir, "blocked.ts"),
    'type Runner = import("@may-agent/sdk/standalone").DirectRunOptions;\n',
  );
  await expect(runBoundary(runtimeRoot, appsRoot)).rejects.toMatchObject({
    stderr: expect.stringContaining("App runtime declarations cannot import @may-agent/sdk/standalone"),
  });
});
