import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

export type LearningCandidateStatus =
  "proposed" | "validated" | "promoted" | "rejected" | "applied";

export interface LearningCandidateEntry {
  candidateId: string;
  status: LearningCandidateStatus;
  sessionId: string;
  reviewSessionId?: string;
  agent?: string;
  artifactPath?: string;
  summary?: string;
  evidence?: Record<string, unknown>;
  owner: string;
  createdAt: string;
}

function readEntries(path: string): LearningCandidateEntry[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as LearningCandidateEntry];
      } catch {
        return [];
      }
    });
}

function append(path: string, entry: LearningCandidateEntry): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf8");
}

export function learningCandidateId(
  sessionId: string,
  artifactPath?: string,
): string {
  return `learn_${createHash("sha256")
    .update(`${sessionId}\n${artifactPath ?? ""}`)
    .digest("hex")
    .slice(0, 16)}`;
}

export function appendLearningCandidate(
  path: string,
  input: Omit<
    LearningCandidateEntry,
    "candidateId" | "status" | "owner" | "createdAt"
  > & {
    owner?: string;
    createdAt?: string;
  },
): { candidateId: string; created: boolean } {
  const candidateId = learningCandidateId(input.sessionId, input.artifactPath);
  if (
    readEntries(path).some(
      (entry) =>
        entry.candidateId === candidateId && entry.status === "proposed",
    )
  ) {
    return { candidateId, created: false };
  }
  append(path, {
    ...input,
    candidateId,
    status: "proposed",
    owner: input.owner ?? "evaluator",
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
  return { candidateId, created: true };
}

export function appendLearningDecision(
  path: string,
  candidateId: string,
  status: Exclude<LearningCandidateStatus, "proposed">,
  input: {
    owner: string;
    summary?: string;
    evidence?: Record<string, unknown>;
    createdAt?: string;
  },
): void {
  const entries = readEntries(path);
  const proposed = entries.find(
    (entry) => entry.candidateId === candidateId && entry.status === "proposed",
  );
  if (!proposed)
    throw new Error(`Learning candidate "${candidateId}" not found`);
  append(path, {
    ...proposed,
    ...input,
    candidateId,
    status,
    owner: input.owner,
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
}
