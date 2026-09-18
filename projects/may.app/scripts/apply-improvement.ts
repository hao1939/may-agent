/** Human-operated source application. Never installed as an agent workflow/tool. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { applicationDenial, type ApprovalPacket } from "../improvement-approval";

export type ApplicationFiles = {
  packet: string;
  repository: string;
  diff: string;
  verification: string;
  comparison: string;
};

const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

function git(repository: string, args: string[]): string {
  return execFileSync("git", ["-C", repository, ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim();
}

/** Reads actual source and evidence. It does not accept a model's current-state assertions. */
export function inspectApplication(files: ApplicationFiles) {
  const packet = JSON.parse(readFileSync(files.packet, "utf8")) as ApprovalPacket;
  const repository = realpathSync(files.repository);
  if (git(repository, ["rev-parse", "--show-toplevel"]) !== repository) throw new Error("repository must be the worktree root");
  if (git(repository, ["status", "--porcelain"])) throw new Error("application worktree is not clean");
  git(repository, ["symbolic-ref", "--quiet", "HEAD"]);
  for (const key of ["baselineCommit", "candidateCommit", "candidateTreeHash", "rollbackCommit"] as const) {
    if (!/^[0-9a-f]{40}$/.test(packet[key] ?? "")) throw new Error(`invalid ${key}`);
  }
  const current = {
    baselineCommit: git(repository, ["rev-parse", "HEAD"]),
    candidateCommit: git(repository, ["rev-parse", `${packet.candidateCommit}^{commit}`]),
    candidateTreeHash: git(repository, ["rev-parse", `${packet.candidateCommit}^{tree}`]),
    activationScope: `git-fast-forward:${repository}`,
  };
  if (packet.rollbackCommit !== packet.baselineCommit) throw new Error("rollback must identify the previous baseline");
  if (packet.candidateCommit === packet.baselineCommit) throw new Error("candidate makes no source change");
  git(repository, ["merge-base", "--is-ancestor", packet.baselineCommit, packet.candidateCommit]);
  const diff = execFileSync("git", ["-C", repository, "diff", "--binary", "--no-ext-diff", "--no-renames", packet.baselineCommit, packet.candidateCommit], { maxBuffer: 16 * 1024 * 1024 });
  if (sha256(diff) !== packet.diffSha256 || sha256(readFileSync(files.diff)) !== packet.diffSha256) throw new Error("complete Git diff does not match the reviewed diff");
  const verificationBytes = readFileSync(files.verification);
  const comparisonBytes = readFileSync(files.comparison);
  if (sha256(verificationBytes) !== packet.verificationSha256) throw new Error("verification evidence changed");
  if (sha256(comparisonBytes) !== packet.comparisonSha256) throw new Error("comparison evidence changed");
  // A trusted human decision is supplied only by the operator invocation below.
  // Extra JSON fields claiming human authority have no effect.
  return { packet, current, repository, evidence: { diffSha256: packet.diffSha256, verificationSha256: packet.verificationSha256, comparisonSha256: packet.comparisonSha256 } };
}

export function applyImprovement(files: ApplicationFiles, approvedPacketHash?: string) {
  const inspected = inspectApplication(files);
  const { packet, current, repository } = inspected;
  const decision = approvedPacketHash ? {
    decision: "approved" as const,
    trustedHumanControl: true,
    packetHash: approvedPacketHash,
    baselineCommit: packet.baselineCommit,
    candidateCommit: packet.candidateCommit,
    candidateTreeHash: packet.candidateTreeHash,
    activationScope: packet.activationScope,
  } : null;
  const denial = applicationDenial(packet, decision, current);
  if (denial) return { applied: false, denial, ...inspected };
  // Operator owns exclusive use of this clean checkout during this bounded command.
  // Ordinary Git locking applies; this command is not a distributed deployment lock.
  const rechecked = inspectApplication(files);
  if (rechecked.packet.packetHash !== approvedPacketHash) throw new Error("approval packet changed before application");
  const changed = applicationDenial(rechecked.packet, decision, rechecked.current);
  if (changed) throw new Error(changed);
  git(repository, ["merge", "--ff-only", packet.candidateCommit]);
  const appliedCommit = git(repository, ["rev-parse", "HEAD"]);
  if (appliedCommit !== packet.candidateCommit || git(repository, ["status", "--porcelain"])) throw new Error("source application verification failed; inspect current checkout before further action");
  return { applied: true, appliedCommit, ...inspected };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const option = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const required = (name: string) => {
    const value = option(name);
    if (!value || value.startsWith("--")) throw new Error(`required ${name}`);
    return resolve(value);
  };
  const files = { packet: required("--packet"), repository: required("--repo"), diff: required("--diff"), verification: required("--verification"), comparison: required("--comparison") };
  const receiptPath = required("--receipt");
  // Evidence and receipts must be outside the target checkout so inspection is clean.
  writeFileSync(receiptPath, JSON.stringify({ stage: "source-application", phase: "requested", files, approvedPacketHash: option("--approve") ?? null }) + "\n", { flag: "wx" });
  try {
    const result = applyImprovement(files, option("--approve"));
    writeFileSync(receiptPath, JSON.stringify({ stage: "source-application", time: new Date().toISOString(), ...result }, null, 2) + "\n");
    console.log(JSON.stringify({ applied: result.applied, receipt: receiptPath, ...("denial" in result ? { denial: result.denial } : {}) }));
    if (!result.applied) process.exitCode = 2;
  } catch (error) {
    writeFileSync(receiptPath, JSON.stringify({ stage: "source-application", phase: "failed", files, error: String(error), time: new Date().toISOString() }, null, 2) + "\n");
    throw error;
  }
}
