export type ArtifactDispositionEvent = {
  id?: number;
  type: string;
  source?: string;
  owner?: string;
  project?: string;
  taskId?: string;
  deliveryStatus?: string;
  acceptedBy?: string;
  data?: Record<string, unknown>;
};

export type ArtifactUnavailableDisposition = {
  intentional: boolean;
  stage:
    | "observation"
    | "failure"
    | "admission"
    | "carrier"
    | "terminal-domain-result"
    | "intentional";
  reason: string;
  evidenceEventIds: number[];
};

const projectId = "aks-rp-e2e";
const watcherSource = "aks-pipeline-watcher";
const taskSource = "app-task:aks-rp-e2e:task-reconciler";

function value(event: ArtifactDispositionEvent, key: string): string {
  const candidate = event.data?.[key];
  return typeof candidate === "string" ? candidate.trim() : "";
}

function eventProject(event: ArtifactDispositionEvent): string {
  return event.project?.trim() || value(event, "project");
}

function eventTaskId(event: ArtifactDispositionEvent): string {
  return (
    event.taskId?.trim() || value(event, "taskId") || value(event, "task_id")
  );
}

function eventIds(events: ArtifactDispositionEvent[]): number[] {
  return events.flatMap((event) =>
    typeof event.id === "number" ? [event.id] : [],
  );
}

function expectedCarrierTaskId(failure: ArtifactDispositionEvent): string {
  const runId = value(failure, "pipelineRunId") || value(failure, "runId");
  const sliceId = value(failure, "sliceId");
  return runId && sliceId
    ? `ops/master-validation-evidence-carrier/${runId}-${sliceId}`
    : "";
}

function hasExplicitNoProductVerdict(event: ArtifactDispositionEvent): boolean {
  const summary = value(event, "summary").toLowerCase();
  return (
    summary.includes("no product verdict") ||
    summary.includes("not an aks product verdict") ||
    summary.includes("nor an aks product verdict") ||
    (summary.includes("neither cancellation") &&
      summary.includes("aks product verdict"))
  );
}

/**
 * Classify one immutable pipeline-artifact.unavailable observation from a
 * complete trace. This deliberately cannot be used as a single-event App
 * observation selector: intent becomes true only after the exact carrier's
 * converged domain result exists.
 */
export function classifyPipelineArtifactUnavailable(
  observation: ArtifactDispositionEvent,
  trace: ArtifactDispositionEvent[],
): ArtifactUnavailableDisposition {
  const observedRunId =
    value(observation, "pipelineRunId") || value(observation, "runId");
  if (
    observation.type !== "pipeline-artifact.unavailable" ||
    observation.source !== watcherSource ||
    eventProject(observation) !== projectId ||
    !observedRunId
  ) {
    return {
      intentional: false,
      stage: "observation",
      reason:
        "malformed, unknown-source, unknown-project, or unrelated observation",
      evidenceEventIds: eventIds([observation]),
    };
  }

  const failures = trace.filter(
    (event) =>
      event.type === "pipeline.failure.observed" &&
      event.source === watcherSource &&
      eventProject(event) === projectId &&
      (value(event, "pipelineRunId") || value(event, "runId")) ===
        observedRunId &&
      value(event, "category") === "terminal_artifact_unavailable",
  );
  if (failures.length !== 1) {
    return {
      intentional: false,
      stage: "failure",
      reason:
        "exactly one same-run terminal_artifact_unavailable failure fact is required",
      evidenceEventIds: eventIds([observation, ...failures]),
    };
  }

  const failure = failures[0];
  const carrierTaskId = expectedCarrierTaskId(failure);
  const expectedAdmission = carrierTaskId
    ? `app-runtime:events:task:${projectId}/${carrierTaskId}`
    : "";
  if (
    failure.deliveryStatus !== "accepted" ||
    !expectedAdmission ||
    failure.acceptedBy !== expectedAdmission
  ) {
    return {
      intentional: false,
      stage: "admission",
      reason:
        "failure fact was not successfully admitted to its exact evidence carrier",
      evidenceEventIds: eventIds([observation, failure]),
    };
  }

  const terminalResults = trace.filter(
    (event) =>
      event.type === "project.task.reconciled" &&
      event.source === taskSource &&
      eventProject(event) === projectId &&
      eventTaskId(event) === carrierTaskId &&
      value(event, "disposition") === "converged",
  );
  if (terminalResults.length !== 1) {
    return {
      intentional: false,
      stage: "carrier",
      reason: "exact evidence carrier has no unique converged domain result",
      evidenceEventIds: eventIds([observation, failure, ...terminalResults]),
    };
  }

  const terminalResult = terminalResults[0];
  if (!hasExplicitNoProductVerdict(terminalResult)) {
    return {
      intentional: false,
      stage: "terminal-domain-result",
      reason:
        "terminal carrier result does not explicitly preserve the no-product-verdict boundary",
      evidenceEventIds: eventIds([observation, failure, terminalResult]),
    };
  }

  return {
    intentional: true,
    stage: "intentional",
    reason:
      "exact failure admission and terminal no-product-verdict carrier result are present",
    evidenceEventIds: eventIds([observation, failure, terminalResult]),
  };
}
