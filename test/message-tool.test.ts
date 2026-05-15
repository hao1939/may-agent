/**
 * message tool — v2 unified inter-agent communication primitive.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { createMessageTool } from "../src/lib/tools/message-tool.js";

interface CapturedEvent {
  type: string;
  [key: string]: unknown;
}

function setup(overrides: Partial<{ allowedTargets: string[]; persistDir: string; triggerResult: boolean }> = {}) {
  const events: CapturedEvent[] = [];
  const triggers: string[] = [];
  const tool = createMessageTool({
    agentName: "arc",
    agentsRoot: "/tmp/agents",
    persistDir: overrides.persistDir ?? "/tmp/.state",
    emit: (e) => events.push(e),
    triggerHeartbeat: (a) => {
      triggers.push(a);
      return overrides.triggerResult ?? true;
    },
    allowedTargets: overrides.allowedTargets,
  });
  return { tool, events, triggers };
}

async function call(tool: ReturnType<typeof createMessageTool>, params: Record<string, unknown>) {
  const r = await tool.execute("call-1", params);
  const text = (r.content[0] as { text: string }).text;
  return JSON.parse(text);
}

describe("message tool", () => {
  it("rejects missing 'to' or 'content'", async () => {
    const { tool } = setup();
    expect((await call(tool, { content: "hi" })).error).toMatch(/required/);
    expect((await call(tool, { to: "dev" })).error).toMatch(/required/);
  });

  it("emits exactly one message.created event (no legacy dual-emit)", async () => {
    const { tool, events } = setup();
    await call(tool, { to: "dev", content: "please implement X" });

    const types = events.map((e) => e.type);
    expect(types).toContain("message.created");
    expect(types).not.toContain("agent.notification");
    expect(types.filter((t) => t === "message.created")).toHaveLength(1);
  });

  it("default priority is P2; P0 triggers immediate heartbeat", async () => {
    const { tool, events, triggers } = setup();

    const r1 = await call(tool, { to: "dev", content: "low priority" });
    expect(r1.priority).toBe("P2");
    expect(r1.triggered).toBe(false);
    expect(triggers).toEqual([]);

    const r2 = await call(tool, { to: "dev", content: "urgent", priority: "P0" });
    expect(r2.priority).toBe("P0");
    expect(r2.triggered).toBe(true);
    expect(triggers).toEqual(["dev"]);

    // P0 message.created event has priority field
    const p0Event = events.find((e) => e.type === "message.created" && e.priority === "P0");
    expect(p0Event).toBeDefined();
  });

  it("respects allowedTargets allowlist and reports invalid targets to may", async () => {
    const { tool, events, triggers } = setup({ allowedTargets: ["dev", "scout"] });

    const allowed = await call(tool, { to: "dev", content: "hi" });
    expect(allowed.error).toBeUndefined();

    const denied = await call(tool, { to: "qa", content: "hi" });
    expect(denied.error).toMatch(/Unknown message target/);
    expect(triggers).toEqual([]);
    expect(events.some((e) => e.type === "message.created" && e.to === "qa")).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({
      type: "message.delivery_failed",
      owner: "may",
      from: "arc",
      to: "qa",
      reason: expect.stringContaining("qa"),
      content: "hi",
    }));
  });

  it("always allows messages to human", async () => {
    const { tool } = setup({ allowedTargets: ["dev", "scout"] });

    const allowed = await call(tool, { to: "human", content: "status" });
    expect(allowed.error).toBeUndefined();
  });

  it("normalizes human aliases", async () => {
    const { tool, events } = setup({ allowedTargets: ["dev", "scout"] });

    const allowed = await call(tool, { to: "hao", content: "status" });
    expect(allowed.error).toBeUndefined();
    expect(allowed.to).toBe("human");
    expect(events).toContainEqual(expect.objectContaining({
      type: "message.created",
      to: "human",
    }));
  });

  it("rejects tool namespace targets with an actionable hint", async () => {
    const { tool, events } = setup({ allowedTargets: ["dev", "scout"] });

    const denied = await call(tool, { to: "functions.message", content: "hi" });
    expect(denied.error).toMatch(/Unknown message target/);
    expect(denied.hint).toMatch(/tool namespace/);
    expect(events).toContainEqual(expect.objectContaining({
      type: "message.delivery_failed",
      to: "functions.message",
      reason: expect.stringContaining("tool namespace"),
    }));
  });

  it("includes intent and content_files in body", async () => {
    const { tool, events } = setup();
    await call(tool, {
      to: "dev",
      content: "do it",
      intent: "implementation-request",
      context_files: ["a.md", "b.md"],
    });

    const ev = events.find((e) => e.type === "message.created") as { content: string; intent: string };
    expect(ev.intent).toBe("implementation-request");
    expect(ev.content).toContain("[implementation-request]");
    expect(ev.content).toContain("Context files: a.md, b.md");
  });

  it("rejects artifacts outside project root", async () => {
    const { tool } = setup({ persistDir: "/tmp/.state" });
    const r = await call(tool, {
      to: "dev",
      content: "see file",
      artifact: "/etc/passwd",
    });
    expect(r.error).toMatch(/outside project root|not found/);
  });
});
