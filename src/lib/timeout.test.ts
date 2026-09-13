import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "./manager.js";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { readSessionMeta } from "./persistence.js";
import { fakeModel } from "../../test/fixtures/model.js";

describe("SubagentManager timeout enforcement", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-timeout-"));
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it.each(["quiet", "hung", "active", "standalone"])("%s work uses only its fixed execution deadline", async (mode) => {
    let cancelled = false;
    let updates: ReturnType<typeof setInterval> | undefined;
    const complete = Promise.withResolvers<void>();
    const manager = new SubagentManager({ persistDir,
      agentRunFactory: () => {
        const listeners = new Set<(event: any) => void>();
        const state = { messages: [] } as any;
        return {
          state,
          prompt: async () => {
            if (mode === "quiet") setTimeout(() => {
              state.messages.push({ role: "assistant", content: [{ type: "text", text: "Useful result" }] });
              complete.resolve();
            }, 40);
            if (mode === "active") updates = setInterval(() => {
              for (const listener of listeners) listener({ type: "tool_execution_update", toolCallId: "fixture" });
            }, 5);
            await complete.promise;
          },
          cancel: () => { cancelled = true; complete.reject(new Error("cancelled")); },
          waitForIdle: async () => undefined, followUp: () => undefined,
          continue: async () => undefined, steer: () => undefined,
          subscribe: (listener: (event: any) => void) => { listeners.add(listener); return () => listeners.delete(listener); },
        };
      },
    });
    const definition = { name: "worker", description: "fixture", domain: "fixture", model: fakeModel(), tools: [] };
    try {
      const result = await manager.callAgentDefinition(definition, "Do useful work", {
        timeout: 150, ...(mode === "standalone" ? {} : { taskBinding: { appId: "sample", taskId: "work", generation: 1, attemptId: "attempt" } }),
      });
      expect(result.status).toBe(mode === "quiet" ? "done" : "interrupted");
      expect(cancelled).toBe(mode !== "quiet");
      if (mode !== "quiet") expect(result.error).toBe("Agent timed out after 150ms");
      expect(manager.hasActiveSession(result.sessionId)).toBe(false);
    } finally {
      clearInterval(updates);
    }
  });

  it("propagates the configured call deadline through the blocking tool AbortSignal and persists interruption", async () => {
    let observedSignal: AbortSignal | undefined;
    const blockingTool: AgentTool = {
      name: "blocking-read",
      label: "Blocking read",
      description: "Waits until the owner step is cancelled",
      parameters: {},
      execute: async (_id, _params, signal) => {
        observedSignal = signal;
        return await new Promise((resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        });
      },
    };
    const manager = new SubagentManager({
      persistDir,
      agentRunFactory: (config: any) => {
        const controller = new AbortController();
        const listeners = new Set<(event: any) => void>();
        const state = { messages: [], systemPrompt: config.initialState.systemPrompt } as any;
        return {
          state,
          prompt: async () => {
            const call = {
              role: "assistant",
              content: [{ type: "toolCall", id: "blocking_1", name: "blocking-read", arguments: {} }],
              timestamp: Date.now(),
            };
            state.messages.push(call);
            for (const listener of listeners) listener({ type: "message_end", message: call });
            await config.initialState.tools[0].execute("blocking_1", {}, controller.signal);
          },
          waitForIdle: async () => undefined,
          followUp: () => undefined,
          continue: async () => undefined,
          steer: () => undefined,
          cancel: () => controller.abort(),
          subscribe: (listener: (event: any) => void) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
        };
      },
    });
    manager.register({
      name: "owner-step",
      description: "Owner step with a blocking tool",
      domain: "test",
      systemPrompt: "Use the blocking tool.",
      model: fakeModel(),
      tools: [blockingTool],
      apiKey: "fake-key",
    });

    const result = await manager.callAgent("owner-step", "inspect facts", { timeout: 25 });

    expect(observedSignal).toBeDefined();
    expect(observedSignal?.aborted).toBe(true);
    expect(result.status).toBe("interrupted");
    expect(result.error).toBe("Agent timed out after 25ms");
    expect(readSessionMeta(persistDir, result.sessionId)).toMatchObject({
      status: "interrupted",
      error: "Agent timed out after 25ms",
    });
    expect(manager.hasActiveSession(result.sessionId)).toBe(false);
  });

});
