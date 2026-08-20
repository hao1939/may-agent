import { expect, test } from "bun:test";
import { Type, defineApp, type ObservationDisposition } from "./index.js";

type AksClassifierEvent = {
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

function exactAksClassifier(observation: AksClassifierEvent, trace: AksClassifierEvent[]): ObservationDisposition {
  return {
    intentional: observation.type === "pipeline-artifact.unavailable" && trace.length === 2,
    stage: "intentional",
    reason: "exact classifier remains App-owned",
    evidenceEventIds: [observation.id!, ...trace.map((event) => event.id!)],
  };
}

test("App contract accepts the AKS exact-classifier function shape", () => {
  const app = defineApp({
    id: "alpha-project",
    version: 1,
    owner: "app-ops",
    inputSchema: Type.Object({ kind: Type.String(), data: Type.Unknown() }),
    observationProjections: [
      {
        id: "terminal-artifact-unavailable",
        event: { type: "pipeline-artifact.unavailable", source: "aks-pipeline-watcher", project: "alpha-project" },
        evidence: [
          { type: "pipeline.failure.observed", source: "aks-pipeline-watcher", project: "alpha-project" },
          { type: "project.task.reconciled", source: "app-task:alpha-project:task-reconciler", project: "alpha-project" },
        ],
        classify: exactAksClassifier,
      },
    ],
  });
  expect(app.observationProjections?.[0]?.classify).toBe(exactAksClassifier);
});
