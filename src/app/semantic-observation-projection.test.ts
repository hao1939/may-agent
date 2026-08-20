import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppObservationProjection, ObservationEvent } from "@may-agent/sdk";
import { applyDbSchema } from "../lib/db/schema.js";
import { getDb, closeDb } from "../lib/requests.js";
import { createQueryService } from "../lib/query-service.js";
import { projectSemanticObservations } from "../lib/semantic-observation-projection.js";
import { attachEventPersistence } from "./daemon-events.js";
import { EventBus, EVENT_ROW_ID } from "./event-bus.js";
import { measureSourceMetrics, UNHANDLED_SIGNAL_METRIC_ID } from "./metric-source-measurement.js";

const run = (event: ObservationEvent) => String(event.data?.pipelineRunId ?? event.data?.runId ?? "");
const project = (event: ObservationEvent) => String(event.project ?? event.data?.project ?? "");
const task = (event: ObservationEvent) => String(event.taskId ?? event.data?.taskId ?? event.data?.task_id ?? "");

const projection: AppObservationProjection = {
  id: "pipeline-artifact-unavailable-terminal-disposition",
  event: { type: "pipeline-artifact.unavailable", source: "aks-pipeline-watcher", project: "alpha-project" },
  evidence: [
    { type: "pipeline.failure.observed", source: "aks-pipeline-watcher", project: "alpha-project" },
    { type: "project.task.reconciled", source: "app-task:alpha-project:task-reconciler", project: "alpha-project" },
  ],
  classify(observation, evidence) {
    const runId = run(observation);
    if (!runId || project(observation) !== "alpha-project")
      return { intentional: false, evidenceEventIds: [observation.id!] };
    const failures = evidence.filter(
      (event) =>
        event.type === "pipeline.failure.observed" &&
        run(event) === runId &&
        event.data?.category === "terminal_artifact_unavailable",
    );
    if (failures.length !== 1) return { intentional: false, evidenceEventIds: [observation.id!] };
    const failure = failures[0]!;
    const carrier = `ops/master-validation-evidence-carrier/${runId}-${String(failure.data?.sliceId ?? "")}`;
    if (
      failure.deliveryStatus !== "accepted" ||
      failure.acceptedBy !== `app-runtime:events:task:alpha-project/${carrier}`
    ) {
      return { intentional: false, evidenceEventIds: [observation.id!, failure.id!] };
    }
    const terminals = evidence.filter(
      (event) =>
        event.type === "project.task.reconciled" && task(event) === carrier && event.data?.disposition === "converged",
    );
    if (
      terminals.length !== 1 ||
      !String(terminals[0]!.data?.summary ?? "")
        .toLowerCase()
        .includes("no product verdict")
    ) {
      return { intentional: false, evidenceEventIds: [observation.id!, failure.id!] };
    }
    return { intentional: true, evidenceEventIds: [observation.id!, failure.id!, terminals[0]!.id!] };
  },
};

