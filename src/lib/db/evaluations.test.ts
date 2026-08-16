import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventBus } from "../../app/event-bus.js";
import { DbWriter } from "../db-writer.js";
import { getDb } from "./connection.js";

function setup() {
  const root = mkdtempSync(join(tmpdir(), "evaluation-projection-"));
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  return { root, bus };
}

describe("evaluation event projection", () => {
  test("projects one durable evaluation fact into the legacy-compatible read model", () => {
    const { root, bus } = setup();
    bus.emit({
      type: "evaluation.recorded",
      source: "workflow:evaluator-aftermath",
      owner: "agent:evaluator",
      data: {
        source: "evaluator-aftermath",
        idempotencyKey: "evaluation:s_projection:v1",
        evaluation: {
          sessionId: "s_projection",
          agent: "coder",
          quality: 0.75,
          efficiency: 0.6,
          productiveCalls: 6,
          wastedCalls: 2,
          verdict: "acceptable",
          issues: ["missing final verification"],
          lane: "needs_triage",
          reason: "verification gap",
          signals: ["file write"],
          createdAt: 1_700_000_000_000,
        },
      },
      target: {
        appId: "evaluation",
        project: "evaluation",
        sessionId: "s_projection",
      },
    } as any);

    const db = getDb(root);
    const row = db.prepare("SELECT * FROM evaluations WHERE sessionId = ?").get("s_projection") as Record<
      string,
      unknown
    >;
    expect(row).toMatchObject({
      sessionId: "s_projection",
      agent: "coder",
      quality: 0.75,
      efficiency: 0.6,
      productiveCalls: 6,
      wastedCalls: 2,
      verdict: "acceptable",
      evaluatedByHeuristic: 1,
      skippedByJs: 0,
      createdAt: 1_700_000_000_000,
    });
    expect(JSON.parse(String(row.issues))).toEqual(["missing final verification"]);
    expect(JSON.parse(String(row.overall))).toMatchObject({
      source: "evaluator-aftermath",
      lane: "needs_triage",
      routeReason: "verification gap",
      outputSignals: ["file write"],
    });
    expect(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'evaluation.recorded'").get()).toEqual({
      count: 1,
    });

    bus.emit({
      type: "evaluation.recorded",
      source: "workflow:evaluator-aftermath",
      owner: "agent:evaluator",
      data: {
        source: "evaluator-aftermath",
        idempotencyKey: "evaluation:s_projection:v1",
        evaluation: {
          sessionId: "s_projection",
          agent: "coder",
          quality: 0.75,
          efficiency: 0.6,
          productiveCalls: 6,
          wastedCalls: 2,
          verdict: "acceptable",
          issues: ["missing final verification"],
          lane: "needs_triage",
          reason: "verification gap",
          signals: ["file write"],
          createdAt: 1_700_000_000_000,
        },
      },
      target: {
        appId: "evaluation",
        project: "evaluation",
        sessionId: "s_projection",
      },
    } as any);
    expect(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'evaluation.recorded'").get()).toEqual({
      count: 1,
    });
  });

  test("rejects malformed facts before they can masquerade as evaluations", () => {
    const { root, bus } = setup();
    expect(() =>
      bus.emit({
        type: "evaluation.recorded",
        source: "test",
        owner: "agent:evaluator",
        data: { evaluation: { sessionId: "s_invalid" } },
      } as any),
    ).toThrow("evaluation.recorded requires a valid sessionId");

    const db = getDb(root);
    expect(db.prepare("SELECT COUNT(*) AS count FROM evaluations").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'evaluation.recorded'").get()).toEqual({
      count: 0,
    });
  });

  test("rejects scores and counts outside the canonical evaluation contract", () => {
    const { root, bus } = setup();
    for (const evaluation of [
      {
        sessionId: "s_bad_quality",
        agent: "coder",
        quality: 1.1,
        efficiency: 0.5,
        verdict: "good",
        issues: [],
      },
      {
        sessionId: "s_bad_count",
        agent: "coder",
        quality: 0.8,
        efficiency: 0.5,
        productiveCalls: 1.5,
        verdict: "good",
        issues: [],
      },
    ]) {
      expect(() =>
        bus.emit({
          type: "evaluation.recorded",
          source: "test",
          owner: "agent:evaluator",
          data: { evaluation },
        } as any),
      ).toThrow("evaluation.recorded requires a valid sessionId");
    }
    expect(getDb(root).prepare("SELECT COUNT(*) AS count FROM evaluations").get()).toEqual({ count: 0 });
  });

  test("rolls back the durable event when its read-model projection cannot commit", () => {
    const { root, bus } = setup();
    const db = getDb(root);
    db.exec(`
      CREATE TRIGGER reject_evaluation_projection
      BEFORE INSERT ON evaluations
      BEGIN
        SELECT RAISE(ABORT, 'projection rejected');
      END;
    `);

    expect(() =>
      bus.emit({
        type: "evaluation.recorded",
        source: "test",
        owner: "agent:evaluator",
        data: {
          evaluation: {
            sessionId: "s_atomic",
            agent: "coder",
            quality: 0.8,
            efficiency: 0.7,
            verdict: "good",
            issues: [],
          },
        },
      } as any),
    ).toThrow("projection rejected");
    expect(db.prepare("SELECT COUNT(*) AS count FROM evaluations").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'evaluation.recorded'").get()).toEqual({
      count: 0,
    });
  });
});
