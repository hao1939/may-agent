/**
 * SystemEvent type — v2 dot-form variants exist.
 *
 * The manager emits canonical dot-form session lifecycle envelopes.
 * This test pins the contract so the envelope/data shape does not regress.
 */

import { describe, it, expect } from "bun:test";
import type { AgentEvent } from "./event-bus.js";

describe("v2 SystemEvent variants", () => {
  it("supports session.start and session.end (dot form)", () => {
    const start: AgentEvent = {
      type: "session.start",
      source: "runtime",
      owner: "agent:may",
      data: {
        sessionId: "s1",
        agent: "may",
        task: "heartbeat",
        trigger: "cron",
        firedAt: 0,
      },
    };
    expect(start.type).toBe("session.start");

    const end: AgentEvent = {
      type: "session.end",
      source: "runtime",
      owner: "agent:may",
      data: {
        sessionId: "s1",
        agent: "may",
        outcome: "ok",
        summary: "done",
        durationMs: 1000,
      },
    };
    expect(end.type).toBe("session.end");
  });

  it("supports canonical message.created with priority", () => {
    const m: AgentEvent = {
      type: "message.created",
      source: "agent:arc",
      owner: "agent:dev",
      data: {
        from: "arc",
        to: "dev",
        content: "please implement",
        priority: "P0",
      },
    };
    expect(m.data.priority).toBe("P0");
  });

  it("does not duplicate session fields on the envelope", () => {
    const start: AgentEvent = {
      type: "session.start",
      source: "runtime",
      owner: "agent:may",
      data: {
        sessionId: "s1",
        agent: "may",
        task: "x",
        trigger: "runtime",
        firedAt: 0,
      },
    };
    expect(start).not.toHaveProperty("sessionId");
    expect(start).not.toHaveProperty("agent");
  });
});