describe("correlation-gated semantic observation projection", () => {
  it("shares one immutable effective disposition between delivery health and the unhandled metric", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-observation-projection-"));
    try {
      const db = getDb(root);
      applyDbSchema(db);
      const bus = new EventBus();
      attachEventPersistence({ bus, persistDir: root });
      const base = Date.now();
      const emit = (type: string, source: string, data: Record<string, unknown>, timestamp: number) =>
        bus.emit({ type, source, owner: "app:alpha-project", data, timestamp } as any)[EVENT_ROW_ID]!;
      const observation = emit(
        "pipeline-artifact.unavailable",
        "aks-pipeline-watcher",
        { project: "alpha-project", pipelineRunId: "good" },
        base,
      );
      const malformed = emit(
        "pipeline-artifact.unavailable",
        "aks-pipeline-watcher",
        { project: "alpha-project" },
        base + 1,
      );
      const mismatched = emit(
        "pipeline-artifact.unavailable",
        "aks-pipeline-watcher",
        { project: "alpha-project", pipelineRunId: "missing" },
        base + 2,
      );
      const duplicate = emit(
        "pipeline-artifact.unavailable",
        "aks-pipeline-watcher",
        { project: "alpha-project", pipelineRunId: "dup" },
        base + 3,
      );
      const unrelated = emit("other.unhandled", "other", { project: "alpha-project" }, base + 4);
      const failure = (runId: string, offset: number) => {
        const carrier = `ops/master-validation-evidence-carrier/${runId}-artifact-materialization`;
        const id = emit(
          "pipeline.failure.observed",
          "aks-pipeline-watcher",
          {
            project: "alpha-project",
            pipelineRunId: runId,
            sliceId: "artifact-materialization",
            category: "terminal_artifact_unavailable",
          },
          base + offset,
        );
        db.run("UPDATE events SET delivery_status='accepted', accepted_by=? WHERE id=?", [
          `app-runtime:events:task:alpha-project/${carrier}`,
          id,
        ]);
        return id;
      };
      failure("good", 10);
      failure("dup", 11);
      failure("dup", 12);
      expect([
        ...projectSemanticObservations({ db, projections: [projection], since: base - 100, now: base + 19 }),
      ]).toEqual([]);
      emit(
        "pipeline.failure.observed",
        "aks-pipeline-watcher",
        {
          project: "alpha-project",
          pipelineRunId: "other",
          sliceId: "artifact-materialization",
          category: "terminal_artifact_unavailable",
        },
        base + 13,
      );
      const carrier = "ops/master-validation-evidence-carrier/good-artifact-materialization";
      emit(
        "project.task.reconciled",
        "app-task:alpha-project:task-reconciler",
        {
          project: "alpha-project",
          taskId: carrier,
          disposition: "converged",
          summary: "Repository pipeline defect with no product verdict.",
        },
        base + 20,
      );
      db.run("UPDATE events SET delivery_status='unhandled' WHERE id IN (?, ?, ?, ?, ?)", [
        observation,
        malformed,
        mismatched,
        duplicate,
        unrelated,
      ]);
      const before = db.prepare("SELECT id, delivery_status, accepted_by FROM events ORDER BY id").all();

      expect([
        ...projectSemanticObservations({ db, projections: [projection], since: base - 100, now: base + 60_000 }),
      ]).toEqual([observation]);
      const query = createQueryService({ getDb: () => db, observationProjections: () => [projection] });
      const health = query.eventDeliveryHealth({ now: base + 60_000, lookbackMs: 120_000, limit: 20 });
      expect(health.unhandledEvents.map((event) => event.id)).toEqual([unrelated, duplicate, mismatched, malformed]);

      db.run(
        `INSERT INTO metrics (id,name,type,owner,current,threshold,priority,status,source_query,updated_at,alert_op)
        VALUES (?,?,'gauge','may',99,5,'P1','active',?,?,'>')`,
        [
          UNHANDLED_SIGNAL_METRIC_ID,
          "Unhandled",
          "SELECT count(*) AS value FROM events WHERE delivery_status='unhandled'",
          base,
        ],
      );
      await measureSourceMetrics({
        bus,
        persistDir: root,
        measuredAt: base + 60_000,
        observationProjections: [projection],
      });
      expect(db.prepare("SELECT current FROM metrics WHERE id=?").get(UNHANDLED_SIGNAL_METRIC_ID)).toEqual({
        current: 4,
      });
      expect(db.prepare("SELECT id, delivery_status, accepted_by FROM events ORDER BY id").all()).toEqual(before);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps malformed, unmatched, ambiguous, and nonterminal chains visible", () => {
    const root = mkdtempSync(join(tmpdir(), "may-observation-negative-"));
    try {
      const db = getDb(root);
      applyDbSchema(db);
      const bus = new EventBus();
      attachEventPersistence({ bus, persistDir: root });
      const base = Date.now();
      let offset = 0;
      const emit = (type: string, source: string, data: Record<string, unknown>) =>
        bus.emit({ type, source, owner: "app:alpha-project", data, timestamp: base + offset++ } as any)[EVENT_ROW_ID]!;
      const candidates = new Map<string, number>();
      const candidate = (runId: string, source = "aks-pipeline-watcher", projectId = "alpha-project") => {
        const id = emit("pipeline-artifact.unavailable", source, { project: projectId, pipelineRunId: runId });
        candidates.set(runId, id);
        return id;
      };
      const failure = (runId: string, status = "accepted", acceptedBy?: string) => {
        const id = emit("pipeline.failure.observed", "aks-pipeline-watcher", {
          project: "alpha-project",
          pipelineRunId: runId,
          sliceId: "artifact-materialization",
          category: "terminal_artifact_unavailable",
        });
        const carrier = `ops/master-validation-evidence-carrier/${runId}-artifact-materialization`;
        db.run("UPDATE events SET delivery_status=?, accepted_by=? WHERE id=?", [
          status,
          acceptedBy ?? `app-runtime:events:task:alpha-project/${carrier}`,
          id,
        ]);
        return id;
      };
      const terminal = (runId: string, disposition = "converged", summary = "No product verdict.", taskId?: string) =>
        emit("project.task.reconciled", "app-task:alpha-project:task-reconciler", {
          project: "alpha-project",
          taskId: taskId ?? `ops/master-validation-evidence-carrier/${runId}-artifact-materialization`,
          disposition,
          summary,
        });

      for (const runId of [
        "good", "absent", "mismatch", "failed", "pending", "wrong-delivery", "waiting", "attention",
        "nonterminal", "domain-unhandled", "unrelated-task", "duplicate-failure", "duplicate-terminal",
      ]) candidate(runId);
      const malformed = candidate("malformed");
      db.run("UPDATE events SET data='{' WHERE id=?", [malformed]);
      candidate("unknown-source", "unknown-watcher");
      candidate("unknown-project", "aks-pipeline-watcher", "unknown-project");
      const unrelatedType = emit("other.unhandled", "aks-pipeline-watcher", {
        project: "alpha-project",
        pipelineRunId: "unrelated-type",
      });

      failure("good");
      terminal("good");
      failure("different-run");
      terminal("mismatch");
      failure("failed", "failed");
      terminal("failed");
      failure("pending", "pending");
      terminal("pending");
      failure("wrong-delivery", "accepted", "app-runtime:events:task:alpha-project/wrong-carrier");
      terminal("wrong-delivery");
      failure("waiting");
      terminal("waiting", "waiting");
      failure("attention");
      terminal("attention", "attention");
      failure("nonterminal");
      terminal("nonterminal", "running");
      failure("domain-unhandled");
      terminal("domain-unhandled", "converged", "Terminal artifact unavailable; product handling pending.");
      failure("unrelated-task");
      terminal("unrelated-task", "converged", "No product verdict.", "ops/unrelated-task");
      failure("duplicate-failure");
      failure("duplicate-failure");
      terminal("duplicate-failure");
      failure("duplicate-terminal");
      terminal("duplicate-terminal");
      terminal("duplicate-terminal");

      db.run(
        `UPDATE events SET delivery_status='unhandled' WHERE id IN (${[...candidates.values(), unrelatedType]
          .map(() => "?")
          .join(",")})`,
        [...candidates.values(), unrelatedType],
      );
      const projected = projectSemanticObservations({
        db,
        projections: [projection],
        since: base - 1,
        now: base + 10_000,
      });
      expect([...projected]).toEqual([candidates.get("good")]);
      const query = createQueryService({ getDb: () => db, observationProjections: () => [projection] });
      const visible = new Set(
        query.eventDeliveryHealth({ now: base + 10_000, lookbackMs: 20_000, limit: 100 }).unhandledEvents.map((event) =>
          event.id,
        ),
      );
      for (const id of [...candidates.values(), unrelatedType]) {
        expect(visible.has(id)).toBe(id !== candidates.get("good"));
      }
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
