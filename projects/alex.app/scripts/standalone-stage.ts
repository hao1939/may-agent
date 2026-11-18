#!/usr/bin/env bun
/** Manual stage execution over the public SDK; no Host admission or scheduling. */
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createModelRegistry,
  runDirectWorkflow,
  type DirectWorkflowRunOptions,
  type ModelRegistry,
} from "@may-agent/sdk/standalone";

export interface StageConfig {
  target: string;
  input: unknown;
  task: { id?: string; outcome: string; acceptance?: string[]; constraints?: string[]; input?: unknown };
  cwd: string;
  projectRoot: string;
  outputRoot: string;
  timeoutMs: number;
  tools?: "full" | "readonly";
  outputSchemaFile?: string;
  /** Explicit local module exporting agentFixtures; omitted for live models. */
  fixtureFile?: string;
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const errorRecord = (error: unknown) => error instanceof Error
  ? { name: error.name, message: error.message, stack: error.stack }
  : { message: String(error) };

function git(root: string, ...args: string[]) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function sourceIdentity(root: string) {
  return { root, commit: git(root, "rev-parse", "HEAD"), status: git(root, "status", "--short") };
}

export function stageModelRegistry(hasAgentFixtures: boolean): ModelRegistry {
  return hasAgentFixtures ? {} : createModelRegistry();
}

function treeHash(root: string): string {
  const hash = createHash("sha256");
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (["node_modules", ".git", ".state"].includes(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) hash.update(path.slice(root.length + 1)).update("\0").update(readFileSync(path)).update("\0");
    }
  }
  walk(root);
  return hash.digest("hex");
}

