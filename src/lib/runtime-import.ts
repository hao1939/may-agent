import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

let runtimeImportSeq = 0;
const runtimeModuleCache = new Map<string, Promise<unknown>>();

interface RuntimeBunPlugin {
  name: string;
  setup(build: {
    onResolve(
      options: { filter: RegExp },
      callback: (args: { path: string; importer?: string }) => { path: string } | Promise<{ path: string }>,
    ): void;
  }): void;
}

declare const Bun: {
  build(options: {
    entrypoints: string[];
    target: "bun";
    format: "esm";
    write: false;
    plugins: RuntimeBunPlugin[];
  }): Promise<{ success: boolean; logs: Array<{ message: string }>; outputs: Blob[] }>;
  write(path: string, data: Blob): Promise<unknown>;
};

export interface RuntimeImportOptions {
  /**
   * Force the bundled import path in tests. Production uses it automatically
   * when running from a bun-compiled binary.
   */
  forceBundle?: boolean;
  /** Optional cache root for bundled external modules. */
  cacheDir?: string;
  /**
   * Immutable revision of the entry source expected by the caller. Callers
   * that persist source provenance must provide this so the imported exports
   * and recorded revision cannot come from different runtime generations.
   */
  entryContentHash?: string;
}

export async function importRuntimeModule<T = unknown>(
  modulePath: string,
  opts: RuntimeImportOptions = {},
): Promise<T> {
  const cacheKey = runtimeModuleCacheKey(modulePath, opts);
  const cached = runtimeModuleCache.get(cacheKey);
  if (cached) return cached as Promise<T>;

  const pending = importRuntimeModuleOnce<T>(modulePath, opts);
  runtimeModuleCache.set(cacheKey, pending);
  try {
    return await pending;
  } catch (error) {
    if (runtimeModuleCache.get(cacheKey) === pending) runtimeModuleCache.delete(cacheKey);
    throw error;
  }
}

/**
 * Make changed runtime source visible at the explicit reload boundary.
 *
 * JavaScript modules cannot be unloaded. Keeping one import per source path
 * between reloads prevents every handler/workflow execution from adding a new
 * module graph to the long-lived Host while preserving deliberate hot reload.
 */
export function invalidateRuntimeModuleCache(): void {
  runtimeModuleCache.clear();
}

function runtimeModuleCacheKey(modulePath: string, opts: RuntimeImportOptions): string {
  return [
    resolve(modulePath),
    opts.forceBundle || isBundledRuntime() ? "bundle" : "native",
    opts.cacheDir ? resolve(opts.cacheDir) : "default-cache",
    opts.entryContentHash ?? "runtime-generation",
  ].join("\0");
}

async function importRuntimeModuleOnce<T>(modulePath: string, opts: RuntimeImportOptions): Promise<T> {
  if (!opts.forceBundle && !isBundledRuntime()) {
    return import(withFreshToken(modulePath)) as Promise<T>;
  }

  const bundled = await bundleRuntimeModule(modulePath, opts);
  try {
    return (await import(withFreshToken(bundled.path))) as T;
  } finally {
    bundled.cleanup();
  }
}

export function isBundledRuntime(): boolean {
  return import.meta.url.startsWith("file:///$bunfs/");
}

function withFreshToken(modulePath: string): string {
  runtimeImportSeq += 1;
  return `${modulePath}?t=${Date.now()}-${runtimeImportSeq}`;
}

async function bundleRuntimeModule(
  modulePath: string,
  opts: RuntimeImportOptions,
): Promise<{ path: string; cleanup: () => void }> {
  const outDir = opts.cacheDir ?? defaultRuntimeCacheDir(modulePath);
  mkdirSync(outDir, { recursive: true });
  mirrorSourceDirForRelativeImports(dirname(resolve(modulePath)), outDir);

  runtimeImportSeq += 1;
  const outFile = join(outDir, `.may-runtime-module-${process.pid}-${Date.now()}-${runtimeImportSeq}.mjs`);
  const result = await Bun.build({
    entrypoints: [modulePath],
    target: "bun",
    format: "esm",
    write: false,
    plugins: [mayAgentSdkRuntimeResolver(modulePath)],
  });

  if (!result.success) {
    const messages = result.logs.map((log: { message: string }) => log.message).join("\n");
    throw new Error(`Failed to bundle runtime module ${modulePath}${messages ? `:\n${messages}` : ""}`);
  }

  const output = result.outputs[0];
  if (!output) {
    throw new Error(`Failed to bundle runtime module ${modulePath}: no output generated`);
  }

  try {
    await Bun.write(outFile, output);
  } catch (error) {
    // Bun.write may leave a partial module behind on ENOSPC. The module was
    // never importable or accepted, so remove only this attempt's staging file
    // before surfacing the original failure.
    try {
      unlinkSync(outFile);
    } catch {
      /* preserve the original write failure */
    }
    throw error;
  }
  return {
    path: outFile,
    cleanup: () => {
      if (opts.cacheDir) return;
      try {
        unlinkSync(outFile);
      } catch {
        /* best-effort cleanup */
      }
    },
  };
}

function defaultRuntimeCacheDir(modulePath: string): string {
  const envCacheDir = process.env.MAY_RUNTIME_IMPORT_CACHE_DIR;
  if (envCacheDir) return resolve(envCacheDir);

  const sourceDir = dirname(resolve(modulePath));
  const root = nearestProjectRoot(sourceDir) ?? sourceDir;
  const sourceKey = sourceDir.replace(/[^A-Za-z0-9._-]+/g, "_");
  return join(root, ".state", "runtime-modules", sourceKey);
}

