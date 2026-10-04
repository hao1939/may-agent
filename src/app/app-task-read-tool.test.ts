import { describe, expect, it } from "bun:test";
import type { TaskAttempt, TaskOutcomeProjection } from "@may-agent/sdk";
import { createAppTaskReadTool } from "./app-task-read-tool.js";
import { EventBus } from "./core/events/bus.js";

function text(result: Awaited<ReturnType<ReturnType<typeof createAppTaskReadTool>["execute"]>>): unknown {
  const content = result.content[0];
  if (!content || content.type !== "text") throw new Error("Expected text tool result");
  return JSON.parse(content.text);
}

describe("App Task read tool", () => {
  it("keeps list local and allows one exact cross-App get", async () => {
    const calls: unknown[] = [];
    const tool = createAppTaskReadTool({
      bus: new EventBus(),
      appId: () => "evaluation",
      reader: {
        list(input) {
          calls.push(input);
          return { items: [{ id: "review", status: "running", generation: 2, outcome: "Review docs" }] };
        },
        get(input) {
          calls.push(input);
          return { id: input.taskId, status: "done", generation: 2, outcome: "Review docs" };
        },
      },
    });

    expect(text(await tool.execute("call-list", { action: "list", status: ["running"], limit: 10 }))).toEqual({
      items: [{ id: "review", status: "running", generation: 2, outcome: "Review docs" }],
    });
    expect(text(await tool.execute("call-get", { action: "get", taskId: "review" }))).toMatchObject({
      id: "review",
      status: "done",
    });
    expect(
      text(
        await tool.execute("call-cross-app-get", {
          action: "get",
          taskId: "benchmark",
          target: { appId: "gym" },
          acceptedEvidence: { limit: 4, cursor: "older" },
          inputKeys: ["request:earlier"],
        }),
      ),
    ).toMatchObject({ id: "benchmark", status: "done" });
    expect(calls).toEqual([
      expect.objectContaining({ appId: "evaluation", options: { status: ["running"], limit: 10 } }),
      expect.objectContaining({ appId: "evaluation", taskId: "review" }),
      expect.objectContaining({
        appId: "gym",
        taskId: "benchmark",
        options: { acceptedEvidence: { limit: 4, cursor: "older" }, inputKeys: ["request:earlier"] },
      }),
    ]);
  });

  it("requires an exact task for outcome reads and preserves the reader's report", async () => {
    let requestedProjection: TaskOutcomeProjection | undefined;
    const tool = createAppTaskReadTool({
      bus: new EventBus(),
      appId: () => "evaluation",
      reader: {
        list: () => ({ items: [] }),
        get: () => null,
        outcomes: ({ projection }) => {
          requestedProjection = projection;
          return {
            projection: "outcomes",
            manifestVersion: 1,
            sourceCount: 1,
            outcomeCount: 1,
            outcomes: [
              {
                id: "target-outcome",
                outcome: "Resolve the accepted dependency",
                status: "waiting",
                memberCount: 1,
                memberTaskIds: ["target-task"],
                members: [
                  {
                    id: "target-task",
                    status: "waiting",
                    generation: 2,
                    outcome: "Wait for the exact dependency",
                  },
                ],
              },
            ],
          };
        },
      },
    });

    expect(text(await tool.execute("call-unbounded", { action: "outcomes" }))).toEqual({
      error: "taskId is required for outcomes; use list for bounded discovery",
    });
    expect(text(await tool.execute("call-exact", { action: "outcomes", taskId: "target-task" }))).toMatchObject({
      sourceCount: 1,
      outcomeCount: 1,
      outcomes: [{ id: "target-outcome", memberTaskIds: ["target-task"] }],
    });
    expect(requestedProjection).toEqual({ taskId: "target-task" });
  });

  it("rejects cross-App collections instead of silently returning the current App", async () => {
    const tool = createAppTaskReadTool({
      bus: new EventBus(),
      appId: () => "current",
      reader: {
        list: () => {
          throw new Error("wrong App read");
        },
        outcomes: () => {
          throw new Error("wrong App read");
        },
        get: () => null,
      },
    });
    for (const action of ["list", "outcomes"]) {
      expect(
        text(
          await tool.execute("wrong-scope", {
            action,
            taskId: "one",
            target: { appId: "other" },
          }),
        ),
      ).toEqual({
        error: "list and outcomes are scoped to the current App; use get with target.appId for an exact cross-App Task",
      });
    }
  });

  it("refuses reads outside an App Task scope", async () => {
    const tool = createAppTaskReadTool({
      bus: new EventBus(),
      appId: () => undefined,
      reader: {
        list: () => {
          throw new Error("must not run");
        },
        get: () => {
          throw new Error("must not run");
        },
      },
    });

    expect(text(await tool.execute("call", { action: "list" }))).toEqual({ error: "No current App Task scope" });
  });

  it("publishes only from the current fenced Task attempt", async () => {
    const calls: unknown[] = [];
    const tool = createAppTaskReadTool({
      bus: new EventBus(),
      scope: () => ({ appId: "evaluation", taskId: "review", generation: 2, attemptId: "attempt-7" }),
      publisher: {
        publish(input) {
          calls.push(input);
          return 91;
        },
      },
    });

    expect(
      text(
        await tool.execute("call-publish", {
          action: "publish",
          localKey: "finding-1",
          eventType: "review.finding",
          data: { summary: "One mismatch" },
        }),
      ),
    ).toEqual({ eventId: 91, type: "review.finding" });
    expect(calls).toEqual([
      expect.objectContaining({
        binding: { appId: "evaluation", taskId: "review", generation: 2, attemptId: "attempt-7" },
        localKey: "finding-1",
        event: { type: "review.finding", data: { summary: "One mismatch" } },
      }),
    ]);
  });

  it("requires the current Task fence and input before resolving communication", async () => {
    const binding = { appId: "sample", taskId: "work", generation: 2, attemptId: "attempt-1" };
    const cases = [
      { scope: { appId: "sample" }, inputId: "ask" },
      { scope: { ...binding, taskId: undefined }, inputId: "ask" },
      { scope: { ...binding, generation: undefined }, inputId: "ask" },
      { scope: { ...binding, attemptId: undefined }, inputId: "ask" },
      { scope: binding, inputId: undefined },
    ];
    let resolved = 0;
    for (const { scope, inputId } of cases) {
      const tool = createAppTaskReadTool({
        bus: new EventBus(),
        scope: () => scope,
        communicationReader: () => {
          resolved++;
          return undefined;
        },
      });
      expect(text(await tool.execute("read", { action: "communication", inputId }))).toEqual({
        error: "communication requires a current Task attempt and inputId",
      });
    }
    expect(resolved).toBe(0);
  });

  it("resolves communication on each call, forwards queries and never falls back to an earlier reader", async () => {
    const calls: unknown[] = [];
    let attemptId = "attempt-1";
    let read: TaskAttempt["read"]["communication"] = async (inputId, query) => {
      calls.push({ attemptId: "attempt-1", inputId, query });
      return { id: "first-request" };
    };
    const tool = createAppTaskReadTool({
      bus: new EventBus(),
      scope: () => ({ appId: "sample", taskId: "work", generation: 2, attemptId }),
      communicationReader: () => read,
    });
    const query = { action: "request", id: "first-request" };
    expect(
      text(await tool.execute("first", { action: "communication", inputId: "first-input", communicationQuery: query })),
    ).toEqual({ id: "first-request" });

    attemptId = "attempt-2";
    read = undefined;
    expect(text(await tool.execute("unavailable", { action: "communication", inputId: "second-input" }))).toEqual({
      error: "Current Task communication reader is unavailable",
    });
    read = async () => {
      throw new Error("Task attempt is closed");
    };
    expect(text(await tool.execute("closed", { action: "communication", inputId: "first-input" }))).toEqual({
      error: "Task attempt is closed",
    });
    read = async (inputId, query) => {
      calls.push({ attemptId: "attempt-2", inputId, query });
      return { id: "second-discussion" };
    };
    expect(text(await tool.execute("second", { action: "communication", inputId: "second-input" }))).toEqual({
      id: "second-discussion",
    });
    expect(calls).toEqual([
      { attemptId: "attempt-1", inputId: "first-input", query },
      { attemptId: "attempt-2", inputId: "second-input", query: undefined },
    ]);
  });

  it("does not publish from an App-scoped session without a current attempt", async () => {
    const tool = createAppTaskReadTool({
      bus: new EventBus(),
      scope: () => ({ appId: "evaluation" }),
      publisher: {
        publish() {
          throw new Error("must not run");
        },
      },
    });

    expect(
      text(
        await tool.execute("call-publish", {
          action: "publish",
          localKey: "finding-1",
          eventType: "review.finding",
        }),
      ),
    ).toEqual({ error: "No current fenced Task attempt" });
  });
});
