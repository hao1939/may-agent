import { afterEach, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAssistantMessageEventStream, type AssistantMessage, type Model } from "@earendil-works/pi-ai";
import { createAgentRun } from "./agent-runner.js";
import { createRunCliAgentTool } from "./tools/run-cli-agent.js";
import { SubagentManager } from "./manager.js";
import { closeAllDbs, getDb, upsertSession } from "./requests.js";
import { readSessionBashProcessGroups } from "./persistence.js";
import { EventBus } from "../app/core/events/bus.js";
import { drainBashProcessGroup } from "./tools/bash.js";

const roots: string[] = [];
const pids: number[] = [];
afterEach(async () => {
  for (const pid of pids.splice(0)) await drainBashProcessGroup(pid);
  closeAllDbs();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test.each(["codex", "claude", "deadline"] as const)(
  "real %s subprocess -> tool updates -> agent loop -> result and stored activity",
  async (mode) => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-progress-"));
    roots.push(root);
    const persistDir = join(root, ".state");
    const sessionId = "caller";
    const bus = new EventBus();
    const runtime = new SubagentManager({ persistDir, bus });
    const tool = createRunCliAgentTool({
      agentName: "owner",
      projectRoot: root,
      persistDir,
      getCallerSessionId: () => sessionId,
      spawnCommand: ((_command, args, options) => {
        const child = spawn(
          process.execPath,
          [
            fileURLToPath(new URL("../../test/fixtures/native-cli.cjs", import.meta.url)),
            JSON.stringify({
              tool: mode === "claude" ? "claude" : "codex",
              delay: 3_400,
              progress: mode,
              resultPath: (args as string[])[(args as string[]).indexOf("-o") + 1],
            }),
          ],
          options,
        );
        if (child.pid) pids.push(child.pid);
        return child;
      }) as typeof spawn,
    });
    const model = { api: "openai-responses", id: "fixture", provider: "fixture" } as Model<"openai-responses">;
    let modelCalls = 0;
    const agent = createAgentRun({
      initialState: { model, tools: [tool] },
      streamFn: () => {
        const first = ++modelCalls === 1;
        const message: AssistantMessage = {
          role: "assistant",
          api: model.api,
          provider: model.provider,
          model: model.id,
          content: first
            ? [
                {
                  type: "toolCall",
                  id: "cli",
                  name: "run_cli_agent",
                  arguments: {
                    tool: mode === "claude" ? "claude" : "codex",
                    prompt: "Return fixture evidence",
                    timeoutMs: mode === "deadline" ? 1_500 : 10_000,
                  },
                },
              ]
            : [{ type: "text", text: "Result received" }],
          stopReason: first ? "toolUse" : "stop",
          timestamp: Date.now(),
          usage: {
            input: 0,
            output: 0,
            totalTokens: 0,
            cacheRead: 0,
            cacheWrite: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
        };
        const stream = createAssistantMessageEventStream();
        stream.push({ type: "done", reason: first ? "toolUse" : "stop", message });
        return stream;
      },
    });
    const active = {
      sessionId,
      agent,
      agentName: "owner",
      definition: { name: "owner" },
      task: "fixture",
      status: "running",
      startedAt: Date.now(),
      kind: "call",
      autoClose: "immediate",
      toolCalls: 0,
      modelStepCount: 0,
      openTurnTraces: [],
      loadedSkillHashes: new Set(),
      requireFinish: false,
      toolPolicy: "full",
    };
    upsertSession(persistDir, {
      sessionId,
      agent: "owner",
      task: "fixture",
      status: "running",
      startedAt: active.startedAt,
    });
    (runtime as any).bridgeEvents(active);
    const activity: Array<{ at: number; ops: number }> = [];
    agent.subscribe((event) => {
      if (event.type === "tool_execution_update") {
        const row = getDb(persistDir)
          .prepare("SELECT lastActivityAt, opCount FROM sessions WHERE sessionId = ?")
          .get(sessionId)!;
        activity.push({ at: Number(row.lastActivityAt), ops: Number(row.opCount) });
      }
    });
    let prompt: Promise<void> | undefined;
    try {
      const work = (runtime as any).withExecutionScope(active, () => (prompt = agent.prompt("Run the fixture")));
      await work;
      expect(modelCalls).toBe(2); // Updates did not ask the model to review.
      expect(activity.length).toBeGreaterThanOrEqual(mode === "deadline" ? 1 : 3);
      expect(activity.length).toBeLessThanOrEqual(4); // Native output is throttled.
      if (mode !== "deadline") expect(activity.at(-1)!.at - activity[0].at).toBeGreaterThan(2_000);
      expect(activity.every((item) => item.ops === 1)).toBe(true);
      const results = agent.state.messages.filter((message) => message.role === "toolResult");
      expect(results).toHaveLength(1); // One direct terminal return, no second notification.
      expect((results[0] as any).details.cliCall).toMatchObject(
        mode === "deadline" ? { status: "failed", failureCategory: "timeout" } : { status: "completed" },
      );
    } finally {
      agent.cancel();
      await prompt;
    }
    expect(readSessionBashProcessGroups(persistDir, sessionId)).toEqual([]);
  },
  15_000,
);
