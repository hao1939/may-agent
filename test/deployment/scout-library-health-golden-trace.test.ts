import { fakeTaskAttacher } from "../fixtures/task-attachment.js";
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { APP_ROOT } from "./installation.js";
import type { AppDefinition, AppDependencyObservation, AppEvent } from "@may-agent/sdk";
import { matchesEventSelector } from "@may-agent/sdk";
import { openDatabase } from "../../src/lib/db.js";
import { applyDbSchema } from "../../src/lib/db/schema.js";
import { AppInboxHost } from "../../src/app/app-inbox-host.js";

const { default: scoutApp } = await import(pathToFileURL(resolve(APP_ROOT, "projects/scout-knowledge-lib.app/app.ts")).href);

type GoldenControl = {
  id: string;
  traceId: string;
  event: AppEvent<Record<string, unknown>>;
  expected: { routeCount: number; terminal: "done" | "pending" | "waiting"; visible: true };
};

type GoldenTrace = {
  schemaVersion: number;
  contract: string;
  activationEvidence: {
    reuseOnly: boolean;
    livePositiveEventId: number;
    loadedSdkIdentity: string;
  };
  controls: GoldenControl[];
};

const artifactPath = resolve(import.meta.dir, "../fixtures/scout-library-health-golden-trace.v1.json");
const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as GoldenTrace;

function eventRow(
  db: ReturnType<typeof openDatabase>,
  control: GoldenControl,
): { id: number; delivery_status: string; accepted_by: string | null } {
  const inserted = db
    .prepare(
      `INSERT INTO events (event_type, source, owner, data, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      control.event.type,
      control.event.source ?? null,
      control.event.owner ?? null,
      JSON.stringify(control.event.data),
      Date.now(),
    );
  return db
    .prepare("SELECT id, delivery_status, accepted_by FROM events WHERE id = ?")
    .get(Number(inserted.lastInsertRowid)) as {
    id: number;
    delivery_status: string;
    accepted_by: string | null;
  };
}

function routedVisibility(
  db: ReturnType<typeof openDatabase>,
  originEventId: number,
  request: ReturnType<AppInboxHost["get"]>,
): boolean {
  const origin = db.prepare("SELECT delivery_status, accepted_by FROM events WHERE id = ?").get(originEventId) as {
    delivery_status: string;
    accepted_by: string | null;
  };
  expect(origin).toEqual({ delivery_status: "pending", accepted_by: null });
  expect(request).toMatchObject({ originEventId });
  return (
    origin.delivery_status === "pending" && origin.accepted_by === null && request?.originEventId === originEventId
  );
}

async function runControl(control: GoldenControl): Promise<{
  routeCount: number;
  terminal: "done" | "pending" | "waiting";
  visible: boolean;
  intentionallyObserved: boolean;
}> {
  const db = openDatabase(":memory:");
  applyDbSchema(db);
  try {
    const absentConsumer = control.id === "absent-consumer";
    const definitions = absentConsumer ? [] : [scoutApp as AppDefinition];
    const dependencies = new Map<string, AppDependencyObservation>();
    const host = new AppInboxHost({
      db,
      apps: definitions,
      workerId: `golden:${control.id}`,
      retryAfterMs: 0,
      attachTask: fakeTaskAttacher(db, async ({ attachment }) => {
        if (control.id === "failed-wake") throw new Error("golden failed wake");
        const taskId = attachment.kind === "existing" ? attachment.taskId : attachment.intent.id;
        return { taskId };
      }),
      readDependency: async ({ dependency }) => dependencies.get(dependency.id) ?? null,
    });
    const persisted = eventRow(db, control);
    const routes = host.subscriptionInputs(control.event);
    const intentionallyObserved = definitions.some((definition) =>
      definition.observations?.some((selector) => matchesEventSelector(selector, control.event)),
    );

    if (routes.length === 0) {
      const visible = db.prepare("SELECT delivery_status, accepted_by FROM events WHERE id = ?").get(persisted.id) as {
        delivery_status: string;
        accepted_by: string | null;
      };
      expect(visible).toEqual({ delivery_status: "pending", accepted_by: null });
      return { routeCount: 0, terminal: "pending", visible: true, intentionallyObserved };
    }

    expect(routes).toHaveLength(1);
    const requestId = `golden-${control.id}`;
    host.admit({
      id: requestId,
      appId: routes[0].appId,
      source: { kind: "system", id: control.traceId },
      input: routes[0].input,
      originEventId: persisted.id,
    });
    const first = await host.reconcileOnce(routes[0].appId);

    if (control.id === "failed-wake") {
      expect(first.errors).toEqual([expect.stringContaining("golden failed wake")]);
      const retryable = host.get(requestId);
      expect(retryable).toMatchObject({ status: "pending", waitingOn: undefined });
      const visible = routedVisibility(db, persisted.id, retryable);
      return { routeCount: 1, terminal: "pending", visible, intentionallyObserved };
    }

    const waiting = host.get(requestId);
    expect(waiting).toMatchObject({ status: "handling", waitingOn: { kind: "task" } });
    if (control.id === "nonterminal-domain-result") {
      const visible = routedVisibility(db, persisted.id, waiting);
      return { routeCount: 1, terminal: "waiting", visible, intentionallyObserved };
    }

    expect(control.id).toBe("actionable-positive");
    const taskId = waiting?.waitingOn?.id;
    expect(taskId).toBeTruthy();
    dependencies.set(taskId!, {
      kind: "task",
      id: taskId!,
      status: "done",
      summary: "Golden Scout owner review completed",
      evidence: [control.traceId],
    });
    expect(host.wake({ kind: "task", id: taskId! })).toBe(1);
    const terminal = await host.reconcileOnce(routes[0].appId);
    expect(terminal.errors).toEqual([]);
    expect(host.get(requestId)).toMatchObject({
      status: "done",
      result: { summary: "Golden Scout owner review completed" },
    });
    return { routeCount: 1, terminal: "done", visible: true, intentionallyObserved };
  } finally {
    db.close();
  }
}

describe("persisted Scout library-health full golden trace", () => {
  it("pins the already-activated contract and the complete positive/negative matrix", async () => {
    expect(artifact).toMatchObject({
      schemaVersion: 1,
      contract: "scout.project.library_health.observed",
      activationEvidence: {
        reuseOnly: true,
        livePositiveEventId: 5800284,
        loadedSdkIdentity: "32bc02fa80326469a27c43cfe48d197d73305676",
      },
    });
    expect(artifact.controls.map(({ id }) => id)).toEqual([
      "actionable-positive",
      "malformed-payload",
      "unknown-source",
      "unknown-project",
      "absent-consumer",
      "failed-wake",
      "nonterminal-domain-result",
      "unrelated-signal",
    ]);
    expect(new Set(artifact.controls.map(({ traceId }) => traceId)).size).toBe(artifact.controls.length);

    for (const control of artifact.controls) {
      const observed = await runControl(control);
      expect(observed, control.traceId).toMatchObject(control.expected);
      expect(observed.intentionallyObserved, control.traceId).toBeFalse();
    }
  });
});
