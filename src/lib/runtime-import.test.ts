import { afterEach, describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdirSync,
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

  it("bundles external runtime modules that import the legacy SDK boundary", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-runtime-import-"));
    roots.push(root);

    const modulePath = join(root, "external-handler.ts");
    writeFileSync(
      modulePath,
      `
        import { workflowResultVersion } from "@may-agent/sdk/legacy";

        export function sdkVersion(): string {
          return workflowResultVersion;
        }
      `,
    );

    const mod = await importRuntimeModule<{ sdkVersion(): string }>(modulePath, {
      forceBundle: true,
      cacheDir: join(root, ".cache"),
    });

    expect(mod.sdkVersion()).toBe("workflow-result-v1");
  });

  it("bundles standalone App declarations through the public App entry point", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-runtime-app-import-"));
    roots.push(root);

    const modulePath = join(root, "inbox.ts");
    writeFileSync(
      modulePath,
      `
        import { Type, defineApp } from "@may-agent/sdk/app";

        export default defineApp({
          id: "standalone-canary",
          version: 1,
          owner: "owner",
          inputSchema: Type.Object({
            kind: Type.Literal("probe"),
            data: Type.Object({}, { additionalProperties: false }),
          }, { additionalProperties: false }),
        });
      `,
    );

    const mod = await importRuntimeModule<{ default: { id: string } }>(modulePath, {
      forceBundle: true,
      cacheDir: join(root, ".cache"),
    });

    expect(mod.default.id).toBe("standalone-canary");
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

  it("prefers the declared file dependency over a stale installed SDK copy", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-runtime-import-file-sdk-"));
    roots.push(root);

    const sourceSdk = join(root, "packages", "sdk", "src");
    const installedSdk = join(root, "node_modules", "@may-agent", "sdk", "src");
    mkdirSync(sourceSdk, { recursive: true });
    mkdirSync(installedSdk, { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ dependencies: { "@may-agent/sdk": "file:packages/sdk" } }),
    );
    writeFileSync(join(sourceSdk, "index.ts"), "export const sdkMarker = 'current-source';\n");
    writeFileSync(join(installedSdk, "index.ts"), "export const sdkMarker = 'stale-install';\n");

    const modulePath = join(root, "external-handler.ts");
    writeFileSync(
      modulePath,
      `
        import { sdkMarker } from "@may-agent/sdk";
        export function marker(): string { return sdkMarker; }
      `,
    );

    const previousProjectRoot = process.env.PROJECT_ROOT;
    const previousSdkRoot = process.env.MAY_AGENT_SDK_ROOT;
    process.env.PROJECT_ROOT = root;
    delete process.env.MAY_AGENT_SDK_ROOT;
    try {
      const mod = await importRuntimeModule<{ marker(): string }>(modulePath, {
        forceBundle: true,
        cacheDir: join(root, ".cache"),
      });
      expect(mod.marker()).toBe("current-source");
    } finally {
      if (previousProjectRoot === undefined) delete process.env.PROJECT_ROOT;
      else process.env.PROJECT_ROOT = previousProjectRoot;
      if (previousSdkRoot === undefined) delete process.env.MAY_AGENT_SDK_ROOT;
      else process.env.MAY_AGENT_SDK_ROOT = previousSdkRoot;
    }
  });
});
