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
