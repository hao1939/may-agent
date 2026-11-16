import { defineObserver, observationCondition } from "@may-agent/sdk/app";
import type { ObservationContract } from "@may-agent/sdk/app";

export const COMPILER_PR_OBSERVER = "compiler-pull-request";
export const COMPILER_PR_EVENT = "aks.compiler.pull-request.state";
const repository = "aks-e2e-spec-runner";
const sha = /^[0-9a-f]{40}$/;

/** The operational App supplies its existing authorized, read-only ADO reader. */
export function compilerPullRequestObserver(
  read: (path: string) => Promise<unknown>,
) {
  return defineObserver({
    id: COMPILER_PR_OBSERVER,
    type: COMPILER_PR_EVENT,
    description:
      "Read only the exact compiler PR named by an outstanding Condition.",
    intervalMs: 300_000,
    // The existing reader bounds token acquisition and HTTP separately to 30s.
    timeoutMs: 65_000,
    async inspect(resource, { signal }) {
      const match = /^pull-request:([1-9][0-9]*)@([0-9a-f]{40})$/.exec(
        resource,
      );
      if (!match || !Number.isSafeInteger(Number(match[1])))
        throw new Error("Expected pull-request:<number>@<source SHA>");
      signal.throwIfAborted();
      const value = await read(
        `git/repositories/${repository}/pullrequests/${match[1]}`,
      );
      signal.throwIfAborted();
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Compiler PR read unavailable");
      const pr = value as Record<string, unknown>;
      const commit = (name: string) => {
        const field = pr[name] as { commitId?: unknown } | null;
        return typeof field?.commitId === "string" && sha.test(field.commitId)
          ? field.commitId
          : null;
      };
      if (
        String(pr.pullRequestId) !== match[1] ||
        !["active", "completed", "abandoned"].includes(String(pr.status)) ||
        typeof pr.isDraft !== "boolean" ||
        pr.targetRefName !== "refs/heads/main" ||
        !commit("lastMergeSourceCommit")
      )
        throw new Error(
          "Compiler PR response has unexpected identity or fields",
        );
      const mergeCommit = commit("lastMergeCommit");
      return {
        repository,
        pullRequestId: match[1],
        status: pr.status,
        isDraft: pr.isDraft,
        sourceCommit: commit("lastMergeSourceCommit"),
        mergeCommit,
        mergeCommitRecorded: mergeCommit !== null,
        targetBranch: pr.targetRefName,
      };
    },
  });
}

/** Human owns the merge; the App observes its result, never approval authority. */
export function compilerMergeCondition(
  capability: ObservationContract,
  input: { id: string; pullRequestId: number; sourceCommit: string },
) {
  if (
    capability.id !== COMPILER_PR_OBSERVER ||
    capability.type !== COMPILER_PR_EVENT ||
    !Number.isSafeInteger(input.pullRequestId) ||
    input.pullRequestId < 1 ||
    !sha.test(input.sourceCommit)
  )
    throw new Error("Invalid compiler merge observation");
  return observationCondition(capability, {
    observerId: COMPILER_PR_OBSERVER,
    id: input.id,
    resource: `pull-request:${input.pullRequestId}@${input.sourceCommit}`,
    expected: {
      repository,
      pullRequestId: String(input.pullRequestId),
      sourceCommit: input.sourceCommit,
      status: "completed",
      isDraft: false,
      targetBranch: "refs/heads/main",
      mergeCommitRecorded: true,
    },
  });
}
