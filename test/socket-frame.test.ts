import { describe, expect, it } from "bun:test";
import { normalizeSocketFrame } from "../packages/control/src/protocol.js";

describe("socket frame normalization", () => {
  it("passes unknown raw bus events through by default", () => {
    expect(normalizeSocketFrame({ type: "custom.event", projectId: "p1" })).toEqual({
      kind: "event",
      command: "custom.event",
      event: { type: "custom.event", projectId: "p1" },
    });
  });

  it("accepts known domain events that already use canonical envelopes", () => {
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
  });

  it("rejects flat frames for known canonical events", () => {
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
      kind: "event",
      command: "message",
      event: { type: "message", from: "may", to: "dev", content: "hello" },
    });
  });

  it("rejects legacy socket wrapper and command aliases", () => {
    expect(normalizeSocketFrame({ type: "emit", event: "trigger.metrics-snapshot", forced: true })).toEqual({
      kind: "error",
      command: "emit",
      message: "Unsupported legacy socket frame type: emit",
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
