import {
  chmodSync,
  chownSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

export type DeployReceiptPhase = "requested" | "succeeded" | "failed" | "rolled_back";

/** Operation evidence, not an instruction or a second Task lifecycle. */
export type DeployReceipt = {
  version: 1;
  correlation: string;
  /** Optional best-effort notification destination retained by older receipts. */
  project?: string;
  taskId?: string;
  artifactSha: string;
  sourceCommit?: string;
  phase: DeployReceiptPhase;
  requestedAt: string;
  verification: string;
  completedAt?: string;
  loadedArtifactSha?: string;
  health?: "healthy" | "unhealthy";
  duplicateDeploy?: boolean;
  failure?: string;
};

function nonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function timestamp(value: unknown): value is string {
  return nonEmptyText(value) && Number.isFinite(Date.parse(value));
}

function parseDeployReceipt(path: string): DeployReceipt {
  const receipt = JSON.parse(readFileSync(path, "utf8")) as Partial<DeployReceipt> | null;
  const hasProject = receipt?.project !== undefined;
  const hasTask = receipt?.taskId !== undefined;
  if (
    !receipt || receipt.version !== 1 || hasProject !== hasTask ||
    (hasProject && (!nonEmptyText(receipt.project) || !nonEmptyText(receipt.taskId))) ||
    !nonEmptyText(receipt.correlation) || !nonEmptyText(receipt.artifactSha) ||
    !nonEmptyText(receipt.verification) || !timestamp(receipt.requestedAt) ||
    !["requested", "succeeded", "failed", "rolled_back"].includes(receipt.phase ?? "") ||
    (receipt.sourceCommit !== undefined && !nonEmptyText(receipt.sourceCommit)) ||
    (receipt.failure !== undefined && typeof receipt.failure !== "string") ||
    (receipt.completedAt !== undefined && !timestamp(receipt.completedAt)) ||
    (receipt.loadedArtifactSha !== undefined && !nonEmptyText(receipt.loadedArtifactSha)) ||
    (receipt.health !== undefined && receipt.health !== "healthy" && receipt.health !== "unhealthy") ||
    (receipt.duplicateDeploy !== undefined && typeof receipt.duplicateDeploy !== "boolean") ||
    (receipt.phase !== "requested" && (
      receipt.completedAt === undefined || receipt.loadedArtifactSha === undefined ||
      receipt.health === undefined || receipt.duplicateDeploy === undefined
    ))
  ) throw new Error(`Invalid deployment receipt: ${path}`);
  return receipt as DeployReceipt;
}

/** Read one exact durable operation result without searching or redeploying. */
export function readDeployReceipt(path: string): DeployReceipt {
  return parseDeployReceipt(path);
}

/** Backwards-compatible read-only fallback for receipts carrying a Task target. */
export function readDeployReceiptForTask(receiptDir: string, project: string, taskId: string): DeployReceipt | null {
  if (!existsSync(receiptDir)) return null;
  const receipts: DeployReceipt[] = [];
  for (const name of readdirSync(receiptDir).filter(entry => entry.endsWith(".json")).sort()) {
    const receipt = parseDeployReceipt(join(receiptDir, name));
    if (receipt.project === project && receipt.taskId === taskId) receipts.push(receipt);
  }
  return receipts.sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt))[0] ?? null;
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

export function validateNotificationTarget(project?: string, taskId?: string): void {
  if (!project && !taskId) return;
  if (!project || !taskId) throw new Error("Deployment notification requires both App ID and Task ID");
  validId(project, "App ID");
  validId(taskId, "Task ID");
}

export function validateCorrelation(value: string | undefined): string {
  if (!value || !/^[A-Za-z0-9._-]+$/.test(value)) throw new Error("Invalid deployment correlation");
  return value;
}

export function requestReceipt(
  path: string,
  project: string | undefined,
  taskId: string | undefined,
  correlation: string,
  artifactSha: string,
  sourceCommit?: string,
): boolean {
  validateNotificationTarget(project, taskId);
  validateCorrelation(correlation);
  mkdirSync(dirname(path), { recursive: true });
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
      ...(project && taskId ? { project, taskId } : {}),
      artifactSha,
      ...(sourceCommit ? { sourceCommit } : {}),
      phase: "requested",
      requestedAt: new Date().toISOString(),
      verification:
        "After the restarter settles service and HTTP health, read this exact receipt without redeploying; verify loadedArtifactSha equals artifactSha, health is healthy, and duplicateDeploy is false. Any notification target is best-effort only.",
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
    duplicateDeploy: false,
    ...(failure ? { failure } : {}),
  });
}

if (import.meta.main) {
  const [command, pathArg, ...args] = process.argv.slice(2);
  const path = pathArg;
  if (path === undefined) throw new Error("Usage: deploy-receipt.ts <read|read-task|validate-notification|request|settle> <path> ...");
  if (command === "read") {
    console.log(JSON.stringify(readDeployReceipt(path)));
  } else if (command === "read-task") {
    const [projectArg, taskArg] = args;
    console.log(JSON.stringify(readDeployReceiptForTask(path, validId(projectArg, "project"), validId(taskArg, "task id"))));
  } else if (command === "validate-notification") {
    validateNotificationTarget(path === "" ? undefined : path, args[0] === "" ? undefined : args[0]);
    validateCorrelation(args[1]);
  } else if (command === "request") {
    const [projectArg, taskArg, correlationArg, shaArg, sourceCommitArg] = args;
    const project = projectArg === "" ? undefined : projectArg;
    const taskId = taskArg === "" ? undefined : taskArg;
    validateNotificationTarget(project, taskId);
    const created = requestReceipt(
      path,
      project,
      taskId,
      validateCorrelation(correlationArg),
      validId(shaArg, "artifact SHA"),
      sourceCommitArg ? validId(sourceCommitArg, "source commit") : undefined,
    );
    if (!created) {
      console.error(`Deploy correlation already has a receipt; refusing duplicate deployment: ${correlationArg}`);
      process.exit(73);
    }
  } else if (command === "settle") {
    const [phaseArg, shaArg, healthArg, failureArg] = args;
    if (phaseArg !== "succeeded" && phaseArg !== "failed" && phaseArg !== "rolled_back") {
      throw new Error("Invalid terminal deploy phase");
    }
    if (healthArg !== "healthy" && healthArg !== "unhealthy") throw new Error("Invalid health value");
    settleReceipt(path, phaseArg, shaArg ?? "unknown", healthArg, failureArg);
  } else {
    throw new Error(`Unknown deploy receipt command: ${command}`);
  }
}
