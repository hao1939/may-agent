import { describe, expect, it } from "bun:test";
import {
  CODEX_GOAL_PROGRESS_EVENT,
  CodexGoalProgressPublisher,
  MAX_CODEX_GOAL_PROGRESS_MESSAGE_CHARS,
  projectCodexGoalProgress,
} from "./codex-goal-progress.js";
import type { AppServerNotification } from "./codex-goal-client.js";

function completed(item: Record<string, unknown>): AppServerNotification {
  return {
    method: "item/completed",
    params: { threadId: "thread-1", turnId: "turn-1", completedAtMs: 123, item },
  };
}

describe("Codex goal Task progress", () => {
  it("publishes bounded commentary and plans but never duplicates the final answer", () => {
    const longCommentary = `checking ${"x".repeat(MAX_CODEX_GOAL_PROGRESS_MESSAGE_CHARS + 50)}`;
    const commentary = projectCodexGoalProgress(
      completed({ id: "message-1", type: "agentMessage", phase: "commentary", text: longCommentary }),
    );
    expect(commentary).toMatchObject({
      localKey: "codex-progress:item:thread-1:turn-1:message-1",
      event: {
        type: CODEX_GOAL_PROGRESS_EVENT,
        data: {
          executor: "codex-goal",
          threadId: "thread-1",
          turnId: "turn-1",
          stage: "intermediate",
          itemId: "message-1",
          itemType: "agentMessage",
        },
      },
    });
    expect(String(commentary?.event.data.message)).toHaveLength(MAX_CODEX_GOAL_PROGRESS_MESSAGE_CHARS);
    expect(
      projectCodexGoalProgress(completed({ id: "plan-1", type: "plan", text: "Inspect, compare, report." })),
    ).toMatchObject({
      event: { data: { stage: "intermediate", itemType: "plan", message: "Inspect, compare, report." } },
    });
    expect(
      projectCodexGoalProgress(
        completed({ id: "final-1", type: "agentMessage", phase: "final_answer", text: "terminal secret" }),
      ),
    ).toBeNull();
    expect(
      projectCodexGoalProgress(completed({ id: "legacy-1", type: "agentMessage", text: "unknown phase" })),
    ).toBeNull();
  });

  it("drops successful command/tool noise and keeps failures free of payloads", () => {
    const command = projectCodexGoalProgress(
      completed({
        id: "command-1",
        type: "commandExecution",
        command: "print-secret",
        cwd: "/secret",
        aggregatedOutput: "secret output",
        commandActions: [{ command: "secret" }],
        status: "failed",
        exitCode: 1,
        durationMs: 42,
      }),
    );
    expect(command?.event.data).toEqual({
      executor: "codex-goal",
      threadId: "thread-1",
      turnId: "turn-1",
      stage: "item-completed",
      itemId: "command-1",
      itemType: "commandExecution",
      status: "failed",
      exitCode: 1,
      durationMs: 42,
      message: "Codex reported an unsuccessful command.",
    });
    expect(JSON.stringify(command)).not.toContain("secret");

    const file = projectCodexGoalProgress(
      completed({ id: "file-1", type: "fileChange", status: "completed", changes: [{ diff: "private diff" }] }),
    );
    expect(file?.event.data).toMatchObject({ itemType: "fileChange", status: "completed" });
    expect(JSON.stringify(file)).not.toContain("private diff");

    const tool = projectCodexGoalProgress(
      completed({
        id: "tool-1",
        type: "mcpToolCall",
        server: "docs",
        tool: "search",
        status: "failed",
        durationMs: 8,
        arguments: { query: "secret argument" },
        result: { content: "secret result" },
      }),
    );
    expect(tool?.event.data).toEqual({
      executor: "codex-goal",
      threadId: "thread-1",
      turnId: "turn-1",
      stage: "item-completed",
      itemId: "tool-1",
      itemType: "mcpToolCall",
      server: "docs",
      tool: "search",
      status: "failed",
      durationMs: 8,
      message: "Codex reported an unsuccessful tool call.",
    });
    expect(JSON.stringify(tool)).not.toContain("secret");
    expect(
      projectCodexGoalProgress(
        completed({ id: "ok-command", type: "commandExecution", status: "completed", exitCode: 0 }),
      ),
    ).toBeNull();
    expect(
      projectCodexGoalProgress(completed({ id: "ok-tool", type: "dynamicToolCall", status: "completed" })),
    ).toBeNull();
  });

  it("projects lifecycle and goal status while ignoring stream deltas and reasoning", () => {
    expect(
      projectCodexGoalProgress({
        method: "turn/started",
        params: { threadId: "thread-1", turn: { id: "turn-1", status: "inProgress" } },
      }),
    ).toMatchObject({ event: { data: { stage: "turn-started", status: "inProgress" } } });
    expect(
      projectCodexGoalProgress({
        method: "thread/goal/updated",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          goal: { status: "active", updatedAt: 20, tokensUsed: 120, timeUsedSeconds: 3, objective: "private" },
        },
      }),
    ).toMatchObject({
      localKey: "codex-progress:goal-status:thread-1:turn-1:active",
      event: { data: { stage: "goal-status", status: "active", tokensUsed: 120, timeUsedSeconds: 3 } },
    });
    expect(
      projectCodexGoalProgress({
        method: "turn/completed",
        params: { threadId: "thread-1", turn: { id: "turn-1", status: "completed", error: "private" } },
      }),
    ).toMatchObject({ event: { data: { stage: "turn-completed", status: "completed" } } });
    expect(
      projectCodexGoalProgress({
        method: "item/agentMessage/delta",
        params: { threadId: "thread-1", turnId: "turn-1", itemId: "message-1", delta: "noise" },
      }),
    ).toBeNull();
    expect(projectCodexGoalProgress(completed({ id: "reason-1", type: "reasoning", content: ["private"] }))).toBeNull();
  });

  it("serializes publication, deduplicates keys, retains newest queued progress, and never adds a target", async () => {
    const published: Array<{ localKey: string; event: Record<string, unknown> }> = [];
    const publisher = new CodexGoalProgressPublisher({
      maxEvents: 2,
      async publish(localKey, event) {
        published.push({ localKey, event });
        return { eventId: published.length };
      },
    });
    const first = completed({ id: "message-1", type: "agentMessage", phase: "commentary", text: "First" });
    publisher.observe(first);
    publisher.observe(first);
    publisher.observe(completed({ id: "plan-1", type: "plan", text: "Second" }));
    publisher.observe(completed({ id: "command-1", type: "commandExecution", status: "failed", exitCode: 1 }));

    // Publication begins on the microtask queue, not in the protocol callback.
    expect(published).toEqual([]);
    expect(await publisher.flush()).toEqual({ queued: 3, published: 2, failed: 0, dropped: 1 });
    expect(published).toHaveLength(2);
    expect(published.map(({ localKey }) => localKey)).toEqual([
      "codex-progress:item:thread-1:turn-1:plan-1",
      "codex-progress:item:thread-1:turn-1:command-1",
    ]);
    expect(published.every(({ event }) => !("target" in event))).toBe(true);
  });

  it("keeps publishing beyond 64 lifetime observations across an ongoing attempt", async () => {
    const published: string[] = [];
    const publisher = new CodexGoalProgressPublisher({
      async publish(localKey) {
        published.push(localKey);
        return { eventId: published.length };
      },
    });
    for (let index = 0; index < 130; index += 1) {
      publisher.observe(completed({ id: `plan-${index}`, type: "plan", text: `Progress ${index}` }));
      await publisher.flush();
    }
    expect(await publisher.flush()).toEqual({ queued: 130, published: 130, failed: 0, dropped: 0 });
    expect(published.at(-1)).toBe("codex-progress:item:thread-1:turn-1:plan-129");
  });

  it("bounds a slow store's backlog while flushing the latest observation", async () => {
    let release!: () => void;
    let started!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const firstStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const published: string[] = [];
    let publishing = false;
    const publisher = new CodexGoalProgressPublisher({
      maxEvents: 3,
      async publish(localKey) {
        expect(publishing).toBe(false);
        publishing = true;
        if (published.length === 0) {
          started();
          await blocked;
        }
        published.push(localKey);
        publishing = false;
        return { eventId: published.length };
      },
    });
    publisher.observe(completed({ id: "first", type: "plan", text: "First" }));
    await firstStarted;
    for (let index = 0; index < 1000; index += 1) {
      publisher.observe(completed({ id: `plan-${index}`, type: "plan", text: `Progress ${index}` }));
    }
    release();
    expect(await publisher.flush()).toEqual({ queued: 1001, published: 4, failed: 0, dropped: 997 });
    expect(published.at(-1)).toBe("codex-progress:item:thread-1:turn-1:plan-999");
    // Capacity becomes available again without a new publisher or attempt.
    publisher.observe(completed({ id: "later", type: "plan", text: "Continuing" }));
    expect(await publisher.flush()).toMatchObject({ published: 5, dropped: 997 });
    expect(published.at(-1)).toBe("codex-progress:item:thread-1:turn-1:later");
  });

  it("compacts opaque item identities without weakening stable-key uniqueness", () => {
    const sharedPrefix = "opaque/".repeat(100);
    const first = projectCodexGoalProgress(completed({ id: `${sharedPrefix}one`, type: "plan", text: "First" }));
    const second = projectCodexGoalProgress(completed({ id: `${sharedPrefix}two`, type: "plan", text: "Second" }));
    expect(first?.event.data.itemId).toMatch(/^sha256:[a-f0-9]{32}$/);
    expect(second?.event.data.itemId).toMatch(/^sha256:[a-f0-9]{32}$/);
    expect(first?.localKey).not.toBe(second?.localKey);
    expect(first?.localKey.length).toBeLessThanOrEqual(240);
  });

  it("deduplicates repeated goal-status heartbeats and numbers genuine transitions on the local stream", async () => {
    const published: Array<{ localKey: string; status: unknown }> = [];
    const publisher = new CodexGoalProgressPublisher({
      async publish(localKey, event) {
        published.push({ localKey, status: event.data.status });
        return { eventId: published.length };
      },
    });
    for (const [status, updatedAt] of [
      ["active", 10],
      ["active", 10],
      ["active", 20],
      ["paused", 20],
      ["paused", 20],
      ["active", 20],
      ["complete", 30],
    ] as const) {
      publisher.observe({
        method: "thread/goal/updated",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          goal: { status, updatedAt, tokensUsed: updatedAt * 10 },
        },
      });
    }
    expect(await publisher.flush()).toMatchObject({ queued: 4, published: 4, dropped: 0 });
    expect(published).toEqual([
      { localKey: "codex-progress:goal-status:thread-1:turn-1:active", status: "active" },
      { localKey: "codex-progress:goal-status:thread-1:turn-1:paused:2", status: "paused" },
      { localKey: "codex-progress:goal-status:thread-1:turn-1:active:3", status: "active" },
      { localKey: "codex-progress:goal-status:thread-1:turn-1:complete:4", status: "complete" },
    ]);
  });

  it("preserves durable idempotency after the bounded recent-key cache rolls over", async () => {
    const persisted = new Map<string, number>();
    const publisher = new CodexGoalProgressPublisher({
      async publish(localKey) {
        if (!persisted.has(localKey)) persisted.set(localKey, persisted.size + 1);
        return { eventId: persisted.get(localKey)! };
      },
    });
    const first = completed({ id: "plan-0", type: "plan", text: "First" });
    for (let index = 0; index < 300; index += 1) {
      publisher.observe(completed({ id: `plan-${index}`, type: "plan", text: `Progress ${index}` }));
      await publisher.flush();
    }
    publisher.observe(first);
    await publisher.flush();
    expect(persisted.size).toBe(300);
    expect(persisted.get("codex-progress:item:thread-1:turn-1:plan-0")).toBe(1);
  });

  it("continues after a publication failure and reports observation degradation", async () => {
    let calls = 0;
    const publisher = new CodexGoalProgressPublisher({
      async publish() {
        calls += 1;
        if (calls === 1) throw new Error("event store unavailable");
        return { eventId: calls };
      },
    });
    publisher.observe(completed({ id: "plan-1", type: "plan", text: "First" }));
    publisher.observe(completed({ id: "plan-2", type: "plan", text: "Second" }));
    expect(await publisher.flush()).toEqual({
      queued: 2,
      published: 1,
      failed: 1,
      dropped: 0,
      lastError: "event store unavailable",
    });
  });

  it("scopes durable keys to one reconcile attempt", async () => {
    const published: string[] = [];
    const publisher = new CodexGoalProgressPublisher({
      keyScope: "r_7_retry",
      async publish(localKey) {
        published.push(localKey);
        return { eventId: 1 };
      },
    });
    publisher.observe({
      method: "thread/goal/updated",
      params: { threadId: "thread-1", goal: { status: "active", tokensUsed: 10 } },
    });
    await publisher.flush();
    expect(published).toEqual(["codex-progress:goal-status:thread-1:none:active:attempt:r_7_retry"]);
  });
});
