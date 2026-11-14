/**
 * Host-free workflow directory discovery and definition loading.
 *
 * Shared by Hosted execution (workflow-tool) and Direct/Gym execution
 * (direct-workflow) without importing SQLite, EventBus, or SubagentManager.
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import type { TSchema } from "typebox";
import { importRuntimeModule } from "./runtime-import.js";
import type { WorkflowModule } from "./workflow.js";

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
