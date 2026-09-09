import { describe, expect, it } from "bun:test";
import type { TaskOutcomeProjection } from "@may-agent/sdk";
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
        }),
      ),
    ).toMatchObject({ id: "benchmark", status: "done" });
    expect(calls).toEqual([
      expect.objectContaining({ appId: "evaluation", options: { status: ["running"], limit: 10 } }),
      expect.objectContaining({ appId: "evaluation", taskId: "review" }),
      expect.objectContaining({ appId: "gym", taskId: "benchmark" }),
    ]);
  });

  it("requires an exact task for outcome reads and returns only its containing outcome", async () => {
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
            sourceCount: 775,
            outcomeCount: 2,
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
              {
                id: "unrelated-outcome",
                outcome: "Unrelated work",
                status: "waiting",
                memberCount: 774,
                memberTaskIds: ["unrelated-task"],
                members: [
                  {
                    id: "unrelated-task",
                    status: "waiting",
                    generation: 1,
                    outcome: "Unrelated work",
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
