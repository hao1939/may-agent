import { describe, expect, it } from "bun:test";
import { normalizeSocketFrame } from "../packages/control/src/protocol.js";

describe("socket frame normalization", () => {
  it("accepts unknown dot-named events when they use canonical envelopes", () => {
    expect(normalizeSocketFrame({
      type: "custom.event",
      source: "test",
      owner: "agent:may",
      data: { projectId: "p1" },
    })).toEqual({
      kind: "event",
      command: "custom.event",
      event: {
        type: "custom.event",
        source: "test",
        owner: "agent:may",
        data: { projectId: "p1" },
      },
    });
  });

  it("accepts domain events that already use canonical envelopes", () => {
    expect(normalizeSocketFrame({
      type: "message.created",
      source: "agent:may",
      owner: "human:operator",
      data: { from: "may", to: "human", content: "hi" },
    })).toEqual({
      kind: "event",
      command: "message.created",
      event: {
        type: "message.created",
        source: "agent:may",
        owner: "human:operator",
        data: { from: "may", to: "human", content: "hi" },
      },
    });

    expect(normalizeSocketFrame({
      type: "project.nudge",
      source: "web-ui",
      owner: "agent:may",
      data: { projectPath: "projects/x" },
    })).toEqual({
      kind: "event",
      command: "project.nudge",
      event: {
        type: "project.nudge",
        source: "web-ui",
        owner: "agent:may",
        data: { projectPath: "projects/x" },
      },
    });

    expect(normalizeSocketFrame({
      type: "project.comment.created",
      source: "socket",
      owner: "agent:may",
      data: { projectPath: "projects/x", comment: "go", author: "hao" },
    })).toEqual({
      kind: "event",
      command: "project.comment.created",
      event: {
        type: "project.comment.created",
        source: "socket",
        owner: "agent:may",
        data: { projectPath: "projects/x", comment: "go", author: "hao" },
      },
    });

    expect(normalizeSocketFrame({
      type: "metric.breach",
      source: "metrics-snapshot",
      owner: "agent:may",
      urgency: "high",
      data: { metricId: "system.health", message: "check" },
    })).toEqual({
      kind: "event",
      command: "metric.breach",
      event: {
        type: "metric.breach",
        source: "metrics-snapshot",
        owner: "agent:may",
        urgency: "high",
        data: { metricId: "system.health", message: "check" },
      },
    });
  });

  it("rejects flat frames for dot-named event types", () => {
    expect(normalizeSocketFrame({ type: "custom.event", projectId: "p1" })).toEqual({
      kind: "error",
      command: "custom.event",
      message: "Canonical event 'custom.event' requires object field 'data'",
    });
    expect(normalizeSocketFrame({ type: "message.created", from: "may", to: "human", content: "hi" })).toEqual({
      kind: "error",
      command: "message.created",
      message: "Canonical event 'message.created' requires object field 'data'",
    });
    expect(normalizeSocketFrame({ type: "project.nudge", projectPath: "projects/x", source: "web-ui" })).toEqual({
      kind: "error",
      command: "project.nudge",
      message: "Canonical event 'project.nudge' requires object field 'data'",
    });
    expect(normalizeSocketFrame({ type: "metric.breach", source: "metrics-snapshot", owner: "agent:may", metricId: "system.health", message: "check" })).toEqual({
      kind: "error",
      command: "metric.breach",
      message: "Canonical event 'metric.breach' requires object field 'data'",
    });
    expect(normalizeSocketFrame({ type: "session.end", source: "runtime", owner: "agent:dev", sessionId: "s_1", status: "done" })).toEqual({
      kind: "error",
      command: "session.end",
      message: "Canonical event 'session.end' requires object field 'data'",
    });
  });

  it("keeps socket-local protocol frames local", () => {
    expect(normalizeSocketFrame({ type: "status" })).toEqual({
      kind: "control",
      command: "status",
      frame: { type: "status" },
    });
    expect(normalizeSocketFrame({ type: "subscribe", sessions: ["chat"] })).toEqual({
      kind: "control",
      command: "subscribe",
      frame: { type: "subscribe", sessions: ["chat"] },
    });
  });

  it("passes direct command/event frames through without aliasing fields", () => {
    expect(normalizeSocketFrame({ type: "trigger.metrics-snapshot", forced: true })).toEqual({
      kind: "event",
      command: "trigger.metrics-snapshot",
      event: { type: "trigger.metrics-snapshot", forced: true },
    });
    expect(normalizeSocketFrame({ type: "session.cancel.requested", sessionId: "s_1", source: "web-ui" })).toEqual({
      kind: "event",
      command: "session.cancel.requested",
      event: { type: "session.cancel.requested", sessionId: "s_1", source: "web-ui" },
    });
    expect(normalizeSocketFrame({ type: "input", message: "hello", source: "socket" })).toEqual({
      kind: "event",
      command: "input",
      event: { type: "input", message: "hello", source: "socket" },
    });
    expect(normalizeSocketFrame({ type: "fork", agent: "dev", task: "investigate", opts: { kind: "job", source: "web-ui" } })).toEqual({
      kind: "event",
      command: "fork",
      event: { type: "fork", agent: "dev", task: "investigate", opts: { kind: "job", source: "web-ui" } },
    });
  });

  it("does not alias content/message fields at the socket boundary", () => {
    expect(normalizeSocketFrame({ type: "input", content: "hello" })).toEqual({
      kind: "event",
      command: "input",
      event: { type: "input", content: "hello" },
    });
    expect(normalizeSocketFrame({ type: "fork", agent: "dev", message: "investigate" })).toEqual({
      kind: "event",
      command: "fork",
      event: { type: "fork", agent: "dev", message: "investigate" },
    });
    expect(normalizeSocketFrame({ type: "message", from: "may", to: "dev", content: "hello" })).toEqual({
      kind: "error",
      command: "message",
      message: "Unsupported legacy socket frame type: message",
    });
  });

  it("rejects legacy socket wrapper and command aliases", () => {
    expect(normalizeSocketFrame({ type: "emit", event: "trigger.metrics-snapshot", forced: true })).toEqual({
      kind: "error",
      command: "emit",
      message: "Unsupported legacy socket frame type: emit",
    });
    expect(normalizeSocketFrame({ type: "message", from: "may", to: "dev", task: "hello" })).toEqual({
      kind: "error",
      command: "message",
      message: "Unsupported legacy socket frame type: message",
    });
    expect(normalizeSocketFrame({ type: "close" })).toEqual({
      kind: "error",
      command: "close",
      message: "Unsupported legacy socket frame type: close",
    });
    expect(normalizeSocketFrame({ type: "reload_agents" })).toEqual({
      kind: "error",
      command: "reload_agents",
      message: "Unsupported legacy socket frame type: reload_agents",
    });
    expect(normalizeSocketFrame({ type: "cancel_task" })).toEqual({
      kind: "error",
      command: "cancel_task",
      message: "Unsupported legacy socket frame type: cancel_task",
    });
  });

  it("rejects frames without a concrete event type", () => {
    const result = normalizeSocketFrame({ event: "input" });
    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.message).toContain("invalid event type");
  });
});
