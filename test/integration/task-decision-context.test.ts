import { expect, test } from "bun:test";
import { Type, createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SubagentManager } from "../../src/lib/manager.js";
import { createAgentRun } from "../../src/lib/agent-runner.js";
import { createTaskAgentRunner } from "../../src/app/adapters/executors/managed-agent.js";
import { EventBus } from "../../src/app/core/events/bus.js";
import { getDb, closeDb } from "../../src/lib/db/connection.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { appTaskTestContext } from "../../src/app/core/tasks/app-task-test-support.js";
import {
  observeAppTaskIntent,
  claimObservedAppTask,
  deferAppTask,
  recordAppTaskTrigger,
} from "../../src/app/core/tasks/app-task-reconciler.js";
import { runTaskAgent, taskReads } from "../../src/app/core/tasks/attempt-execution.js";
import type { AppTaskRuntimeDescriptor } from "../../src/app/core/tasks/runtime-definition.js";
import type { AppTaskRuntimeOptions } from "../../src/app/core/tasks/runtime-options.js";
import { currentAgentSessionId } from "../../src/lib/agent-session-context.js";
import { fakeModel } from "../fixtures/model.js";
import { usageReply } from "../fixtures/execution-usage.js";

test("current Task context reaches a late helper and survives settlement into a fresh attempt", async () => {
  const root = mkdtempSync(join(tmpdir(), "task-decision-lifecycle-"));
  const appDir = join(root, "sample.app"),
    persistDir = join(root, "state");
  mkdirSync(appDir);
  const store = AppTaskResourceStore.fromDb(getDb(persistDir), "sample");
  const config = appTaskTestContext({
    appDir,
    agent: "owner",
    maxConcurrent: 1,
    resourceStore: store,
    tree: {
      project: "sample",
      project_lifecycle: "active",
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null } },
      tasks: {},
    },
  });
  const taskId = "work/review";
  const descriptor = {
    id: "sample",
    appDir,
    projectDir: root,
    agent: "owner",
    resourceStore: store,
    app: { id: "sample", version: 1, agent: "owner", tasks: { maxConcurrent: 1 } },
  } as AppTaskRuntimeDescriptor;
  const opts = { bus: new EventBus(), projectRoot: root, projectsRoot: root, persistDir } as AppTaskRuntimeOptions;
  const read = taskReads(opts, descriptor);
  const claim = () => {
    const next = claimObservedAppTask(config, { taskId, appAgent: "owner", handler: "agent:owner" });
    if (next.kind !== "claimed") throw new Error(`Claim failed: ${next.kind}`);
    return next;
  };
  let helperReads = 0,
    draftEdits = 0;
  const packets: Array<{ round: number; helper: boolean; value: Record<string, any> }> = [];
  try {
    observeAppTaskIntent(config, {
      appAgent: "owner",
      intent: {
        id: taskId,
        parentId: "root",
        agent: "owner",
        outcome: "Review a prepared draft and retain exact publication approval",
        acceptance: ["Apply correction once", "Keep approval open"],
        input: { background: "old weather report ".repeat(6000) },
      },
    });
    deferAppTask(config, claim(), {
      disposition: "waiting",
      continue: true,
      summary: "Draft v3 prepared",
      result: { version: "v3", day: "Wednesday" },
      facts: ["Cedar venue verified"],
      conditions: [
        {
          id: "approval",
          type: "approval.observed",
          subject: "draft:v3",
          expected: true,
          owner: "human:reviewer",
          requestedAction: "Approve exact version",
          reviewAfterMs: 3600000,
        },
      ],
    });
    for (const round of [1, 2]) {
      const active = claim();
      // Recreate the manager: accepted understanding comes from Task state,
      // not the earlier execution's transcript or an in-memory summary.
      const manager = new SubagentManager({
        projectRoot: root,
        persistDir,
        agentRunFactory: (runner) => {
          let step = 0;
          return createAgentRun({
            ...runner,
            streamFn: (_model, input) => {
              const helper = manager.activeSessions.get(runner.sessionId!)?.agentName === "reviewer";
              const last = input.messages.at(-1)!;
              const text =
                typeof last.content === "string"
                  ? last.content
                  : last.content
                      .filter((c) => c.type === "text")
                      .map((c) => c.text)
                      .join("\n");
              expect(text).toStartWith("Task decision brief");
              const p = JSON.parse(text.slice(text.indexOf("\n{")));
              packets.push({ round, helper, value: p });
              expect(p.binding.attemptId).toBe(active.attemptId);
              expect(p.conditions[0].observation.state).toBe("unknown");
              expect(p.conditions[0].subject).toBe("draft:v3");
              expect(p.observed.resourceVersion).toBeGreaterThan(0);
              expect(Buffer.byteLength(JSON.stringify(input))).toBeLessThan(80_000);
              const detail = JSON.parse(readFileSync(p.coverage.detail, "utf8"));
              expect(detail.input.background).toHaveLength(19 * 6000);
              let content: AssistantMessage["content"];
              if (helper) {
                helperReads++;
                expect(JSON.stringify(p.events)).toContain("Thursday");
                expect(input.systemPrompt).toContain("Assigned contribution");
                content = [{ type: "text", text: "Review only: Thursday is required; approval remains open for v3." }];
              } else if (round === 1 && step++ === 0) {
                expect(p.current.result.version).toBe("v3");
                content = [{ type: "toolCall", id: "edit", name: "revise_draft", arguments: {} }];
              } else if (round === 1 && step === 2) {
                expect(JSON.stringify(p.events)).toContain("Thursday");
                content = [{ type: "toolCall", id: "review", name: "ask_reviewer", arguments: {} }];
              } else {
                if (round === 2) {
                  expect(p.current.result).toEqual({ version: "v4", day: "Thursday" });
                  expect(JSON.stringify(p.events)).toContain("Add the evidence link");
                } else {
                  // Arrive after the last context read. This must survive settlement.
                  recordAppTaskTrigger(config, taskId, {
                    type: "message.created",
                    eventId: 502,
                    data: { content: "Add the evidence link; keep publication approval separate." },
                  });
                }
                content = [
                  {
                    type: "toolCall",
                    id: `finish-${round}`,
                    name: "finish",
                    arguments: {
                      status: "success",
                      summary: "Draft reviewed",
                      verification_facts: ["Fixture checked"],
                      result: {
                        state: "waiting",
                        summary: "Draft v4 reviewed; publication awaits matching human approval",
                        facts: ["Thursday; Cedar", ...(round === 2 ? ["Evidence link retained"] : [])],
                        result: { version: "v4", day: "Thursday" },
                      },
                    },
                  },
                ];
              }
              const message = usageReply({ content, stopReason: helper ? "stop" : "toolUse" });
              const stream = createAssistantMessageEventStream();
              stream.push({ type: "done", reason: helper ? "stop" : "toolUse", message });
              return stream;
            },
          });
        },
      });
      const resultText = (text: string) => ({ content: [{ type: "text" as const, text }], details: {} });
      manager.register({
        name: "owner",
        description: "Owner",
        domain: "test",
        model: fakeModel(),
        tools: [
          {
            name: "revise_draft",
            label: "Revise draft",
            description: "Fixture draft edit",
            parameters: Type.Object({}),
            execute: async () => {
              draftEdits++;
              // Persisted input without a live notification: the read must discover it.
              recordAppTaskTrigger(config, taskId, {
                type: "message.created",
                eventId: 501,
                data: { content: "Thursday replaces Wednesday; keep Cedar and approval." },
              });
              return resultText("Draft v4 now uses Thursday");
            },
          },
          {
            name: "ask_reviewer",
            label: "Review",
            description: "Review contribution",
            parameters: Type.Object({}),
            execute: async () => {
              const result = await manager.callAgent(
                "reviewer",
                "Review the correction only; return findings to the caller",
                {
                  parentSessionId: currentAgentSessionId("owner"),
                  timeout: 5000,
                },
              );
              return resultText(result.lastAssistantText ?? "");
            },
          },
        ],
      });
      manager.register({ name: "reviewer", description: "Reviewer", domain: "test", model: fakeModel(), tools: [] });
      opts.agents = createTaskAgentRunner({ manager });
      const run = await runTaskAgent({
        opts,
        descriptor,
        claim: active,
        executionPaths: { appDir, projectDir: root, workspaceDir: root },
        declaredOutputPaths: [],
        childContext: { live: [], completed: [] },
        taskSnapshot: { live: [], truncated: false },
      });
      expect(run.handlerResult.state).toBe("waiting");
      deferAppTask(config, active, {
        ...run.handlerResult,
        disposition: "waiting",
        acceptedLiveEventIds: run.acceptedLiveEventIds,
      });
      const current = await read.get(taskId);
      expect(current?.result).toEqual({ version: "v4", day: "Thursday" });
      expect(current?.closed).not.toBe(true);
      expect(current?.conditions[0].observation?.state).toBe("unknown");
      if (round === 1) expect(current?.pendingEvents?.items.map((e) => e.eventId)).toEqual([501, 502]);
      else expect(current?.pendingEvents?.items).toEqual([]);
    }
    expect(draftEdits).toBe(1);
    expect(helperReads).toBe(1);
    expect(packets.some((p) => p.round === 2 && !p.helper)).toBe(true);
    expect(claimObservedAppTask(config, { taskId, appAgent: "owner", handler: "agent:owner" }).kind).not.toBe(
      "claimed",
    );
    const evidence = await read.get(taskId, { acceptedEvidence: { limit: 8 } });
    expect(evidence?.acceptedEvidence.page?.items.length).toBeGreaterThanOrEqual(3);
  } finally {
    closeDb(persistDir);
    rmSync(root, { recursive: true, force: true });
  }
}, 15_000);
