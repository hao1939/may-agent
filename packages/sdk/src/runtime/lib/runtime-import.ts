import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync, unlinkSync } from "node:fs";
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
  let result: Awaited<ReturnType<typeof Bun.build>>;
  try {
    result = await Bun.build({
      entrypoints: [modulePath],
      target: "bun",
      format: "esm",
      write: false,
      plugins: [mayAgentSdkRuntimeResolver(modulePath)],
    });
  } catch (error) {
    const messages = buildErrorMessages(error).join("\n");
    throw new Error(`Failed to bundle runtime module ${modulePath}${messages ? `:\n${messages}` : ""}`, {
      cause: error,
    });
  }

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

function buildErrorMessages(error: unknown): string[] {
  const messages: string[] = [];
  const add = (value: unknown) => {
    const message = value instanceof Error ? value.message : String(value);
    if (message && !messages.includes(message)) messages.push(message);
  };

  add(error);
  if (error instanceof AggregateError) {
    for (const nested of error.errors) add(nested);
  }
  return messages;
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
          filter: /^@may-agent\/sdk(?:\/(?:app|command|task|standalone|testing))?$/,
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
      : specifier === "@may-agent/sdk/command"
        ? "command.ts"
      : specifier === "@may-agent/sdk/standalone"
        ? "standalone.ts"
        : specifier === "@may-agent/sdk/testing"
          ? "testing.ts"
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

/**
 * Host-free workflow directory discovery and definition loading.
 *
 * Shared by Hosted execution (workflow-tool) and Direct/Gym execution
 * (direct-workflow) without importing SQLite, EventBus, or SubagentManager.
 */

import { createHash } from "node:crypto";
import { isAbsolute, relative } from "node:path";
import type { TSchema } from "typebox";
import type { ExecutionResult, AgentContext } from "../../index.js";

export interface WorkflowModule {
  name: string;
  description: string;
  readonly?: boolean;
  inputSchema?: TSchema;
  outputSchema?: TSchema;
  executionTimeoutMs?: number;
  workspace?: "shared" | "task" | { kind: "task"; baseBranch: string };
  execute: (ctx: AgentContext) => Promise<ExecutionResult>;
  verify?: (context: unknown, result: unknown) => Promise<unknown>;
  sourcePath: string;
  sourceScope: "agent" | "project";
  entryContentHash: string;
}

export interface WorkflowCatalog {
  readonly workflows: ReadonlyMap<string, WorkflowModule>;
  readonly diagnostics: readonly string[];
}

function isSchemaObject(value: unknown): value is TSchema {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function loadWorkflowModuleFromFile(
  filePath: string,
  sourceScope: "agent" | "project" = "agent",
): Promise<WorkflowModule> {
  const entryContentHash = createHash("sha256").update(readFileSync(filePath)).digest("hex");
  const mod = await importRuntimeModule<{
    name?: unknown;
    description?: unknown;
    readonly?: unknown;
    inputSchema?: unknown;
    outputSchema?: unknown;
    executionTimeoutMs?: unknown;
    workspace?: unknown;
    execute?: unknown;
    verify?: unknown;
  }>(filePath, { entryContentHash });

  if (typeof mod.name !== "string" || !mod.name.trim()) {
    throw new Error(`Workflow file ${filePath} must export a non-empty 'name' string`);
  }
  if (typeof mod.description !== "string" || !mod.description.trim()) {
    throw new Error(`Workflow file ${filePath} must export a non-empty 'description' string`);
  }
  if (typeof mod.execute !== "function") {
    throw new Error(`Workflow file ${filePath} must export an 'execute' function`);
  }
  if (mod.readonly !== undefined && typeof mod.readonly !== "boolean") {
    throw new Error(`Workflow file ${filePath} must export 'readonly' as a boolean when present`);
  }
  if (mod.verify !== undefined && typeof mod.verify !== "function") {
    throw new Error(`Workflow file ${filePath} must export 'verify' as a function when present`);
  }
  if (mod.inputSchema !== undefined && !isSchemaObject(mod.inputSchema)) {
    throw new Error(`Workflow file ${filePath} must export 'inputSchema' as a TypeBox schema object when present`);
  }
  if (mod.outputSchema !== undefined && !isSchemaObject(mod.outputSchema)) {
    throw new Error(`Workflow file ${filePath} must export 'outputSchema' as a TypeBox schema object when present`);
  }

  if (
    mod.executionTimeoutMs !== undefined &&
    (!Number.isInteger(mod.executionTimeoutMs) ||
      Number(mod.executionTimeoutMs) < 1_000 ||
      Number(mod.executionTimeoutMs) > 2 * 60 * 60_000)
  ) {
    throw new Error(
      `Workflow file ${filePath} must export 'executionTimeoutMs' as an integer from 1000 through 7200000 when present`,
    );
  }

  const taskWorkspace =
    mod.workspace !== null &&
    typeof mod.workspace === "object" &&
    !Array.isArray(mod.workspace) &&
    (mod.workspace as Record<string, unknown>).kind === "task" &&
    typeof (mod.workspace as Record<string, unknown>).baseBranch === "string" &&
    Boolean(String((mod.workspace as Record<string, unknown>).baseBranch).trim());
  if (mod.workspace !== undefined && mod.workspace !== "shared" && mod.workspace !== "task" && !taskWorkspace) {
    throw new Error(
      `Workflow file ${filePath} must export 'workspace' as "shared", "task", or { kind: "task", baseBranch } when present`,
    );
  }

  return {
    name: mod.name.trim(),
    description: mod.description.trim(),
    ...(mod.readonly !== undefined ? { readonly: mod.readonly } : {}),
    ...(mod.inputSchema !== undefined ? { inputSchema: mod.inputSchema } : {}),
    ...(mod.outputSchema !== undefined ? { outputSchema: mod.outputSchema } : {}),
    ...(mod.executionTimeoutMs !== undefined ? { executionTimeoutMs: Number(mod.executionTimeoutMs) } : {}),
    ...(mod.workspace
      ? {
          workspace: taskWorkspace
            ? {
                kind: "task" as const,
                baseBranch: String((mod.workspace as Record<string, unknown>).baseBranch).trim(),
              }
            : (mod.workspace as "shared" | "task"),
        }
      : {}),
    execute: mod.execute as WorkflowModule["execute"],
    ...(typeof mod.verify === "function" ? { verify: mod.verify as WorkflowModule["verify"] } : {}),
    sourcePath: filePath,
    sourceScope,
    entryContentHash,
  };
}

export function listWorkflowFiles(workflowDir: string | undefined): string[] {
  if (!workflowDir) return [];
  try {
    const trustedRoot = realpathSync(workflowDir);
    return readdirSync(workflowDir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.includes("-helpers") && !f.includes("-utils"))
      .sort()
      .map((file) => realpathSync(join(workflowDir, file)))
      .filter((filePath) => {
        const fromRoot = relative(trustedRoot, filePath);
        return (
          fromRoot !== ".." &&
          !fromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
          !isAbsolute(fromRoot)
        );
      });
  } catch {
    return [];
  }
}

function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new Error("Operation aborted"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(signal.reason ?? new Error("Operation aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (val) => {
        signal.removeEventListener("abort", onAbort);
        resolve(val);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

export async function loadWorkflowScope(
  dir: string | undefined,
  scope: "agent" | "project",
  signal?: AbortSignal,
  hooks?: { onImportStart?: () => void; onImportSettled?: () => void },
): Promise<{ workflows: Map<string, WorkflowModule>; diagnostics: string[] }> {
  const grouped = new Map<string, WorkflowModule[]>();
  const diagnostics: string[] = [];
  for (const filePath of listWorkflowFiles(dir)) {
    signal?.throwIfAborted();
    try {
      hooks?.onImportStart?.();
      const rawImport = loadWorkflowModuleFromFile(filePath, scope);
      if (hooks?.onImportSettled) {
        const notifySettled = () => hooks.onImportSettled!();
        rawImport.then(notifySettled, notifySettled);
      }
      const workflow = await raceWithAbort(rawImport, signal);
      signal?.throwIfAborted();
      const matches = grouped.get(workflow.name) ?? [];
      matches.push(workflow);
      grouped.set(workflow.name, matches);
    } catch (err) {
      signal?.throwIfAborted();
      diagnostics.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const workflows = new Map<string, WorkflowModule>();
  for (const [name, matches] of grouped) {
    if (matches.length > 1) {
      diagnostics.push(
        `Ambiguous ${scope} workflow name "${name}": ${matches.map((item) => item.sourcePath).join(", ")}`,
      );
      continue;
    }
    workflows.set(name, matches[0]);
  }
  return { workflows, diagnostics };
}

export async function buildWorkflowCatalog(
  workflowDir: string,
  signal?: AbortSignal,
  hooks?: { onImportStart?: () => void; onImportSettled?: () => void },
): Promise<WorkflowCatalog> {
  signal?.throwIfAborted();
  const agent = await loadWorkflowScope(workflowDir, "agent", signal, hooks);
  signal?.throwIfAborted();
  return Object.freeze({
    workflows: new Map(agent.workflows),
    diagnostics: Object.freeze([...agent.diagnostics]),
  });
}

export function findWorkflow(
  catalog: WorkflowCatalog,
  name: string,
): { workflow: WorkflowModule | null; error: string | null } {
  const workflow = catalog.workflows.get(name) ?? null;
  if (workflow) return { workflow, error: null };
  const diagnostics =
    catalog.diagnostics.length > 0 ? ` Catalog diagnostics:\n  ${catalog.diagnostics.join("\n  ")}` : "";
  return { workflow: null, error: `Workflow "${name}" not found.${diagnostics}` };
}

/** Inspect an agent-owned workflow binding without executing the workflow. */
export async function inspectWorkflowDefinition(
  workflowDir: string,
  name: string,
): Promise<{
  available: boolean;
  error: string | null;
  workspace: "shared" | "task" | { kind: "task"; baseBranch: string };
  verifier?: { name: string; sourcePath: string; verify: NonNullable<WorkflowModule["verify"]> };
}> {
  const resolved = findWorkflow(await buildWorkflowCatalog(workflowDir), name);
  const verifier = resolved.workflow?.verify
    ? {
        name: resolved.workflow.name,
        sourcePath: resolved.workflow.sourcePath,
        verify: resolved.workflow.verify,
      }
    : undefined;
  return {
    available: resolved.workflow !== null,
    error: resolved.error,
    workspace: resolved.workflow?.workspace ?? "shared",
    ...(verifier ? { verifier } : {}),
  };
}
