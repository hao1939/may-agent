import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { EventBus, eventData, type AgentEvent } from "./event-bus.js";
import { executeTaskWithCli } from "./app-task-cli-executor.js";

describe("Task CLI executor adapter", () => {
  it("returns the CLI JSON through the caller-owned Task result boundary", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-cli-executor-"));
    const bus = new EventBus();
    bus.subscribeDurableRoute((event) => {
      if (event.type !== "cli.task.requested") return;
      const data = eventData(event) as Record<string, unknown>;
      expect(readFileSync(String(data.promptPath), "utf8")).toContain("bounded task");
      writeFileSync(
        String(data.resultPath),
        JSON.stringify({ state: "converged", summary: "done", evidence: ["proof"] }),
      );
      setImmediate(() =>
        bus.emit({
          type: "cli.task.completed",
          source: "cli-task-runner",
          owner: "agent:may",
          data: {
            taskId: String(data.taskId),
            tool: "codex",
            resultPath: String(data.resultPath),
            eventsPath: String(data.eventsPath),
            exitCode: 0,
            summary: "done",
          },
        } as AgentEvent),
      );
      return { accepted: true, by: "test-cli" };
    });

    const result = await executeTaskWithCli({
      bus,
      persistDir: root,
      appId: "sample",
      taskId: "task-1",
      generation: 2,
      attemptId: "attempt-1",
      owner: "may",
      tool: "codex",
      cwd: root,
      prompt: "perform the bounded task",
      timeoutMs: 1_000,
    });

    expect(result).toMatchObject({
      status: "completed",
      result: { state: "converged", summary: "done", evidence: ["proof"] },
    });
  });

  it("turns malformed CLI output into an attempt failure", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-cli-invalid-"));
    const bus = new EventBus();
    bus.subscribeDurableRoute((event) => {
      if (event.type !== "cli.task.requested") return;
      const data = eventData(event) as Record<string, unknown>;
      writeFileSync(String(data.resultPath), "not json");
      setImmediate(() =>
        bus.emit({
          type: "cli.task.completed",
          source: "cli-task-runner",
          owner: "agent:may",
          data: {
            taskId: String(data.taskId),
            tool: "claude",
            resultPath: String(data.resultPath),
            exitCode: 0,
            summary: "invalid",
          },
        } as AgentEvent),
      );
      return { accepted: true, by: "test-cli" };
    });

    await expect(
      executeTaskWithCli({
        bus,
        persistDir: root,
        appId: "sample",
        taskId: "task-1",
        generation: 2,
        attemptId: "attempt-2",
        owner: "may",
        tool: "claude",
        cwd: root,
        prompt: "perform the bounded task",
        timeoutMs: 1_000,
      }),
    ).resolves.toMatchObject({ status: "failed", summary: expect.stringContaining("invalid Task result") });
  });
});
