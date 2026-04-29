import { describe, it, expect } from "vitest";
import { guard } from "../shared/guards/no-secret-leak.js";

describe("no-secret-leak guard", () => {
  const makeEvent = (text: string): any => ({
    type: "step_done",
    step: "test-step",
    result: { lastAssistantText: text },
  });

  it("returns empty for non-step_done", () => {
    expect(guard.handle({ type: "step_start" } as any)).toEqual([]);
  });
  it("returns empty for clean text", () => {
    expect(guard.handle(makeEvent("just normal code output"))).toEqual([]);
  });
  it("returns empty for empty text", () => {
    expect(guard.handle(makeEvent(""))).toEqual([]);
  });
  it("blocks on OpenAI API key", () => {
    const demands = guard.handle(makeEvent("key: sk-proj-" + "a".repeat(50)));
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
  });
  it("blocks on Anthropic API key", () => {
    const demands = guard.handle(makeEvent("sk-ant-" + "x".repeat(50)));
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
  });
  it("blocks on AWS access key", () => {
    const demands = guard.handle(makeEvent("AKIA" + "A".repeat(16)));
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
  });
  it("blocks on GitHub PAT", () => {
    const demands = guard.handle(makeEvent("ghp_" + "a".repeat(36)));
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
  });
  it("blocks on private key", () => {
    const demands = guard.handle(makeEvent("-----BEGIN RSA PRIVATE KEY-----"));
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
  });
  it("blocks on Stripe secret key", () => {
    const demands = guard.handle(makeEvent("sk_live_" + "a".repeat(30)));
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
  });
  it("warns on bearer token", () => {
    const demands = guard.handle(makeEvent("Authorization: Bearer " + "a".repeat(40)));
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
  });
  it("warns on generic API key assignment", () => {
    const demands = guard.handle(makeEvent(`api_key = "${  "x".repeat(25)}"`));
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
  });
  it("warns on Slack token", () => {
    const demands = guard.handle(makeEvent("xoxb-" + "a".repeat(20)));
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
  });
  it("skips warn patterns when block patterns match", () => {
    // Has both a block pattern and a warn pattern
    const text = "sk-ant-" + "x".repeat(50) + " xoxb-" + "a".repeat(20);
    const demands = guard.handle(makeEvent(text));
    // Should only return blocks, not warns
    expect(demands.every(d => d.type === "block")).toBe(true);
  });
});
