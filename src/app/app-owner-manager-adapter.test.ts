import { describe, expect, it } from "bun:test";
import { Type, defineApp } from "@may-agent/sdk";
import {
  appOwnerBatchResultSchema,
  createManagerAppOwnerInvoker,
  type AppOwnerManager,
} from "./app-owner-manager-adapter.js";

describe("manager App owner adapter", () => {
  it("runs one schema-bound owner session for a batch", async () => {
    const calls: Array<{ agent: string; prompt: string; options: Record<string, unknown> }> = [];
    const manager: AppOwnerManager = {
      hasAgent: () => true,
      run(agent, prompt, options) {
        calls.push({ agent, prompt, options });
        return "session-1";
      },
      async waitFor() {
        return {
          status: "done",
          structuredResult: {
            dispositions: [
              { requestId: "probe-1", disposition: { type: "complete", summary: "passed" } },
            ],
          },
        };
      },
      cancel() {},
    };
    const invoker = createManagerAppOwnerInvoker(manager);
    const sessions: string[] = [];
    const app = defineApp({
      id: "evaluation",
      version: 1,
      owner: "evaluator",
      inputSchema: Type.Object({ kind: Type.String(), data: Type.Unknown() }),
    });

    const result = await invoker({
      app,
      requests: [
        {
          id: "probe-1",
          source: { kind: "system", id: "canary" },
          input: { kind: "probe", data: { value: 1 } },
        },
      ],
      onSessionStarted: (sessionId) => sessions.push(sessionId),
    });

    expect(sessions).toEqual(["session-1"]);
    expect(result).toEqual([
      { requestId: "probe-1", disposition: { type: "complete", summary: "passed" } },
    ]);
    expect(calls[0]).toMatchObject({
      agent: "evaluator",
      options: {
        source: "app-inbox-owner",
        kind: "call",
        projectId: "evaluation",
        requestId: "app-inbox:probe-1",
        requireFinish: true,
        outputSchema: appOwnerBatchResultSchema,
      },
    });
    expect(calls[0]!.prompt).toContain('"id": "probe-1"');
    expect(calls[0]!.prompt).toContain("current read-only observation");
    expect(calls[0]!.prompt).not.toContain("lease_generation");
  });

  it("cancels a newly started session when its claim cannot be associated", async () => {
    const cancelled: string[] = [];
    const manager: AppOwnerManager = {
      hasAgent: () => true,
      run: () => "session-stale",
      waitFor: async () => ({ status: "done", structuredResult: { dispositions: [] } }),
      cancel: (sessionId) => cancelled.push(sessionId),
    };
    const invoker = createManagerAppOwnerInvoker(manager);
    const app = defineApp({
      id: "evaluation",
      version: 1,
      owner: "evaluator",
      inputSchema: Type.Unknown(),
    });

    await expect(
      invoker({
        app,
        requests: [],
        onSessionStarted: () => {
          throw new Error("stale claim");
        },
      }),
    ).rejects.toThrow("stale claim");
    expect(cancelled).toEqual(["session-stale"]);
  });

  it("runs a single human request as the channel response session", async () => {
    const calls: Array<{ prompt: string; options: Record<string, unknown> }> = [];
    const manager: AppOwnerManager = {
      hasAgent: () => true,
      run(_agent, prompt, options) {
        calls.push({ prompt, options });
        return "session-human";
      },
      async waitFor() {
        return {
          status: "done",
          structuredResult: {
            dispositions: [
              {
                requestId: "human-1",
                disposition: { type: "complete", summary: "Hello", response: "Hello" },
              },
            ],
          },
        };
      },
      cancel() {},
    };
    const invoker = createManagerAppOwnerInvoker(manager);
    const app = defineApp({
      id: "may",
      version: 1,
      owner: "may",
      inputSchema: Type.Unknown(),
    });

    await invoker({
      app,
      requests: [
        {
          id: "human-1",
          source: { kind: "human", id: "event:42" },
          input: { kind: "message", data: { message: "hello" } },
        },
      ],
      transport: {
        channel: "telegram",
        conversationId: "telegram:123",
        channelMessageId: 99,
      },
      onSessionStarted() {},
    });

    expect(calls[0]?.options).toMatchObject({
      source: "telegram",
      kind: "job",
      projectId: "may",
      requestId: "app-inbox-human:human-1",
      conversationId: "telegram:123",
      channelMessageId: 99,
      toolPolicy: "deputy",
    });
    expect(calls[0]?.prompt).toContain("exact concise human-facing progress or final reply");
  });

  it("rejects an unstructured successful owner result", async () => {
    const manager: AppOwnerManager = {
      hasAgent: () => true,
      run: () => "session-1",
      waitFor: async () => ({ status: "done", structuredResult: { summary: "not a batch" } }),
      cancel() {},
    };
    const invoker = createManagerAppOwnerInvoker(manager);
    const app = defineApp({
      id: "evaluation",
      version: 1,
      owner: "evaluator",
      inputSchema: Type.Unknown(),
    });

    await expect(invoker({ app, requests: [], onSessionStarted() {} })).rejects.toThrow(
      "Invalid App owner result",
    );
  });
});
