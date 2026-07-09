import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

let runtimeImportSeq = 0;

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
}

export async function importRuntimeModule<T = unknown>(
  modulePath: string,
  opts: RuntimeImportOptions = {},
): Promise<T> {
  if (!opts.forceBundle && !isBundledRuntime()) {
    return import(withFreshToken(modulePath)) as Promise<T>;
  }

  const bundled = await bundleRuntimeModule(modulePath, opts);
  try {
    return await import(withFreshToken(bundled.path)) as T;
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
  const outFile = join(
    outDir,
    `.may-runtime-module-${process.pid}-${Date.now()}-${runtimeImportSeq}.mjs`,
  );
  const result = await Bun.build({
    entrypoints: [modulePath],
    target: "bun",
    format: "esm",
    write: false,
    plugins: [mayAgentSdkRuntimeResolver(modulePath)],
  });

  if (!result.success) {
    const messages = result.logs
      .map((log: { message: string }) => log.message)
      .join("\n");
    throw new Error(
      `Failed to bundle runtime module ${modulePath}${messages ? `:\n${messages}` : ""}`,
    );
  }

  const output = result.outputs[0];
  if (!output) {
    throw new Error(`Failed to bundle runtime module ${modulePath}: no output generated`);
  }

  await Bun.write(outFile, output);
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

function mirrorSourceDirForRelativeImports(
  sourceDir: string,
  outDir: string,
): void {
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
      symlinkSync(
        source,
        dest,
        stat.isDirectory() && process.platform === "win32"
          ? "junction"
          : undefined,
      );
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
      build.onResolve({ filter: /^@may-agent\/sdk(?:\/testing)?$/ }, (args) => {
        return {
          path: resolveSdkExport(args.path, args.importer || entrypoint),
        };
      });
    },
  };
}

function resolveSdkExport(specifier: string, importer: string): string {
  const exportFile = specifier === "@may-agent/sdk/testing" ? "testing.ts" : "index.ts";
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
  add(process.env.PROJECT_ROOT ? join(process.env.PROJECT_ROOT, "node_modules", "@may-agent", "sdk") : undefined);
  add(join(process.cwd(), "node_modules", "@may-agent", "sdk"));
  add(findNodeModulesSdk(dirname(importer)));

  return roots;
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