function nearestProjectRoot(startDir: string): string | undefined {
  let current = resolve(startDir);
  for (;;) {
    if (
      existsSync(join(current, ".state")) ||
      existsSync(join(current, "project.json")) ||
      existsSync(join(current, "package.json"))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function mirrorSourceDirForRelativeImports(sourceDir: string, outDir: string): void {
  if (resolve(sourceDir) === resolve(outDir)) return;

  let entries: string[];
  try {
    entries = readdirSync(sourceDir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry === ".state" || entry.startsWith(".may-runtime-module-")) {
      continue;
    }
    const source = join(sourceDir, entry);
    const dest = join(outDir, entry);
    if (existsSync(dest)) continue;
    try {
      const stat = lstatSync(source);
      symlinkSync(source, dest, stat.isDirectory() && process.platform === "win32" ? "junction" : undefined);
    } catch {
      // Best effort: static imports are bundled; this mirror only preserves
      // dynamic relative imports that remain in the generated module.
    }
  }
}

function mayAgentSdkRuntimeResolver(entrypoint: string): RuntimeBunPlugin {
  return {
    name: "may-agent-sdk-runtime-resolver",
    setup(build) {
      build.onResolve(
        {
          filter: /^@may-agent\/sdk(?:\/(?:app|task|testing|workflow-guard))?$/,
        },
        (args) => {
          return {
            path: resolveSdkExport(args.path, args.importer || entrypoint),
          };
        },
      );

      // When running from a compiled binary, Bun.build cannot resolve
      // bare-specifier dependencies of the SDK source (e.g. @earendil-works/pi-ai)
      // because the binary's resolver has no node_modules context.
      // Walk up from the importer to find the package in node_modules.
      build.onResolve({ filter: /^@earendil-works\// }, (args) => {
        const resolved = resolveNodeModulesPackage(args.path, args.importer || entrypoint);
        if (resolved) return { path: resolved };
        throw new Error(`Cannot resolve ${args.path} from ${args.importer || entrypoint}`);
      });
    },
  };
}

/**
 * Walk up from `startDir` looking for `specifier` in node_modules.
 * Returns the resolved package main (dist/index.js or package.json main) or undefined.
 */
function resolveNodeModulesPackage(specifier: string, importer: string): string | undefined {
  let current = resolve(dirname(importer));
  while (true) {
    const candidate = join(current, "node_modules", ...specifier.split("/"));
    if (existsSync(candidate)) {
      // Try package.json main/module/exports, fall back to dist/index.js
      const pkgPath = join(candidate, "package.json");
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
          const main = pkg.module || pkg.main || "dist/index.js";
          const mainPath = join(candidate, main);
          if (existsSync(mainPath)) return mainPath;
        } catch {
          /* fall through */
        }
      }
      const fallback = join(candidate, "dist", "index.js");
      if (existsSync(fallback)) return fallback;
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function resolveSdkExport(specifier: string, importer: string): string {
  const exportFile =
    specifier === "@may-agent/sdk/app"
      ? "app.ts"
      : specifier === "@may-agent/sdk/task"
        ? "task.ts"
        : specifier === "@may-agent/sdk/testing"
          ? "testing.ts"
          : specifier === "@may-agent/sdk/workflow-guard"
            ? "workflow-guard.ts"
            : "index.ts";
  const candidates = sdkRootCandidates(importer).map((root) => join(root, "src", exportFile));
  const resolved = candidates.find((candidate) => existsSync(candidate));
  if (resolved) return resolved;

  throw new Error(
    `Cannot resolve ${specifier} for runtime import. Checked:\n${candidates.map((p) => `  - ${p}`).join("\n")}`,
  );
}

function sdkRootCandidates(importer: string): string[] {
  const roots: string[] = [];
  const add = (value: string | undefined) => {
    if (!value) return;
    const resolved = resolve(value);
    if (!roots.includes(resolved)) roots.push(resolved);
  };

  add(process.env.MAY_AGENT_SDK_ROOT);
  add(fileDependencySdkRoot(process.env.PROJECT_ROOT));
  add(process.env.PROJECT_ROOT ? join(process.env.PROJECT_ROOT, "node_modules", "@may-agent", "sdk") : undefined);
  add(fileDependencySdkRoot(process.cwd()));
  add(join(process.cwd(), "node_modules", "@may-agent", "sdk"));
  add(findNodeModulesSdk(dirname(importer)));

  return roots;
}

/**
 * A workspace may install the SDK from a local `file:` dependency. Prefer the
 * declared source directory over its copied node_modules snapshot so runtime
 * app imports cannot combine files from two different SDK revisions.
 */
function fileDependencySdkRoot(projectRoot: string | undefined): string | undefined {
  if (!projectRoot) return undefined;
  const packagePath = join(resolve(projectRoot), "package.json");
  if (!existsSync(packagePath)) return undefined;
  try {
    const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as Record<string, unknown>;
    for (const field of ["dependencies", "devDependencies", "optionalDependencies"] as const) {
      const dependencies = pkg[field];
      if (!dependencies || typeof dependencies !== "object" || Array.isArray(dependencies)) continue;
      const specifier = (dependencies as Record<string, unknown>)["@may-agent/sdk"];
      if (typeof specifier !== "string" || !specifier.startsWith("file:")) continue;
      return resolve(projectRoot, specifier.slice("file:".length));
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function findNodeModulesSdk(startDir: string): string | undefined {
  let current = resolve(startDir);
  while (true) {
    const candidate = join(current, "node_modules", "@may-agent", "sdk");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}
