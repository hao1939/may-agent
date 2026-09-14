import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { createAgentRun } from "../../src/lib/agent-runner.js";
import { SubagentManager } from "../../src/lib/manager.js";
import { currentAgentSessionId } from "../../src/lib/agent-session-context.js";
import { createWorkflowRunner } from "../../src/lib/workflow-tool.js";
import { createRunCliAgentTool } from "../../src/lib/tools/run-cli-agent.js";
import { drainBashProcessGroup } from "../../src/lib/tools/bash.js";
import { closeDb } from "../../src/lib/requests.js";
import { readSessionBashProcessGroups } from "../../src/lib/persistence.js";
import { fakeModel } from "../fixtures/model.js";

// Synthetic provider responses, real workflow/manager/agent/tool/process paths.
test.each(["complete", "cancel"] as const)(
  "workflow -> agent -> native CLI: %s",
  async (mode) => {
    const root = mkdtempSync(join(tmpdir(), "may-execution-composition-"));
    const persistDir = join(root, ".state");
    const controller = new AbortController();
    const ready = Promise.withResolvers<void>();
    const exited = Promise.withResolvers<void>();
    const model = fakeModel();
    let pid: number | undefined;
    let sessionId: string | undefined;
    let modelCalls = 0;
    const cli = createRunCliAgentTool({
      agentName: "worker",
      projectRoot: root,
      persistDir,
      getCallerSessionId: () => currentAgentSessionId("worker"),
      spawnCommand: ((_command, args, options) => {
        sessionId = currentAgentSessionId("worker");
        const child = spawn(
          process.execPath,
          [
            fileURLToPath(new URL("../fixtures/native-cli.cjs", import.meta.url)),
            JSON.stringify({
              tool: "codex",
              hang: mode === "cancel",
              text: "Fixture verified",
              resultPath: (args as string[])[(args as string[]).indexOf("-o") + 1],
            }),
          ],
          options,
        );
        pid = child.pid;
        child.stdout?.on("data", (chunk) => {
          if (String(chunk).includes("fixture.ready")) ready.resolve();
        });
        child.on("exit", () => exited.resolve());
        return child;
      }) as typeof spawn,
    });
    const manager = new SubagentManager({
      persistDir,
      agentRunFactory: (config) =>
        createAgentRun({
          ...config,
          streamFn: () => {
            const step = ++modelCalls;
            const message: AssistantMessage = {
              role: "assistant",
              api: model.api,
              provider: model.provider,
              model: model.id,
              content:
                step === 1
                  ? [
                      {
                        type: "toolCall",
                        id: "native",
                        name: "run_cli_agent",
                        arguments: {
                          tool: "codex",
                          prompt: "Read fixture facts",
                          timeoutMs: 10_000,
                        },
                      },
                    ]
                  : step === 2
                    ? [
                        {
                          type: "toolCall",
                          id: "finish",
                          name: "finish",
                          arguments: {
                            status: "success",
                            summary: "Fixture verified",
                            verification_facts: ["Native fixture returned its result"],
                            result: { verified: true },
                          },
                        },
                      ]
                    : [{ type: "text", text: "Fixture verified" }],
              stopReason: step <= 2 ? "toolUse" : "stop",
              timestamp: Date.now(),
              usage: {
                input: 0,
                output: 0,
                totalTokens: 0,
                cacheRead: 0,
                cacheWrite: 0,
                cost: { input: 0, output: 0, total: 0, cacheRead: 0, cacheWrite: 0 },
              },
            };
            const stream = createAssistantMessageEventStream();
            stream.push({ type: "done", reason: step <= 2 ? "toolUse" : "stop", message });
            return stream;
          },
        }),
    });
    manager.register({ name: "worker", description: "Fixture helper", domain: "test", tools: [cli], model });
    writeFileSync(
      join(root, "inspect.ts"),
      `
export const name = "inspect";
export const description = "One scoped helper";
export async function execute(ctx) {
  const result = await ctx.agents.call("worker", "Inspect fixture facts");
  return result.status === "done" ? ctx.done(result.summary, result.output) : ctx.blocked(result.summary);
}`,
    );
    const binding = { appId: "fixture", taskId: "inspect", generation: 1, attemptId: "attempt-1" };
    const workflow = createWorkflowRunner({
      manager,
      workflowDir: root,
      persistDir,
      agentName: "owner",
      signal: controller.signal,
      taskBinding: binding,
      executionTimeoutMs: 15_000,
    });
    const running = workflow.run("inspect", "test");
    try {
      if (mode === "cancel") {
        await ready.promise;
        expect(sessionId).toBeDefined();
        expect(manager.activeSessions.get(sessionId!)?.taskBinding).toEqual(binding);
        controller.abort(new Error("Owner cancelled"));
      }
      const result = await running;
      await exited.promise;
      expect(result).toMatchObject(
        mode === "complete"
          ? { type: "done", output: { verified: true } }
          : { type: "error", error: "Owner cancelled" },
      );
      expect(manager.status()).toEqual([]);
      expect(readSessionBashProcessGroups(persistDir, sessionId!)).toEqual([]);
      expect(() => process.kill(pid!, 0)).toThrow();
      expect(modelCalls).toBeLessThanOrEqual(3);
    } finally {
      controller.abort();
      await running;
      if (pid) await drainBashProcessGroup(pid);
      closeDb(persistDir);
      rmSync(root, { recursive: true, force: true });
    }
  },
  20_000,
);
