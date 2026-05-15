import { describe, expect, it } from "bun:test";
import { normalizeSocketFrame } from "../packages/control/src/protocol.js";

describe("socket frame normalization", () => {
  it("passes raw bus events through by default", () => {
    expect(normalizeSocketFrame({ type: "message.created", from: "may", to: "human", content: "hi" })).toEqual({
      kind: "event",
      command: "message.created",
      event: { type: "message.created", from: "may", to: "human", content: "hi" },
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

  it("normalizes legacy emit wrapper to the inner event", () => {
    expect(normalizeSocketFrame({ type: "emit", event: "trigger.metrics-snapshot", forced: true })).toEqual({
      kind: "event",
      command: "emit",
      event: { type: "trigger.metrics-snapshot", forced: true },
    });
  });

  it("normalizes input frames with source and content aliases", () => {
    expect(normalizeSocketFrame({ type: "input", content: "hello" })).toEqual({
      kind: "event",
      command: "input",
      event: { type: "input", content: "hello", source: "socket", message: "hello" },
    });
  });

  it("normalizes backwards-compatible command aliases at the boundary", () => {
    expect(normalizeSocketFrame({ type: "close" })).toEqual({
      kind: "event",
      command: "close",
      event: { type: "shutdown" },
    });
    expect(normalizeSocketFrame({ type: "reload_agents" })).toEqual({
      kind: "event",
      command: "reload_agents",
      event: { type: "reload" },
    });
    expect(normalizeSocketFrame({ type: "cancel_task" })).toEqual({
      kind: "event",
      command: "cancel_task",
      event: { type: "cancel_all" },
    });
  });

  it("rejects frames without a concrete event type", () => {
    const result = normalizeSocketFrame({ event: "input" });
    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.message).toContain("invalid event type");
  });
});
