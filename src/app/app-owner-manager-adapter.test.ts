import { describe, expect, it } from "bun:test";
import { Type, defineApp } from "@may-agent/sdk";
import { Check } from "typebox/value";
import {
  appOwnerBatchResultSchema,
  createManagerAppOwnerInvoker,
  type AppOwnerManager,
} from "./app-owner-manager-adapter.js";

describe("manager App owner adapter", () => {
  it("accepts same-turn May continuation but not direct task attachment", () => {
    expect(
      Check(appOwnerBatchResultSchema, {
        dispositions: [
          {
            requestId: "feedback-turn",
            disposition: {
              type: "continue",
              requestId: "original-work",
              disposition: { type: "complete", summary: "done", response: "Done." },
            },
          },
        ],
      }),
    ).toBe(true);
    expect(
      Check(appOwnerBatchResultSchema, {
        dispositions: [
          {
            requestId: "feedback-turn",
            disposition: {
              type: "continue",
              requestId: "original-work",
              disposition: { type: "task", task: { kind: "existing", taskId: "task-1" } },
            },
          },
        ],
      }),
    ).toBe(false);
  });

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
            dispositions: [{ requestId: "probe-1", disposition: { type: "complete", summary: "passed" } }],
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
      tasks: { attach: true },
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
    expect(result).toEqual([{ requestId: "probe-1", disposition: { type: "complete", summary: "passed" } }]);
    expect(calls[0]).toMatchObject({
      agent: "evaluator",
      options: {
        source: "app-inbox-owner",
        kind: "call",
        projectId: "evaluation",
        requestId: "app-inbox:probe-1",
        recoveryOwner: "app-inbox",
        requireFinish: true,
        outputSchema: appOwnerBatchResultSchema,
        toolPolicy: "app-owner-full",
      },
    });
    expect(calls[0]!.prompt).toContain('"id": "probe-1"');
    expect(calls[0]!.prompt).toContain("current read-only observation");
    expect(calls[0]!.prompt).toContain(
      "Durable asynchronous ownership must be returned as a delegate or task disposition",
    );
    expect(calls[0]!.prompt).toContain("may return a task disposition");
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
      recoveryOwner: "app-inbox",
      toolPolicy: "app-owner-deputy",
    });
    expect(calls[0]?.prompt).toContain("exact concise human-facing progress or final reply");
    expect(calls[0]?.prompt).toContain("cannot attach tasks");
    expect(calls[0]?.prompt).toContain("when an item contains result, give the human that result directly");
    expect(calls[0]?.prompt).toContain("Never discuss channels, delivery receipts");
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

    await expect(invoker({ app, requests: [], onSessionStarted() {} })).rejects.toThrow("Invalid App owner result");
  });
});
