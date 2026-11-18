import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { Type } from "typebox";
import { defineApp } from "@may-agent/sdk/app";
import { createAgentRun } from "@may-agent/sdk/runtime";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTaskAgentRunner } from "./managed-agent.js";
import { runTaskAgent } from "../../core/tasks/attempt-execution.js";
import type { SubagentManager } from "../../../lib/manager.js";
import type { TaskAgentInput } from "../../core/tasks/execution.js";
import { appTaskExecutionPaths, withAppTaskWorkspace } from "../../core/tasks/app-task-output-paths.js";
import { executePreparedAgent, prepareAgentExecution } from "../../../lib/agent-execution.js";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { usageReply } from "../../../../test/fixtures/execution-usage.js";
import { fakeModel } from "../../../../test/fixtures/model.js";
import type { CallAgentOptions } from "../../../lib/manager.js";
import type { SubagentDefinition } from "@may-agent/sdk/runtime";
import { createWriteTool } from "@may-agent/sdk/runtime";
import { createFinishTool } from "@may-agent/sdk/runtime";
import { SubagentManager } from "../../../lib/manager.js";
import { EventBus } from "../../core/events/bus.js";
import { AppRegistry } from "../../core/apps/registry.js";
import { closeInstalledAppTaskRuntimes, installAppTaskRuntimes } from "../../core/tasks/app-task-runtime.js";
import { closeDb } from "../../../lib/db/connection.js";

