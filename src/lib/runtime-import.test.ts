import { afterEach, describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { importRuntimeModule } from "./runtime-import.js";

describe("importRuntimeModule", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("bundles external runtime modules that import the public SDK", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-runtime-import-"));
    roots.push(root);

    const modulePath = join(root, "external-handler.ts");
    writeFileSync(
      modulePath,
      `
        import { parseProjectTasks } from "@may-agent/sdk";

        export function taskIds(content: string): string[] {
          return parseProjectTasks(content).tasks.map((task) => task.id);
        }
      `,
    );

    const mod = await importRuntimeModule<{ taskIds(content: string): string[] }>(modulePath, {
      forceBundle: true,
      cacheDir: join(root, ".cache"),
    });

    expect(mod.taskIds("## Tasks\n- id: managedsystem-pool-priority-test\n  status: ready\n")).toEqual([
      "managedsystem-pool-priority-test",
    ]);
  });

  it("preserves dynamic relative imports from the original module directory", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-runtime-import-relative-"));
    roots.push(root);

    writeFileSync(join(root, "helper.ts"), "export const value = 'relative-ok';\n");
    const modulePath = join(root, "external-handler.ts");
    writeFileSync(
      modulePath,
      `
        export async function loadValue(): Promise<string> {
          const mod = await import("./helper.ts?t=" + Date.now());
          return mod.value;
        }
      `,
    );

    const mod = await importRuntimeModule<{ loadValue(): Promise<string> }>(modulePath, {
      forceBundle: true,
    });

    expect(await mod.loadValue()).toBe("relative-ok");
    expect(readdirSync(root).some((name) => name.startsWith(".may-runtime-module-"))).toBe(false);
    expect(existsSync(join(root, ".state", "runtime-modules"))).toBe(true);
  });
});
