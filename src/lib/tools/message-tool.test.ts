/**
 * message tool — v2 unified inter-agent communication primitive.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { createMessageTool } from "./message-tool.js";

interface CapturedEvent {
  type: string;
  [key: string]: unknown;
}

function setup(
  overrides: Partial<{
    allowedTargets: string[] | (() => string[]);
    persistDir: string;
    triggerResult: boolean;
    callerSessionId: string;
  }> = {},
) {
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
    getCallerSessionId: () => overrides.callerSessionId,
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

  it("attaches the exact caller session to the emitted message", async () => {
    const { tool, events } = setup({ callerSessionId: "may-turn-45978" });
    await call(tool, { to: "human", content: "corrected answer" });

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "message.created",
        data: expect.objectContaining({ sourceSessionId: "may-turn-45978" }),
      }),
    );
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

    // P0 message.created event carries priority in the canonical data payload.
    const p0Event = events.find(
      (e) => e.type === "message.created" && (e.data as Record<string, unknown>)?.priority === "P0",
    );
    expect(p0Event).toBeDefined();
  });

  it("respects allowedTargets allowlist and reports invalid targets to may", async () => {
    const { tool, events, triggers } = setup({ allowedTargets: ["dev", "scout"] });

    const allowed = await call(tool, { to: "dev", content: "hi" });
    expect(allowed.error).toBeUndefined();

    const denied = await call(tool, { to: "qa", content: "hi" });
    expect(denied.error).toMatch(/Unknown message target/);
    expect(triggers).toEqual([]);
    expect(events.some((e) => e.type === "message.created" && (e.data as Record<string, unknown>)?.to === "qa")).toBe(
      false,
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "message.delivery_failed",
        source: "agent:arc",
        owner: "agent:may",
        data: expect.objectContaining({
          from: "arc",
          to: "qa",
          reason: expect.stringContaining("qa"),
          content: "hi",
        }),
      }),
    );
  });

  it("always allows messages to human", async () => {
    const { tool } = setup({ allowedTargets: ["dev", "scout"] });

    const allowed = await call(tool, { to: "human", content: "status" });
    expect(allowed.error).toBeUndefined();
  });

  it("supports lazy allowedTargets function that re-evaluates on each call", async () => {
    const targets = ["dev"];
    const { tool } = setup({ allowedTargets: () => [...targets] });

    // Initially only "dev" is allowed
    const allowed = await call(tool, { to: "dev", content: "hi" });
    expect(allowed.error).toBeUndefined();

    const denied = await call(tool, { to: "scout", content: "hi" });
    expect(denied.error).toMatch(/Unknown message target/);

    // Add "scout" dynamically — simulates agent loaded after tool creation
    targets.push("scout");
    const nowAllowed = await call(tool, { to: "scout", content: "hi" });
    expect(nowAllowed.error).toBeUndefined();
  });

  it("uses only human as the shorthand for human:operator", async () => {
    const { tool, events } = setup({ allowedTargets: ["dev", "scout"] });

    const allowed = await call(tool, { to: "human", content: "status" });
    expect(allowed.error).toBeUndefined();
    expect(allowed.to).toBe("human");
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "message.created",
        source: "agent:arc",
        owner: "human:operator",
        data: expect.objectContaining({ to: "human" }),
      }),
    );
  });

  it("does not treat personal aliases as human owners", async () => {
    const { tool, events } = setup({ allowedTargets: ["dev", "scout"] });

    for (const target of ["hao", "user", "operator"]) {
      const denied = await call(tool, { to: target, content: "status" });
      expect(denied.error).toMatch(/Unknown message target/);
    }

    expect(events.some((event) => event.type === "message.created" && event.owner === "human:operator")).toBe(false);
  });

  it("rejects tool namespace targets with an actionable hint", async () => {
    const { tool, events } = setup({ allowedTargets: ["dev", "scout"] });

    const denied = await call(tool, { to: "functions.message", content: "hi" });
    expect(denied.error).toMatch(/Unknown message target/);
    expect(denied.hint).toMatch(/tool namespace/);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "message.delivery_failed",
        data: expect.objectContaining({
          to: "functions.message",
          reason: expect.stringContaining("tool namespace"),
        }),
      }),
    );
  });

  it("includes intent and content_files in body", async () => {
    const { tool, events } = setup();
    await call(tool, {
      to: "dev",
      content: "do it",
      intent: "implementation-request",
      context_files: ["a.md", "b.md"],
    });

    const ev = events.find((e) => e.type === "message.created") as { data: { content: string; intent: string } };
    expect(ev.data.intent).toBe("implementation-request");
    expect(ev.data.content).toContain("[implementation-request]");
    expect(ev.data.content).toContain("Context files: a.md, b.md");
  });

  it("emits canonical message.created envelope", async () => {
    const { tool, events } = setup();
    await call(tool, { to: "dev", content: "please implement X", priority: "P1" });

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "message.created",
        source: "agent:arc",
        owner: "agent:dev",
        urgency: "high",
        data: expect.objectContaining({
          from: "arc",
          to: "dev",
          content: "[P1] please implement X",
          priority: "P1",
        }),
      }),
    );
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