export function loadStageConfig(file: string): StageConfig {
  const value = JSON.parse(readFileSync(file, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Stage config must be an object");
  for (const field of ["target", "cwd", "projectRoot", "outputRoot"]) {
    if (typeof value[field] !== "string" || !value[field].trim()) throw new Error(`Stage config requires ${field}`);
  }
  if (!Object.hasOwn(value, "input")) throw new Error("Stage config requires input");
  if (!value.task || typeof value.task.outcome !== "string" || !value.task.outcome.trim()) throw new Error("Stage config requires task.outcome");
  for (const field of ["acceptance", "constraints"]) {
    if (value.task[field] !== undefined && (!Array.isArray(value.task[field]) || value.task[field].some((s: unknown) => typeof s !== "string" || !s.trim()))) {
      throw new Error(`task.${field} must contain non-empty strings`);
    }
  }
  if (!Number.isSafeInteger(value.timeoutMs) || value.timeoutMs < 1) throw new Error("timeoutMs must be a positive integer");
  if (value.tools !== undefined && value.tools !== "full" && value.tools !== "readonly") throw new Error("tools must be full or readonly");
  const base = dirname(resolve(file));
  for (const field of ["cwd", "projectRoot", "outputRoot", "fixtureFile", "outputSchemaFile"]) {
    if (value[field] !== undefined) {
      if (typeof value[field] !== "string" || !value[field].trim()) throw new Error(`${field} must be a non-empty path`);
      value[field] = resolve(base, value[field]);
    }
  }
  return value;
}

export async function runStage(configFile: string, signal?: AbortSignal) {
  const config = loadStageConfig(configFile);
  // A source or working root may contain live edits; neither may be the shared checkout.
  for (const root of new Set([config.cwd, config.projectRoot])) {
    if (!lstatSync(join(root, ".git")).isFile()) throw new Error(`Use an isolated linked Git worktree: ${root}`);
    git(root, "check-ignore", ".state/");
  }

  // Exclusive creation keeps a replay from replacing an earlier invocation's evidence.
  mkdirSync(dirname(config.outputRoot), { recursive: true });
  mkdirSync(config.outputRoot);
  const startedAt = new Date().toISOString();
  const invocationId = `standalone_${randomUUID()}`;
  config.task = { ...config.task, id: config.task.id ?? invocationId };
  const record = (type: string, data: unknown) => appendFileSync(join(config.outputRoot, "events.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), type, data })}\n`);
  const save = (name: string, value: unknown) => writeFileSync(join(config.outputRoot, name), json(value));
  save("config.json", config);
  save("input.json", config.input);
  save("task.json", config.task);
  save("receipt.json", { invocationId, startedAt, status: "running", target: config.target });

  let provenance: unknown;
  let sdkRoot: string | undefined;
  let sdkHash: string | undefined;
  try {
    const sdkEntry = realpathSync(fileURLToPath(import.meta.resolve("@may-agent/sdk/standalone")));
    sdkRoot = dirname(dirname(sdkEntry));
    sdkHash = treeHash(sdkRoot);
    provenance = {
      invocationId,
      execution: "standalone",
      mode: config.fixtureFile ? "fixtures" : "live",
      configSha256: sha256(readFileSync(configFile)),
      inputSha256: sha256(json(config.input)),
      taskSha256: sha256(json(config.task)),
      source: sourceIdentity(config.projectRoot),
      working: sourceIdentity(config.cwd),
      sdk: { entry: sdkEntry, root: sdkRoot, sha256: sdkHash },
      runnerSha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
      ...(config.fixtureFile ? { fixture: { path: config.fixtureFile, sha256: sha256(readFileSync(config.fixtureFile)) } } : {}),
    };
    save("provenance.json", provenance);
    const outputSchema = config.outputSchemaFile ? JSON.parse(readFileSync(config.outputSchemaFile, "utf8")) : undefined;
    if (outputSchema) save("output-schema.json", outputSchema);
    const agentFixtures = config.fixtureFile ? (await import(pathToFileURL(config.fixtureFile).href)).agentFixtures : undefined;
    if (config.fixtureFile && (!agentFixtures || typeof agentFixtures !== "object")) throw new Error("fixtureFile must export agentFixtures");
    record("started", { invocationId, target: config.target, outputRoot: config.outputRoot });
    const result = await runDirectWorkflow({
      target: config.target,
      input: config.input,
      projectRoot: config.projectRoot,
      workRoot: config.cwd,
      agentsRoot: join(config.projectRoot, "agents"),
      projectsRoot: join(config.projectRoot, "projects"),
      globalAgentsRoot: join(config.projectRoot, "agents"),
      sharedRoot: join(config.projectRoot, "shared"),
      appScope: config.target.slice(0, config.target.indexOf("/")),
      outputRoot: config.outputRoot,
      traceDir: join(config.outputRoot, "trace"),
      models: stageModelRegistry(Boolean(agentFixtures)),
      timeoutMs: config.timeoutMs,
      signal,
      tools: config.tools ?? "full",
      outputSchema,
      agentFixtures,
      onStep: (step) => record("step", step),
      onLog: (entry) => record("log", entry),
      onNotice: (message) => record("notice", message),
    } satisfies DirectWorkflowRunOptions);
    save("result.json", { ...result, ...(result.error ? { error: errorRecord(result.error) } : {}) });
    const sdkHashAfter = treeHash(sdkRoot);
    const sourceAfter = { source: sourceIdentity(config.projectRoot), working: sourceIdentity(config.cwd) };
    const sdkChanged = sdkHashAfter !== sdkHash;
    const cleanupConfirmed = result.report.cleanup.confirmed === true;
    const status = sdkChanged || !cleanupConfirmed ? "error" : result.status;
    const exitCode = status === "done" && result.ok ? 0 : status === "blocked" ? 2 : status === "interrupted" ? 130 : 1;
    const receipt = {
      invocationId, target: config.target, startedAt, completedAt: new Date().toISOString(),
      elapsedMs: Date.now() - Date.parse(startedAt), status, exitCode,
      executionId: result.report.executionId, cleanupConfirmed, sdkChanged, sdkHashAfter, sourceAfter,
      summary: result.result?.type === "done" ? result.result.summary : result.result?.reason ?? result.report.error?.message,
      paths: { result: join(config.outputRoot, "result.json"), trace: result.reportPath, sessions: result.childSessions },
    };
    save("receipt.json", receipt);
    record("finished", receipt);
    return { exitCode, receipt, outputRoot: config.outputRoot };
  } catch (error) {
    const receipt = {
      invocationId, target: config.target, startedAt, completedAt: new Date().toISOString(),
      elapsedMs: Date.now() - Date.parse(startedAt), status: signal?.aborted ? "interrupted" : "error",
      exitCode: signal?.aborted ? 130 : 1, error: errorRecord(error),
    };
    save("error.json", errorRecord(error));
    save("receipt.json", receipt);
    record("finished", receipt);
    return { exitCode: receipt.exitCode, receipt, outputRoot: config.outputRoot };
  }
}

if (import.meta.main) {
  const file = process.argv[2];
  if (!file || process.argv.length !== 3) {
    console.error("Usage: bun projects/alex.app/scripts/standalone-stage.ts <stage-config.json>");
    process.exit(1);
  }
  const controller = new AbortController();
  const cancel = () => controller.abort(new Error("Manual standalone stage cancelled"));
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  try {
    console.error(`Evidence: ${loadStageConfig(file).outputRoot}`);
    const result = await runStage(resolve(file), controller.signal);
    console.log(json({ status: result.receipt.status, outputRoot: result.outputRoot, receipt: join(result.outputRoot, "receipt.json") }).trim());
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(errorRecord(error).message);
    process.exitCode = 1;
  } finally {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
  }
}
