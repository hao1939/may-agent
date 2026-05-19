import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventBus } from "../../src/app/event-bus.js";
import { createEscalationLifecycleSubscriber } from "../../src/lib/escalation-lifecycle.js";
import { DbWriter } from "../../src/lib/db-writer.js";
import { closeDb, getDb } from "../../src/lib/requests.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  }
});

function setup() {
  const persistDir = mkdtempSync(join(tmpdir(), "may-escalation-lifecycle-"));
  roots.push(persistDir);
  const bus = new EventBus();
  const writer = new DbWriter(persistDir);
  const resumed: Array<{ sessionId: string; message: string; source?: string }> = [];
  const sent: Array<{ sessionId: string; message: string }> = [];
  const activeSessions = new Set<string>();
  const manager = {
    hasActiveSession: (sessionId: string) => activeSessions.has(sessionId),
    send: (sessionId: string, message: string) => sent.push({ sessionId, message }),
    resumeSession: (sessionId: string, message: string, opts?: { source?: string }) => {
      resumed.push({ sessionId, message, source: opts?.source });
      return sessionId;
    },
  };

  bus.subscribe(writer.handler, { priority: "first" });
  bus.subscribe(createEscalationLifecycleSubscriber({ bus, manager, persistDir }));
  return { persistDir, bus, resumed, sent, activeSessions };
}

describe("escalation lifecycle", () => {
  it("resumes the source session when an escalation resolves terminally", () => {
    const { persistDir, bus, resumed, sent } = setup();

    bus.emit({
      type: "escalation.created",
      source: "agent:dev",
      owner: "agent:may",
      data: {
        escalationId: "esc_parent",
        sourceAgent: "dev",
        sourceSessionId: "s_source",
        reason: "blocked",
        requestedAction: "decide",
      },
    } as never);
    bus.emit({
      type: "escalation.resolved",
      source: "agent:may",
      owner: "agent:dev",
      data: {
        escalationId: "esc_parent",
        outcome: "answered",
        summary: "Use option B",
        resumeInstruction: "Continue with option B",
        evidence: { decision: "B" },
      },
    } as never);

    expect(sent).toHaveLength(0);
    expect(resumed).toHaveLength(1);
    expect(resumed[0]).toMatchObject({ sessionId: "s_source", source: "escalation-resolution" });
    expect(resumed[0].message).toContain("Escalation esc_parent resolved.");
    expect(resumed[0].message).toContain("Outcome: answered.");
    expect(resumed[0].message).toContain("Instruction: Continue with option B");

    const rows = getDb(persistDir).prepare(
      "SELECT event_type, source, owner, data FROM events WHERE event_type LIKE 'escalation.resume_%' ORDER BY id",
    ).all() as Array<{ event_type: string; source: string; owner: string; data: string }>;
    expect(rows.map((row) => row.event_type)).toEqual([
      "escalation.resume_attempted",
      "escalation.resume_started",
    ]);
    expect(rows[0]).toMatchObject({
      source: "escalation-lifecycle",
      owner: "agent:dev",
    });
    expect(JSON.parse(rows[0].data)).toMatchObject({
      escalationId: "esc_parent",
      outcome: "answered",
      sourceKind: "session",
      sourceRef: "s_source",
      sourceSessionId: "s_source",
    });
    expect(JSON.parse(rows[0].data)).not.toHaveProperty("owner");
  });

  it("sends resolution context to an active source session before cold resume", () => {
    const { bus, resumed, sent, activeSessions } = setup();
    activeSessions.add("s_live");

    bus.emit({
      type: "escalation.created",
      source: "agent:dev",
      owner: "agent:may",
      data: {
        escalationId: "esc_live",
        sourceAgent: "dev",
        sourceSessionId: "s_live",
        reason: "blocked",
        requestedAction: "decide",
      },
    } as never);
    bus.emit({
      type: "escalation.resolved",
      source: "agent:may",
      owner: "agent:dev",
      data: {
        escalationId: "esc_live",
        outcome: "fixed",
        summary: "Fixed upstream",
      },
    } as never);

    expect(resumed).toHaveLength(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].sessionId).toBe("s_live");
    expect(sent[0].message).toContain("Summary: Fixed upstream");
  });

  it("waits on needs_human and resumes the parent source when the human child resolves", () => {
    const { persistDir, bus, resumed } = setup();

    bus.emit({
      type: "escalation.created",
      source: "agent:dev",
      owner: "agent:may",
      data: {
        escalationId: "esc_parent",
        sourceAgent: "dev",
        sourceSessionId: "s_source",
        reason: "blocked",
        requestedAction: "decide",
      },
    } as never);
    bus.emit({
      type: "escalation.created",
      source: "agent:may",
      owner: "human:operator",
      data: {
        escalationId: "esc_child",
        parentEscalationId: "esc_parent",
        sourceAgent: "may",
        reason: "need human approval",
        requestedAction: "approve or reject",
      },
    } as never);
    bus.emit({
      type: "escalation.resolved",
      source: "agent:may",
      owner: "agent:may",
      data: {
        escalationId: "esc_parent",
        outcome: "needs_human",
        summary: "Human approval required",
        childEscalationId: "esc_child",
      },
    } as never);

    expect(resumed).toHaveLength(0);
    expect(getDb(persistDir).prepare(
      "SELECT COUNT(*) AS count FROM events WHERE event_type LIKE 'escalation.resume_%'",
    ).get()).toEqual({ count: 0 });

    bus.emit({
      type: "escalation.resolved",
      source: "human:operator",
      owner: "agent:dev",
      data: {
        escalationId: "esc_child",
        outcome: "answered",
        summary: "Approved",
        resumeInstruction: "Proceed",
      },
    } as never);

    expect(resumed).toHaveLength(1);
    expect(resumed[0]).toMatchObject({ sessionId: "s_source" });

    const started = getDb(persistDir).prepare(
      "SELECT data FROM events WHERE event_type = 'escalation.resume_started'",
    ).get() as { data: string };
    expect(JSON.parse(started.data)).toMatchObject({
      escalationId: "esc_parent",
      resolvedEscalationId: "esc_child",
      parentEscalationId: "esc_parent",
      sourceKind: "session",
      sourceRef: "s_source",
      resumedSessionId: "s_source",
    });
  });
});
