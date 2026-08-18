import {
  chmodSync,
  chownSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

export type DeployReceiptPhase = "requested" | "succeeded" | "failed" | "rolled_back";

export function validateDeployTaskTarget(path: string, project: string, taskId: string): void {
  let state: unknown;
  try {
    state = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read deploy task state ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error(`Deploy task state ${path} is not an object`);
  }
  const record = state as Record<string, unknown>;
  if (record.project !== project) {
    throw new Error(`Deploy task state ${path} belongs to ${String(record.project ?? "unknown")}, not ${project}`);
  }
  const resources = record.resources;
  if (!resources || typeof resources !== "object" || Array.isArray(resources)) {
    throw new Error(`Deploy task state ${path} has no resource map`);
  }
  const target = (resources as Record<string, unknown>)[taskId];
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    throw new Error(`Deploy task ${project}/${taskId} does not exist; refusing to emit an unresolvable targeted wake`);
  }
}

function atomicJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const existing = existsSync(path) ? statSync(path) : undefined;
  const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  if (existing) {
    chmodSync(tmp, existing.mode & 0o777);
    chownSync(tmp, existing.uid, existing.gid);
  }
  renameSync(tmp, path);
}

function validId(value: string | undefined, label: string): string {
  if (!value || !/^[A-Za-z0-9._:/-]+$/.test(value)) throw new Error(`Invalid ${label}`);
  return value;
}

export function requestReceipt(
  path: string,
  project: string,
  taskId: string,
  correlation: string,
  artifactSha: string,
  sourceCommit?: string,
): boolean {
  const lock = `${path}.lock`;
  try {
    mkdirSync(lock);
  } catch {
    if (existsSync(path)) return false;
    throw new Error(`Deploy receipt lock is busy: ${lock}`);
  }
  try {
    if (existsSync(path)) return false;
    atomicJson(path, {
      version: 1,
      correlation,
      project,
      taskId,
      artifactSha,
      ...(sourceCommit ? { sourceCommit } : {}),
      phase: "requested",
      requestedAt: new Date().toISOString(),
      verification:
        "After the supervisor settles service and HTTP health, verify loadedArtifactSha equals artifactSha, health is healthy, targetedWake is true, duplicateDeploy is false, then complete the owner task without redeploying.",
    });
    return true;
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

export function settleReceipt(
  path: string,
  phase: Exclude<DeployReceiptPhase, "requested">,
  loadedArtifactSha: string,
  health: "healthy" | "unhealthy",
  targetedWake: boolean,
  failure?: string,
): void {
  const receipt = JSON.parse(readFileSync(path, "utf8"));
  if (receipt.phase !== "requested") return;
  atomicJson(path, {
    ...receipt,
    phase,
    completedAt: new Date().toISOString(),
    loadedArtifactSha,
    health,
    targetedWake,
    duplicateDeploy: false,
    ...(failure ? { failure } : {}),
  });
}

if (import.meta.main) {
  const [command, pathArg, ...args] = process.argv.slice(2);
  const path = pathArg;
  if (!path) throw new Error("Usage: deploy-receipt.ts <request|settle> <path> ...");
  if (command === "validate-target") {
    const [projectArg, taskArg] = args;
    validateDeployTaskTarget(path, validId(projectArg, "project"), validId(taskArg, "task id"));
  } else if (command === "request") {
    const [projectArg, taskArg, correlationArg, shaArg, sourceCommitArg] = args;
    const created = requestReceipt(
      path,
      validId(projectArg, "project"),
      validId(taskArg, "task id"),
      validId(correlationArg, "correlation"),
      validId(shaArg, "artifact SHA"),
      sourceCommitArg ? validId(sourceCommitArg, "source commit") : undefined,
    );
    if (!created) {
      console.error(`Deploy correlation already has a receipt; refusing duplicate deployment: ${correlationArg}`);
      process.exit(73);
    }
  } else if (command === "settle") {
    const [phaseArg, shaArg, healthArg, wakeArg, failureArg] = args;
    if (phaseArg !== "succeeded" && phaseArg !== "failed" && phaseArg !== "rolled_back") {
      throw new Error("Invalid terminal deploy phase");
    }
    if (healthArg !== "healthy" && healthArg !== "unhealthy") throw new Error("Invalid health value");
    settleReceipt(path, phaseArg, shaArg ?? "unknown", healthArg, wakeArg === "true", failureArg);
  } else {
    throw new Error(`Unknown deploy receipt command: ${command}`);
  }
}
