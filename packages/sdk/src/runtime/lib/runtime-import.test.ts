import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { importRuntimeModule, invalidateRuntimeModuleCache } from "@may-agent/sdk/runtime";

describe("importRuntimeModule", () => {
  const roots: string[] = [];

  afterEach(() => {
    invalidateRuntimeModuleCache();
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("loads one module graph per runtime generation", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-runtime-import-generation-"));
    roots.push(root);

    const modulePath = join(root, "generation.ts");
    writeFileSync(
      modulePath,
      `
        globalThis.__mayRuntimeImportCount = (globalThis.__mayRuntimeImportCount ?? 0) + 1;
        export const value = "first";
        export const imports = globalThis.__mayRuntimeImportCount;
      `,
    );

    const first = await importRuntimeModule<{ value: string; imports: number }>(modulePath, { forceBundle: true });
    writeFileSync(
      modulePath,
      `
        globalThis.__mayRuntimeImportCount = (globalThis.__mayRuntimeImportCount ?? 0) + 1;
        export const value = "second";
        export const imports = globalThis.__mayRuntimeImportCount;
      `,
    );
    const cached = await importRuntimeModule<{ value: string; imports: number }>(modulePath, { forceBundle: true });

    expect(cached).toBe(first);
    expect(cached.value).toBe("first");
    expect(cached.imports).toBe(first.imports);

    invalidateRuntimeModuleCache();
    const reloaded = await importRuntimeModule<{ value: string; imports: number }>(modulePath, { forceBundle: true });
    expect(reloaded.value).toBe("second");
    expect(reloaded.imports).toBe(first.imports + 1);
  });

  it("loads the entry revision whose hash is recorded without a global reload", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-runtime-import-revision-"));
    roots.push(root);

    const modulePath = join(root, "revision.ts");
    writeFileSync(modulePath, "export const value = 'first';\n");
    const first = await importRuntimeModule<{ value: string }>(modulePath, {
      forceBundle: true,
      entryContentHash: "first-hash",
    });

    writeFileSync(modulePath, "export const value = 'second';\n");
    const second = await importRuntimeModule<{ value: string }>(modulePath, {
      forceBundle: true,
      entryContentHash: "second-hash",
    });

    expect(first.value).toBe("first");
    expect(second.value).toBe("second");
  });

  it("bundles external runtime modules through the canonical SDK boundary", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-runtime-import-"));
    roots.push(root);

    const modulePath = join(root, "external-handler.ts");
    writeFileSync(
      modulePath,
      `
        import { Type } from "@may-agent/sdk";

        export function sdkVersion(): string {
          return Type.Object({}).type;
        }
      `,
    );

    const mod = await importRuntimeModule<{ sdkVersion(): string }>(modulePath, {
      forceBundle: true,
      cacheDir: join(root, ".cache"),
    });

    expect(mod.sdkVersion()).toBe("object");
  });

  it("bundles standalone App declarations through the public App entry point", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-runtime-app-import-"));
    roots.push(root);

    const modulePath = join(root, "app.ts");
    writeFileSync(
      modulePath,
      `
        import { Type, defineApp } from "@may-agent/sdk/app";

        export default defineApp({
          id: "standalone-canary",
          version: 1,
          agent: "owner",
          inputSchema: Type.Object({
            kind: Type.Literal("probe"),
            data: Type.Object({}, { additionalProperties: false }),
          }, { additionalProperties: false }),
        });
      `,
    );

    // Bun 1.3.14 can reuse a loaded SDK file descriptor for a deleted fixture
    // directory when bundling again in the mixed test process (EISDIR).
    // Exercise the real bundler in a clean process, not a retry or mocked build.
    const { stdout } = await promisify(execFile)(process.execPath, [
      new URL("../../../../../test/fixtures/runtime-import-app.ts", import.meta.url).pathname,
      modulePath, join(root, ".cache"),
    ], { timeout: 10_000 });
    expect(stdout.trim()).toBe("standalone-canary");
  });

  it("rejects the retired SDK entry point for external App declarations", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-runtime-legacy-import-"));
    roots.push(root);

    const modulePath = join(root, "legacy-handler.ts");
    const retiredSpecifier = ["@may-agent/sdk", "legacy"].join("/");
    const retiredFactory = ["define", "Project", "App"].join("");
    writeFileSync(
      modulePath,
      `
        import { ${retiredFactory}, workflowResultVersion } from "${retiredSpecifier}";
        export const app = ${retiredFactory}({
          id: "legacy", version: 1, owner: "owner", description: "fixture",
          schedules: [{ id: "pulse", enabled: true, intervalMs: 60000,
            emits: [{ type: "legacy.pulse" }]
          }]
        });
        export const sdkVersion = workflowResultVersion;
      `,
    );

    await expect(
      importRuntimeModule(modulePath, {
        forceBundle: true,
        cacheDir: join(root, ".cache"),
      }),
    ).rejects.toThrow();
  });

  it("preserves compiler diagnostics when the real bundler throws and permits a corrected retry", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-runtime-import-diagnostic-"));
    roots.push(root);

    const modulePath = join(root, "broken-handler.ts");
    const options = { forceBundle: true, cacheDir: join(root, ".cache") } as const;
    writeFileSync(modulePath, "export const broken = ;\n");

    let thrown: unknown;
    try {
      await importRuntimeModule(modulePath, options);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const failure = thrown as Error;
    expect(failure.message).toContain(`Failed to bundle runtime module ${modulePath}`);
    expect(failure.message).toContain("Unexpected ;");
    expect(failure.cause).toBeInstanceOf(AggregateError);

    writeFileSync(modulePath, "export const value = 'corrected';\n");
    const corrected = await importRuntimeModule<{ value: string }>(modulePath, options);
    expect(corrected.value).toBe("corrected");
  });

  it("preserves compiler diagnostics from an unsuccessful returned build result", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-runtime-import-result-diagnostic-"));
    roots.push(root);

    const modulePath = join(root, "returned-failure.ts");
    writeFileSync(modulePath, "export const value = 'not-built';\n");
    const build = spyOn(Bun, "build").mockImplementation(async () => {
      return {
        success: false,
        logs: [{ message: "synthetic returned compiler diagnostic" }],
        outputs: [],
      } as unknown as Awaited<ReturnType<typeof Bun.build>>;
    });

    try {
      await expect(
        importRuntimeModule(modulePath, { forceBundle: true, cacheDir: join(root, ".cache") }),
      ).rejects.toThrow(`Failed to bundle runtime module ${modulePath}:\nsynthetic returned compiler diagnostic`);
    } finally {
      build.mockRestore();
    }
  });

  it("preserves dynamic relative imports from the original module directory", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-runtime-import-relative-"));
    roots.push(root);
    mkdirSync(join(root, ".state")); // Own the cache root even if the temporary directory has parent state.

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

  it("removes a partial bundled module after a storage write failure", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-runtime-import-full-"));
    roots.push(root);
    const cacheDir = join(root, ".cache");
    const modulePath = join(root, "external-handler.ts");
    writeFileSync(modulePath, "export const value = 'never-loaded';\n");
    const originalWrite = Bun.write.bind(Bun);
    const write = spyOn(Bun, "write").mockImplementation(async (path, _data) => {
      await originalWrite(path, "partial bundled module");
      throw new Error("ENOSPC: no space left on device, write");
    });

    try {
      await expect(importRuntimeModule(modulePath, { forceBundle: true, cacheDir })).rejects.toThrow("ENOSPC");
    } finally {
      write.mockRestore();
    }

    expect(readdirSync(cacheDir).some((name) => name.startsWith(".may-runtime-module-"))).toBe(false);
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
