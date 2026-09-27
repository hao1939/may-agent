import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildMaintenanceAPI } from "./maintenance-api-impl.js";
import type { MaintenanceAPIDeps } from "./maintenance-api-impl.js";
import { EventBus } from "../app/core/events/bus.js";
import { DbWriter } from "./db-writer.js";
import { closeDb, getDb } from "./db/connection.js";

type EmittedEvent = { type: string; [key: string]: unknown };

function makeSdk() {
  const root = mkdtempSync(join(tmpdir(), "may-sdk-events-"));
  const events: EmittedEvent[] = [];
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  bus.subscribe((event) => events.push(event as EmittedEvent));
  const deps: MaintenanceAPIDeps = {
    bus,
    persistDir: root,
    projectRoot: root,
    agentsRoot: join(root, "agents"),
    sharedRoot: join(root, "shared"),
    projectsRoot: join(root, "projects"),
    agentName: "dev",
  };
  return { sdk: buildMaintenanceAPI(deps), events, root };
}

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  }
});

describe("Host SDK events", () => {
  it("defaults sdk.emit owner to the emitting agent", () => {
    const { sdk, events, root } = makeSdk();
    roots.push(root);

    sdk.emit("handler.skipped", {
      handler: "dev-handler",
      reason: "missing payload",
    });

    expect(events).toContainEqual({
      type: "handler.skipped",
      source: "agent:dev",
      owner: "agent:dev",
      data: {
        handler: "dev-handler",
        reason: "missing payload",
      },
    });
  });

  it("lets sdk.emit override owner explicitly", () => {
    const { sdk, events, root } = makeSdk();
    roots.push(root);

    sdk.emit(
      "metric.breach",
      { metricId: "system.health", message: "check" },
      { owner: "human:operator", urgency: "high" },
    );

    expect(events).toContainEqual({
      type: "metric.breach",
      source: "agent:dev",
      owner: "human:operator",
      urgency: "high",
      data: { metricId: "system.health", message: "check" },
    });
  });

  it("preserves the complete envelope and stores its linked trace evidence", () => {
    const { sdk, events, root } = makeSdk();
    roots.push(root);
    sdk.emit("fixture.parent", { summary: "Observed work" });
    const db = getDb(root);
    const parent = db.prepare("SELECT id FROM events WHERE event_type = 'fixture.parent'").get() as { id: number };
    const trace = { traceId: "maintenance-review", parentEventId: parent.id,
      links: [{ eventId: parent.id, type: "reference" as const, label: "supporting observation" }] };
    const envelope = {
      source: "fixture:review", owner: "app:sample", target: { appId: "sample", taskId: "task" },
      action: "review", urgency: "high" as const, visibility: "detail" as const, ttl_ms: 30_000, trace,
    };
    sdk.emit("fixture.observed", { summary: "Ready for review" }, envelope);
    expect(events).toContainEqual({ type: "fixture.observed", ...envelope, data: { summary: "Ready for review" } });
    const row = db.prepare("SELECT id, owner FROM events WHERE event_type = 'fixture.observed'").get() as {
      id: number; owner: string;
    };
    expect(row.owner).toBe("app:sample");
    expect(db.prepare("SELECT trace_id, parent_event_id, visibility FROM event_traces WHERE event_id = ?").get(row.id))
      .toEqual({ trace_id: trace.traceId, parent_event_id: parent.id, visibility: "detail" });
    expect(db.prepare("SELECT to_event_id, type, label FROM event_trace_links WHERE from_event_id = ? AND type = 'reference'").all(row.id))
      .toContainEqual({ to_event_id: parent.id, type: "reference", label: "supporting observation" });
  });

  it("uses only human as the message shorthand for human:operator", () => {
    const { sdk, events, root } = makeSdk();
    roots.push(root);

    sdk.message("human", "Need approval");
    sdk.message("operator", "Operator agent should receive this");

    const messages = events.filter((event) => event.type === "message.created");
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      owner: "human:operator",
      data: expect.objectContaining({ to: "human" }),
    });
    expect(messages[1]).toMatchObject({
      owner: "agent:operator",
      data: expect.objectContaining({ to: "operator" }),
    });
  });
});
