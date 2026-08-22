import { describe, expect, test } from "bun:test";
import {
  classifyPipelineArtifactUnavailable,
  type ArtifactDispositionEvent,
} from "./pipeline-artifact-unavailable-disposition.js";

function observation(id: number, runId: string): ArtifactDispositionEvent {
  return {
    id,
    type: "pipeline-artifact.unavailable",
    source: "aks-pipeline-watcher",
    owner: "app:aks-rp-e2e",
    project: "aks-rp-e2e",
    deliveryStatus: "unhandled",
    data: { project: "aks-rp-e2e", pipelineRunId: runId, runId },
  };
}

function failure(
  id: number,
  runId: string,
  sliceId = "artifact-materialization",
): ArtifactDispositionEvent {
  const taskId = `ops/master-validation-evidence-carrier/${runId}-${sliceId}`;
  return {
    id,
    type: "pipeline.failure.observed",
    source: "aks-pipeline-watcher",
    owner: "app:aks-rp-e2e",
    project: "aks-rp-e2e",
    deliveryStatus: "accepted",
    acceptedBy: `app-runtime:events:task:aks-rp-e2e/${taskId}`,
    data: {
      project: "aks-rp-e2e",
      pipelineRunId: runId,
      sliceId,
      category: "terminal_artifact_unavailable",
    },
  };
}

function terminal(
  id: number,
  runId: string,
  summary = "Repository pipeline defect with no product verdict.",
): ArtifactDispositionEvent {
  return {
    id,
    type: "project.task.reconciled",
    source: "app-task:aks-rp-e2e:task-reconciler",
    owner: "agent:app-ops",
    project: "aks-rp-e2e",
    taskId: `ops/master-validation-evidence-carrier/${runId}-artifact-materialization`,
    data: {
      project: "aks-rp-e2e",
      taskId: `ops/master-validation-evidence-carrier/${runId}-artifact-materialization`,
      disposition: "converged",
      summary,
    },
  };
}

function verdict(
  observed: ArtifactDispositionEvent,
  trace: ArtifactDispositionEvent[],
): boolean {
  return classifyPipelineArtifactUnavailable(observed, trace).intentional;
}

describe("pipeline-artifact.unavailable intentional disposition", () => {
  test.each([
    [5789637, 5789638, 5791905, "177338419", "nor an AKS product verdict"],
    [5789639, 5789640, 5790370, "177338480", "no product verdict"],
  ])(
    "connects historical observation %i through failure %i to terminal result %i",
    (observationId, failureId, terminalId, runId, boundary) => {
      const observed = observation(observationId, runId);
      const failed = failure(failureId, runId);
      const result = terminal(
        terminalId,
        runId,
        `Run failed before any selected spec executed; this is ${boundary}.`,
      );

      expect(classifyPipelineArtifactUnavailable(observed, [failed])).toEqual({
        intentional: false,
        stage: "carrier",
        reason: "exact evidence carrier has no unique converged domain result",
        evidenceEventIds: [observationId, failureId],
      });
      expect(
        classifyPipelineArtifactUnavailable(observed, [failed, result]),
      ).toEqual({
        intentional: true,
        stage: "intentional",
        reason:
          "exact failure admission and terminal no-product-verdict carrier result are present",
        evidenceEventIds: [observationId, failureId, terminalId],
      });
    },
  );

  test("keeps every required negative control visible", () => {
    const observed = observation(1, "run-1");
    const failed = failure(2, "run-1");
    const result = terminal(3, "run-1");
    const unrelatedResult = terminal(4, "other-run");

    const controls: Array<
      [string, ArtifactDispositionEvent, ArtifactDispositionEvent[]]
    > = [
      ["malformed packet", { ...observed, data: {} }, [failed, result]],
      ["unknown producer", { ...observed, source: "other" }, [failed, result]],
      ["unknown project", { ...observed, project: "other" }, [failed, result]],
      ["absent failure", observed, [result]],
      ["mismatched failure", observed, [failure(2, "run-2"), result]],
      [
        "wrong failure category",
        observed,
        [
          { ...failed, data: { ...failed.data, category: "pipeline_failure" } },
          result,
        ],
      ],
      [
        "failed admission",
        observed,
        [
          { ...failed, deliveryStatus: "unhandled", acceptedBy: undefined },
          result,
        ],
      ],
      [
        "delivery acceptance alone",
        observed,
        [{ ...failed, acceptedBy: "some-consumer" }, result],
      ],
      [
        "wrong evidence carrier",
        observed,
        [{ ...failed, acceptedBy: `${failed.acceptedBy}-wrong` }, result],
      ],
      [
        "nonterminal carrier",
        observed,
        [
          { ...result, data: { ...result.data, disposition: "waiting" } },
          failed,
        ],
      ],
      ["terminal artifact without domain handling", observed, [failed]],
      ["unrelated terminal result", observed, [failed, unrelatedResult]],
      [
        "terminal result without no-product boundary",
        observed,
        [failed, terminal(3, "run-1", "Repository pipeline defect.")],
      ],
      [
        "unrelated event type",
        { ...observed, type: "pipeline-artifact.available" },
        [failed, result],
      ],
    ];

    expect(
      controls.map(([name, event, trace]) => [name, verdict(event, trace)]),
    ).toEqual(controls.map(([name]) => [name, false]));
  });

  test("rejects event proximity, owner labels, and run ID alone", () => {
    const observed = observation(10, "same-run");
    const nearButUnrelated: ArtifactDispositionEvent[] = [
      {
        ...failure(11, "same-run"),
        type: "pipeline.completed",
        owner: "app:aks-rp-e2e",
      },
      {
        ...terminal(12, "other-run"),
        owner: "agent:app-ops",
      },
    ];

    expect(verdict(observed, nearButUnrelated)).toBeFalse();
  });
});