test.each(["done", "blocked"])("a valid %s report retains useful work and the Task's continuation decision", async (status) => {
  const root = mkdtempSync(join(tmpdir(), "may-task-report-"));
  try {
    const report = {
      state: "waiting", continue: true, summary: "Patch written; verification remains.",
      facts: ["Patch saved"], result: { changes: ["parser.ts"] },
    };
    const blockedFacts = { payload: "x".repeat(9000) };
    let calls = 0;
    const runner = createTaskAgentRunner({ manager: {
      callAgent: async (_agent: string, task: string, options: CallAgentOptions) => {
        const prepared = prepareAgentExecution({
          ...options, task, projectRoot: root, sessionId: "report-fixture",
          definition: { name: "worker", description: "fixture", domain: "test", tools: [],
            model: { api: "openai-responses", provider: "fixture", id: "model-a" } as SubagentDefinition["model"] },
          createFinish: () => createFinishTool({ projectRoot: root }),
        });
        prepared.runner.streamFn = () => {
          calls++;
          const stream = createAssistantMessageEventStream();
          stream.push({ type: "done", reason: "toolUse", message: usageReply({
            stopReason: "toolUse", content: [{ type: "toolCall", id: "report", name: "finish",
              arguments: {
                status,
                summary: report.summary,
                output: report,
                ...(status === "blocked" ? { facts: blockedFacts } : {}),
              } }],
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
    if (status === "done") {
      expect(result.handlerResult).toMatchObject(report);
      expect(result.handlerResult.result).not.toHaveProperty("testResults");
    } else {
      expect(result).toMatchObject({
        handlerBlocked: true,
        handlerResult: {
          state: "waiting",
          summary: report.summary,
          result: report,
          facts: [`execution-facts:${JSON.stringify(blockedFacts)}`],
        },
      });
      expect(result.handlerResult.facts[0]).not.toContain("workflow-run:");
    }
    expect(result.handlerResult.actions).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Task roots resolve and dispatch same-name agents only inside the owning App namespace", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-managed-task-namespace-"));
  try {
    const selected: string[] = [];
    const definitions = new Map<string, SubagentDefinition>([
      ["alpha/worker", {
        name: "worker", description: "Alpha worker", domain: "test", model: fakeModel(), tools: [],
        appLocal: true, projectId: "alpha", systemPrompt: "You are Alpha worker.",
      }],
      ["beta/worker", {
        name: "worker", description: "Beta worker", domain: "test", model: fakeModel(), tools: [],
        appLocal: true, projectId: "beta", systemPrompt: "You are Beta worker.",
      }],
    ]);
    const runner = createTaskAgentRunner({ manager: {
      callAgentDefinition: async (definition: SubagentDefinition, _task: string, options: CallAgentOptions) => {
        selected.push(`${definition.projectId}/${definition.name}`);
        expect(options.taskContext?.agentDefinitions).toBe(definitions);
        return {
          status: "done", sessionId: `s_${definition.projectId}`, messages: [], duration: "0s", outputDir: root,
          finishResult: { status: "done", summary: `${definition.projectId} complete` },
          structuredResult: { state: "converged", summary: `${definition.projectId} complete`, facts: [] },
        };
      },
    } as unknown as SubagentManager }, definitions);

    for (const appId of ["alpha", "beta"] as const) {
      const result = await runTaskAgent({
        opts: { agents: runner },
        descriptor: { id: appId, appDir: root, projectDir: root, app: {} },
        claim: { agent: "worker" },
        attempt: {
          maxAttemptMs: 1_000,
          read: { tasks: {} }, task: { id: "root", generation: 1, outcome: "Run", acceptance: [] },
          role: { agent: "worker", instructions: "unscoped" }, events: { items: [] }, waits: {},
        },
        executionPaths: { appDir: root, projectDir: root, workspaceDir: root },
        childContext: { live: [], completed: [] }, taskSnapshot: { live: [], truncated: false },
        taskEvents: {} as never, acceptedLiveEventIds: () => [], sessionStarted: () => {},
      } as any);
      expect(result.handlerResult).toMatchObject({ state: "converged", summary: `${appId} complete` });
    }
    expect(selected).toEqual(["alpha/worker", "beta/worker"]);
    expect(runner.role("alpha/worker")).toEqual({ agent: "alpha/worker", instructions: "You are Alpha worker." });
    expect(runner.role("beta/worker")).toEqual({ agent: "beta/worker", instructions: "You are Beta worker." });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("App installation prepares and publishes a local Task agent despite a loaded global namesake", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-managed-app-fallback-"));
  const projectsRoot = join(root, "projects");
  const appDir = join(projectsRoot, "alpha.app");
  const agentDir = join(appDir, "agents", "worker-profile");
  const persistDir = join(root, "state");
  const bus = new EventBus();
  let manager: SubagentManager | undefined;
  try {
    mkdirSync(agentDir, { recursive: true });
    mkdirSync(join(appDir, "tasks"), { recursive: true });
    writeFileSync(join(agentDir, "agent.json"), JSON.stringify({ name: "worker" }));
    writeFileSync(join(appDir, "tasks", "seed.json"), JSON.stringify({
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null } },
    }));

    manager = new SubagentManager({
      persistDir,
      bus,
      agentRunFactory: (config) => createAgentRun({
        ...config,
        streamFn: (model) => {
          const stream = createAssistantMessageEventStream();
          stream.push({
            type: "done",
            reason: "toolUse",
            message: usageReply({
              api: model.api,
              provider: model.provider,
              model: model.id,
              stopReason: "toolUse",
              content: [{
                type: "toolCall",
                id: "finish-alpha",
                name: "finish",
                arguments: {
                  status: "done",
                  summary: "Alpha Task complete",
                  output: {
                    state: "converged",
                    summary: "Alpha Task complete",
                    facts: ["agent:alpha"],
                    result: { owner: model.id },
                  },
                },
              }],
            }),
          });
          return stream;
        },
      }),
    });
    const common = {
      name: "worker", description: "Worker", domain: "fixture", tools: [], projectRoot: root,
    };
    manager.register({
      ...common, model: { ...fakeModel(), id: "global" }, systemPrompt: "Global instructions",
    });
    const registrations: Array<{ agent: string; appDir: string; agentDir?: string }> = [];
    const runner = createTaskAgentRunner({
      manager,
      registerLocalAgent: async (agent, selectedAppDir, resolvedDir) => {
        registrations.push({ agent, appDir: selectedAppDir, agentDir: resolvedDir });
        if (agent !== "worker" || selectedAppDir !== appDir || resolvedDir !== agentDir) return false;
        manager!.register({
          ...common,
          appLocal: true,
          projectId: "alpha",
          agentDir,
          model: { ...fakeModel(), id: "alpha" },
          systemPrompt: "Alpha instructions",
        });
        return true;
      },
    });
    const app = defineApp({
      id: "alpha",
      agent: "worker",
      version: 1,
      inputSchema: Type.Object({ kind: Type.String(), data: Type.Unknown() }),
      task: () => ({
        kind: "desired",
        intent: {
          id: "work",
          parentId: "root",
          agent: "worker",
          outcome: "Prove local fallback",
          acceptance: ["Alpha executes"],
        },
      }),
      tasks: { maxConcurrent: 1 },
    });
    const registry = new AppRegistry(async () => [{ appDir, definition: app }]);
    await registry.reload();
    await installAppTaskRuntimes({
      projectRoot: root,
      projectsRoot,
      agentsRoot: join(root, "agents"),
      sharedRoot: root,
      persistDir,
      bus,
      appRegistrySnapshot: registry.snapshot(),
      agents: runner,
    }, { deferRecovery: true });

    const published = runner.snapshot();
    expect(registrations).toEqual([{ agent: "worker", appDir, agentDir }]);
    expect(published.available("alpha/worker")).toBe(true);
    expect(published.available("global/worker")).toBe(true);
    expect(published.role("alpha/worker")).toEqual({
      agent: "alpha/worker",
      instructions: "Alpha instructions",
    });
    let dispatched: SubagentDefinition | undefined;
    manager.callAgentDefinition = async (definition, _task, options) => {
      dispatched = definition;
      expect(options?.taskContext?.agentDefinitions.get("alpha/worker")).toBe(definition);
      return {
        status: "done",
        sessionId: "s_alpha",
        messages: [],
        duration: "0s",
        outputDir: root,
        finishResult: { status: "done", summary: "Alpha Task complete" },
        structuredResult: {
          state: "converged",
          summary: "Alpha Task complete",
          facts: ["agent:alpha"],
          result: { owner: definition.model.id },
        },
      };
    };

    const execution = await runTaskAgent({
      opts: { agents: published },
      descriptor: { id: "alpha", appDir, projectDir: root, app: {} },
      claim: { agent: "worker" },
      attempt: {
        maxAttemptMs: 1_000,
        read: { tasks: {} },
        task: { id: "work", generation: 1, outcome: "Run Alpha", acceptance: [] },
        role: published.role("alpha/worker"),
        events: { items: [] },
        waits: {},
      },
      executionPaths: { appDir, projectDir: root, workspaceDir: root },
      childContext: { live: [], completed: [] },
      taskSnapshot: { live: [], truncated: false },
      taskEvents: {} as never,
      acceptedLiveEventIds: () => [],
      sessionStarted: () => {},
    } as any);
    expect(execution.handlerResult).toMatchObject({
      state: "converged",
      summary: "Alpha Task complete",
      result: { owner: "alpha" },
    });
    expect(dispatched).toBe(manager.getAgentDefinition("alpha/worker"));
    expect(dispatched).toMatchObject({
      name: "worker",
      projectId: "alpha",
      agentDir,
      systemPrompt: "Alpha instructions",
    });
  } finally {
    await closeInstalledAppTaskRuntimes(bus);
    if (manager) {
      const sessions = manager.status();
      for (const session of sessions) manager.cancel(session.sessionId);
      await Promise.allSettled(sessions.map((session) => manager!.waitFor(session.sessionId)));
    }
    closeDb(persistDir);
    rmSync(root, { recursive: true, force: true });
  }
});

test("explicit global Task executors require the declared global definition after local fallback registration", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-managed-explicit-global-"));
  try {
    const projectsRoot = join(root, "projects");
    const appDir = join(projectsRoot, "alpha.app");
    const agentDir = join(appDir, "agents", "worker-profile");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "agent.json"), JSON.stringify({ name: "worker" }));

    const available = new Set<string>();
    const registrations: Array<{ agent: string; appDir: string; agentDir?: string }> = [];
    const runner = createTaskAgentRunner({
      manager: {
        hasAgent: (agent: string) => available.has(agent),
      } as unknown as SubagentManager,
      registerLocalAgent: async (agent, selectedAppDir, resolvedDir) => {
        registrations.push({ agent, appDir: selectedAppDir, agentDir: resolvedDir });
        available.add("alpha/worker");
        return true;
      },
    });
    const preparation = { source: { projectsRoot }, appId: "alpha", appDir, agent: "global/worker" } as any;

    await expect(runner.prepare(preparation)).resolves.toBe(false);
    expect(registrations).toEqual([{ agent: "worker", appDir, agentDir }]);
    expect(available.has("alpha/worker")).toBe(true);
    expect(available.has("global/worker")).toBe(false);

    available.add("global/worker");
    await expect(runner.prepare(preparation)).resolves.toBe(true);
    expect(registrations).toHaveLength(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Task roots reject a foreign same-name agent when the owning App profile is missing", async () => {
  const foreign: SubagentDefinition = {
    name: "worker", description: "Beta worker", domain: "test", model: fakeModel(), tools: [],
    appLocal: true, projectId: "beta",
  };
  let dispatched = false;
  const runner = createTaskAgentRunner({ manager: {
    callAgentDefinition: async () => { dispatched = true; throw new Error("must not dispatch"); },
  } as unknown as SubagentManager }, new Map([["beta/worker", foreign]]));

  const result = await runTaskAgent({
    opts: { agents: runner },
    descriptor: { id: "alpha", appDir: "/tmp/alpha", projectDir: "/tmp/alpha", app: {} },
    claim: { agent: "worker" },
    attempt: { maxAttemptMs: 1_000 },
  } as any);

  expect(dispatched).toBe(false);
  expect(result).toMatchObject({
    unavailable: true,
    handlerResult: { state: "error", summary: "Task agent alpha/worker is not available" },
  });
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
          projectRoot: root, sessionId: "fixture", createFinish: () => createFinishTool({ projectRoot: root }) });
        const write = prepared.tools.find(tool => tool.name === "write")!;
        const result = await write.execute("probe", { path: "agents/worker/agent.json", content: "{}" });
        expect(result.content).toMatchObject([{ type: "text", text: expect.stringContaining("WRITE BLOCKED") }]);
        preparedCount++;
        return { status: "done", sessionId: "fixture", structuredResult: { state: "converged", summary: "Scope checked", facts: [] } };
      },
    } as unknown as SubagentManager }, new Map([[`sample/${definition.name}`, definition]]));
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
        callAgent: async (_agent: string, text: string, options: CallAgentOptions) => {
          const prepared = prepareAgentExecution({
            ...options,
            task: text,
            projectRoot: root,
            sessionId: "model-facing-finish",
            definition: { name: "worker", description: "fixture", domain: "test", tools: [],
              model: { api: "openai-responses", provider: "fixture", id: "model-a" } as SubagentDefinition["model"] },
          });
          const finish = prepared.tools.find((tool) => tool.name === "finish")!;
          const parameters = finish.parameters as any;
          expect(parameters.type).toBe("object");
          expect(parameters.properties.output.anyOf[0].properties.state).toBeDefined();
          expect(parameters.properties.output.description).toContain("canonical Task attempt result");
          expect(parameters.properties.output.description).toContain("blocked");
          const missingDoneOutput = await finish.execute("missing-done", { status: "done", summary: "Missing output" }, undefined, undefined);
          expect(missingDoneOutput.content).toEqual([{ type: "text", text: expect.stringContaining("expected an object") }]);
          const invalid = await finish.execute("invalid", { status: "done", summary: "Pending", output: {
            state: "waiting", summary: "Pending", facts: [], conditions: [{
              id: "sample", type: "sample.state", subject: "sample:1", owner: "app:example", expected: {},
            }],
          } });
          expect(invalid.content).toEqual([{ type: "text", text: expect.stringContaining("expected.state must be ready") }]);
          const valid = await finish.execute("valid", { status: "done", summary: "Pending", output: {
            state: "waiting", summary: "Pending", facts: [], conditions: [{
              id: "sample", type: "sample.state", subject: "sample:1", owner: "app:example", expected: { state: "ready" },
            }],
          } });
          expect(valid.terminate).toBe(true);
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
