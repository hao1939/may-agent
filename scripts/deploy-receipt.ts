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
import { Database } from "bun:sqlite";

export type DeployReceiptPhase = "requested" | "succeeded" | "failed" | "rolled_back";

/** Operation evidence, not an instruction or a second Task lifecycle. */
export type DeployReceipt = {
  version: 1;
  correlation: string;
  project: string;
  taskId: string;
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

/** Read-only fallback when a restart wake was lost; correlate both App and Task. */
export function readDeployReceiptForTask(receiptDir: string, project: string, taskId: string): DeployReceipt | null {
  if (!existsSync(receiptDir)) return null;
  const receipts: DeployReceipt[] = [];
  for (const name of readdirSync(receiptDir).filter(entry => entry.endsWith(".json")).sort()) {
    const receipt = JSON.parse(readFileSync(join(receiptDir, name), "utf8")) as Partial<DeployReceipt> | null;
    // A damaged receipt must not look like evidence that no deployment exists.
    if (!receipt || receipt.version !== 1 || typeof receipt.project !== "string" || typeof receipt.taskId !== "string") {
      throw new Error(`Invalid deployment receipt: ${name}`);
    }
    if (receipt.project !== project || receipt.taskId !== taskId) continue;
    if (
      typeof receipt.correlation !== "string" || !receipt.correlation ||
      typeof receipt.artifactSha !== "string" || !receipt.artifactSha ||
      typeof receipt.requestedAt !== "string" || !Number.isFinite(Date.parse(receipt.requestedAt)) ||
      !["requested", "succeeded", "failed", "rolled_back"].includes(receipt.phase ?? "")
    ) throw new Error(`Invalid deployment receipt for ${project}/${taskId}: ${name}`);
    receipts.push(receipt as DeployReceipt);
  }
  return receipts.sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt))[0] ?? null;
}

export function validateDeployTaskTarget(path: string, project: string, taskId: string): void {
  if (project !== "may-agent") {
    throw new Error(
      `May runtime deployment belongs to may-agent, not ${project}; route the runtime change through the may-agent App`,
    );
  }
  if (!existsSync(path)) throw new Error(`Cannot read deploy task database ${path}: file does not exist`);
  let db: Database | undefined;
  try {
    db = new Database(path, { readonly: true });
    db.exec("PRAGMA query_only = ON");
    const authority = db
      .query("SELECT value FROM app_task_store_meta WHERE app_id = ? AND key = 'authority'")
      .get(project) as { value?: string } | null;
    if (authority?.value !== "resources") {
      throw new Error(`Task resources for ${project} are not canonical in ${path}`);
    }
    const target = db
      .query(
        `SELECT EXISTS(SELECT 1 FROM app_task_cancellations closed
        WHERE closed.app_id = task.app_id AND closed.task_id = task.task_id) AS closed
        FROM app_tasks task WHERE task.app_id = ? AND task.task_id = ?`,
      )
      .get(project, taskId) as { closed: number } | null;
    if (!target) {
      throw new Error(
        `Deploy task ${project}/${taskId} does not exist; refusing to emit an unresolvable targeted wake`,
      );
    }
    if (target.closed)
      throw new Error(`Deploy task ${project}/${taskId} is closed; it cannot accept a deployment wake`);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("Deploy task ") || error.message.startsWith("Task resources "))
    ) {
      throw error;
    }
    throw new Error(
      `Cannot read deploy task database ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    db?.close();
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
        "After the restarter settles service and HTTP health, verify loadedArtifactSha equals artifactSha, health is healthy, and duplicateDeploy is false, then report the result to the owning Task without redeploying.",
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
  if (!path) throw new Error("Usage: deploy-receipt.ts <read-task|validate-target|request|settle> <path> ...");
  if (command === "read-task") {
    const [projectArg, taskArg] = args;
    console.log(JSON.stringify(readDeployReceiptForTask(path, validId(projectArg, "project"), validId(taskArg, "task id"))));
  } else if (command === "validate-target") {
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
