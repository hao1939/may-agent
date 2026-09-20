import type { TaskAppDependency, TaskReconcileResult } from "@may-agent/sdk";
import { KnowledgePublicationError } from "./knowledge-publication.js";

export type AcceptedPublicationRecovery = {
  ref: string;
  revision: string;
  changedPaths: string[];
};

type WaitingResult = Extract<TaskReconcileResult, { state: "waiting" }>;

export function acceptedPublicationRecovery(
  input: unknown,
): AcceptedPublicationRecovery | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return undefined;
  const data = (input as { data?: unknown }).data;
  if (!data || typeof data !== "object" || Array.isArray(data))
    return undefined;
  const context = (data as { context?: unknown }).context;
  if (!context || typeof context !== "object" || Array.isArray(context))
    return undefined;
  const candidate = context as Record<string, unknown>;
  if (
    candidate.reason !== "accepted-publication-recovery" ||
    typeof candidate.candidateRef !== "string" ||
    typeof candidate.candidateRevision !== "string" ||
    !Array.isArray(candidate.changedPaths) ||
    candidate.changedPaths.length === 0 ||
    candidate.changedPaths.some((path) => typeof path !== "string")
  )
    return undefined;
  return {
    ref: candidate.candidateRef,
    revision: candidate.candidateRevision,
    changedPaths: candidate.changedPaths as string[],
  };
}

export type AcceptedPublicationContext = {
  summary: string;
  facts: string[];
  acceptedWaiting?: WaitingResult;
  recovery?: AcceptedPublicationRecovery;
};

/**
 * Convert a failed, already-accepted publication into ordinary durable Scout
 * work. The content-keyed archive ref is the identity, so retries attach the
 * same immutable goal. An admitted waiting result is preserved as a whole;
 * publication ownership is added without dropping independent obligations.
 */
export function retainAcceptedPublication(
  error: unknown,
  context: AcceptedPublicationContext,
): WaitingResult | undefined {
  if (
    !(error instanceof KnowledgePublicationError) ||
    error.changedPaths.length === 0
  )
    return undefined;

  const facts = [
    ...(context.acceptedWaiting?.facts ?? context.facts),
    ...(error.candidateRef
      ? [
          `accepted-publication:pending:${error.candidateRevision}`,
          `candidate-ref:${error.candidateRef}`,
          `candidate-base:${error.candidateBase}`,
        ]
      : [
          `publication:failed:${error.message}`,
          "accepted-publication:archive-unavailable",
        ]),
    ...error.changedPaths.map((path) => `candidate-change:${path}`),
  ].filter((fact) => !fact.startsWith("output:")) as [string, ...string[]];

  // A recovery Task already owns this exact obligation. Keep its ordinary
  // waiting result, but never recursively create another recovery dependency.
  if (context.recovery || !error.candidateRef) {
    if (!context.acceptedWaiting) return undefined;
    return {
      ...context.acceptedWaiting,
      facts,
    };
  }

  const recoveryDependency: TaskAppDependency = {
    id: `accepted-publication-${error.candidateRef.slice(error.candidateRef.lastIndexOf("/") + 1)}`,
    appId: "scout-knowledge-lib",
    input: {
      kind: "goal",
      data: {
        outcome: `Publish the accepted Scout candidate ${error.candidateRevision} without losing or substituting its reviewed content.`,
        acceptance: [
          `Read ${error.candidateRef} at ${error.candidateRevision}; its original changed paths are provenance: ${error.changedPaths.join(", ")}. Preserve the accepted content exactly or make a Scout-judged suitable writable adaptation.`,
          "Use the shared atomic publication boundary and verify the resulting canonical commit and bytes. A no-change result is sufficient only when canonical HEAD already contains the exact candidate bytes.",
          "If safe writable integration needs human action, retain this obligation and return an exact human-owned Condition visible in /todo; do not change protected paths or permissions.",
        ],
        constraints: [
          "Do not treat a later scan, unrelated publication, draft, or rejected candidate as delivery of this accepted candidate.",
          "The temporary candidate worktree may be absent; the archived Git ref is authoritative recovery evidence.",
        ],
        context: {
          reason: "accepted-publication-recovery",
          candidateRef: error.candidateRef,
          candidateRevision: error.candidateRevision,
          candidateBase: error.candidateBase,
          changedPaths: error.changedPaths,
        },
      },
    },
  };
  const dependencies = [...(context.acceptedWaiting?.dependencies ?? [])];
  if (
    !dependencies.some((dependency) => dependency.id === recoveryDependency.id)
  )
    dependencies.push(recoveryDependency);

  return {
    ...(context.acceptedWaiting ?? {
      state: "waiting" as const,
      summary: context.summary,
    }),
    facts,
    dependencies,
  };
}
