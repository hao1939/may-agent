import { afterEach, expect, it } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it("verifies bundled App artifacts through core registration", async () => {
  const root = mkdtempSync(join(tmpdir(), "app-artifact-test-"));
  roots.push(root);
  const appDir = join(root, "sample.app");
  mkdirSync(appDir);
  const modulePath = join(appDir, "app.ts");
  writeFileSync(
    modulePath,
    `import { defineApp } from "@may-agent/sdk/app";
export default defineApp({ id: "sample", version: 1, agent: "worker", inputSchema: { type: "object" } });\n`,
  );
  const repoRoot = resolve(import.meta.dir, "..");
  const verify = () =>
    promisify(execFile)(process.execPath, ["scripts/verify-app-artifact-compatibility.ts"], {
      cwd: repoRoot,
      env: {
        ...process.env,
        MAY_AGENT_VERIFY_APPS_ROOT: root,
        MAY_AGENT_VERIFY_SDK_ROOT: join(repoRoot, "packages/sdk"),
      },
      timeout: 10_000,
    });
  const result = await verify();
  expect(JSON.parse(result.stdout)).toMatchObject({ appCount: 1, apps: ["sample"], authoringBoundary: "canonical" });
  writeFileSync(modulePath, "export default { id: 'sample', version: 1, agent: 'worker' };\n");
  await expect(verify()).rejects.toThrow("inputSchema must be an object schema");
});
