/**
 * SystemEvent type — v2 dot-form variants exist.
 *
 * The manager emits BOTH legacy (session_start) and v2 dot-form
 * (session.start) events. This test pins the contract so the dot-form
 * variants don't accidentally regress out of the union.
 */

import { describe, it, expectTypeOf } from "vitest";
import type { AgentEvent } from "../src/app/event-bus.js";

describe("v2 SystemEvent variants", () => {
  it("supports session.start and session.end (dot form)", () => {
    const start: AgentEvent = {
      type: "session.start",
      sessionId: "s1",
      agent: "may",
      task: "heartbeat",
      trigger: "cron",
      firedAt: 0,
    };
    expectTypeOf(start).toMatchTypeOf<AgentEvent>();

    const end: AgentEvent = {
      type: "session.end",
      sessionId: "s1",
      agent: "may",
      outcome: "ok",
      summary: "done",
      durationMs: 1000,
    };
    expectTypeOf(end).toMatchTypeOf<AgentEvent>();
  });

  it("supports message.created with priority", () => {
    const m: AgentEvent = {
      type: "message.created",
      from: "arc",
      to: "dev",
      content: "please implement",
      priority: "P0",
    };
    expectTypeOf(m).toMatchTypeOf<AgentEvent>();
  });

  it("legacy session_start / session_end still work", () => {
    const start: AgentEvent = {
      type: "session_start",
      sessionId: "s1",
      agent: "may",
      task: "x",
    };
    expectTypeOf(start).toMatchTypeOf<AgentEvent>();
  });
});
