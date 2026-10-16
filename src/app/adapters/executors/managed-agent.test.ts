import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTaskAgentRunner } from "./managed-agent.js";
import type { SubagentManager } from "../../../lib/manager.js";
import type { TaskAgentInput } from "../../core/tasks/execution.js";
import { appTaskExecutionPaths, withAppTaskWorkspace } from "../../core/tasks/app-task-output-paths.js";
import { executePreparedAgent, prepareAgentExecution } from "../../../lib/agent-execution.js";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { usageReply } from "../../../../test/fixtures/execution-usage.js";
import type { CallAgentOptions } from "../../../lib/manager.js";
import type { SubagentDefinition } from "../../../lib/types.js";
import { createWriteTool } from "../../../lib/tools/write.js";
import { createFinishTool } from "../../../lib/tools/lifecycle.js";

test.each(["success", "partial", "blocked", "failure"])("a valid %s report retains useful work and the Task's continuation decision", async (status) => {
  const root = mkdtempSync(join(tmpdir(), "may-task-report-"));
  try {
    const report = {
      state: "waiting", continue: true, summary: "Patch written; verification remains.",
      facts: ["Patch saved"], result: { changes: ["parser.ts"] },
    };
    let calls = 0;
    const runner = createTaskAgentRunner({ manager: {
      callAgent: async (_agent: string, task: string, options: CallAgentOptions) => {
        const prepared = prepareAgentExecution({
          ...options, task, projectRoot: root, sessionId: "report-fixture",
          definition: { name: "worker", description: "fixture", domain: "test", tools: [],
            model: { api: "openai-responses", provider: "fixture", id: "model-a" } as SubagentDefinition["model"] },
          createFinish: () => createFinishTool({ agentName: "worker", projectRoot: root }),
        });
        prepared.runner.streamFn = () => {
          calls++;
          const stream = createAssistantMessageEventStream();
          stream.push({ type: "done", reason: "toolUse", message: usageReply({
            stopReason: "toolUse", content: [{ type: "toolCall", id: "report", name: "finish",
              arguments: { status, summary: report.summary, result: report } }],
          }) });
          return stream;
        };
        const result = await executePreparedAgent(prepared);
        return { ...result, sessionId: prepared.sessionId, duration: "0s", outputDir: root };
      },
    } as unknown as SubagentManager });
    const result = await runner.execute({
      descriptor: { id: "sample", app: {} },
      attempt: { read: { tasks: {} },
        task: { id: "work", generation: 1, outcome: "Implement and test", acceptance: [] },
        role: { agent: "worker", instructions: "Implement and test" }, events: { items: [] }, waits: {} },
      executionPaths: { projectDir: root, workspaceDir: root },
      childContext: { live: [], completed: [] }, dependencies: [],
    } as unknown as TaskAgentInput);
    expect(calls).toBe(1);
    expect(result.executionFailed).toBeUndefined();
    expect(result.handlerResult).toMatchObject(report);
    expect(result.handlerResult.result).not.toHaveProperty("testResults");
    expect(result.handlerResult.actions).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test.each([false, true])("managed Task passes policy scope through real preparation (checkout=%s)", async (checkout) => {
  const root = mkdtempSync(join(tmpdir(), "may-managed-policy-"));
  try {
    const appDir = join(root, "projects", "sample.app");
    const projectDir = join(root, "projects", "sample");
    mkdirSync(appDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    const paths = appTaskExecutionPaths(appDir, projectDir);
    const executionPaths = checkout ? withAppTaskWorkspace(paths, join(root, "checkout")) : paths;
    const definition: SubagentDefinition = {
      name: "maintainer", description: "fixture", domain: "test", model: { contextWindow: 10000 } as any,
      projectRoot: appDir, tools: [createWriteTool(appDir)],
      fileWritePolicy: { root, protectedPaths: [], grants: [{ paths: ["agents/*/agent.json"], writers: ["maintainer"] }] },
    };
    let preparedCount = 0;
    const runner = createTaskAgentRunner({ manager: {
      callAgentDefinition: async (selected: SubagentDefinition, task: string, options: CallAgentOptions) => {
        const prepared = prepareAgentExecution({ ...options, definition: selected, task,
          projectRoot: root, sessionId: "fixture", createFinish: () => createFinishTool({ agentName: selected.name, projectRoot: root }) });
        const write = prepared.tools.find(tool => tool.name === "write")!;
        const result = await write.execute("probe", { path: "agents/worker/agent.json", content: "{}" });
        expect(result.content).toMatchObject([{ type: "text", text: expect.stringContaining("WRITE BLOCKED") }]);
        preparedCount++;
        return { status: "done", sessionId: "fixture", structuredResult: { state: "converged", summary: "Scope checked", facts: [] } };
      },
    } as unknown as SubagentManager }, new Map([[definition.name, definition]]));
    const input = {
      descriptor: { id: "sample", app: {} },
      attempt: { read: { tasks: {} },
        task: { id: "work", generation: 1, outcome: "Inspect policy", acceptance: [] },
        role: { agent: definition.name, instructions: "Inspect policy" }, events: { items: [] }, waits: {} },
      executionPaths, childContext: { live: [], completed: [] }, dependencies: [],
    } as unknown as TaskAgentInput;
    expect((await runner.execute(input)).handlerResult.state).toBe("converged");
    expect(preparedCount).toBe(1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test.each(["event", "continued-input"])("generic agent execution carries %s facts without reading private deployment files", async (source) => {
  const root = mkdtempSync(join(tmpdir(), "may-generic-agent-evidence-"));
  try {
    const receipts = join(root, ".state", "deploy-receipts");
    mkdirSync(receipts, { recursive: true });
    // Previously this file selected a deployment prompt for an unrelated App.
    writeFileSync(
      join(receipts, "private.json"),
      JSON.stringify({
        version: 1,
        project: "maintenance",
        taskId: "work",
        correlation: "private-correlation",
        artifactSha: "private-artifact",
        phase: "requested",
        requestedAt: new Date().toISOString(),
      }),
    );
    let prompt = "";
    const runner = createTaskAgentRunner({
      manager: {
        callAgent: async (_agent: string, text: string, options: { validateOutput: (value: unknown) => string | null }) => {
          expect(options.validateOutput({ state: "waiting", summary: "Pending", facts: [], conditions: [{
            id: "sample", type: "sample.state", subject: "sample:1", owner: "app:example", expected: {},
          }] })).toContain("expected.state must be ready");
          expect(options.validateOutput({ state: "waiting", summary: "Pending", facts: [], conditions: [{
            id: "sample", type: "sample.state", subject: "sample:1", owner: "app:example", expected: { state: "ready" },
          }] })).toBeNull();
          prompt = text;
          return {
            status: "done",
            sessionId: "fixture",
            structuredResult: {
              state: "converged",
              summary: "Observed operation",
              facts: ["event:1"],
            },
          };
        },
      } as unknown as SubagentManager,
    });
    const input = {
      descriptor: { id: "example", app: { tasks: {
        validateCondition: (condition: { expected: { state?: string } }) =>
          condition.expected.state === "ready" ? null : "expected.state must be ready",
      } } },
      attempt: {
        read: { tasks: {} },
        task: { id: "work", generation: 1, outcome: "Inspect evidence", acceptance: [] },
        role: { agent: "worker", instructions: "Inspect ordinary facts" },
        events: {
          items: [
            {
              eventId: 1,
              event: {
                type: "deployment.settled",
                data: {
                  reason: "restart-aware-deploy-receipt",
                  deploymentReceipt: { correlation: "event-correlation", phase: "succeeded" },
                },
              },
            },
          ],
        },
        waits: {},
      },
      executionPaths: { projectDir: root, workspaceDir: root },
      childContext: { live: [], completed: [] },
      dependencies: [],
    } as unknown as TaskAgentInput;
    if (source === "continued-input") {
      input.attempt.events = {
        items: [], truncated: false,
        continuedInputs: [{ observedAt: new Date().toISOString(), event: {
          type: "app.task.requested", data: { idempotencyKey: "original-review", input: { kind: "message", data: { text: "Review the original artifact" } } },
        } }],
      };
    }
    const result = await runner.execute(input);
    expect(result.handlerResult).toMatchObject({
      state: "converged",
      summary: "Observed operation",
      facts: ["event:1"],
    });
    expect(prompt).toContain(source === "event" ? "event-correlation" : "Review the original artifact");
    expect(prompt).not.toContain("private-correlation");
    expect(prompt).not.toContain("Restart-aware deploy receipt");
    expect(prompt).not.toContain("Do not deploy again");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
