import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { TaskDetail } from "@may-agent/sdk";
import { createTaskDecisionContext } from "./task-decision-context.js";
import { prepareTaskWorkspaceContext } from "./task-workspace-context.js";
import { Type, createAssistantMessageEventStream, type Context } from "@earendil-works/pi-ai";
import { createFinishTool } from "./tools/lifecycle.js";
import { createAgentRun } from "./agent-runner.js";
import { usageReply } from "../../test/fixtures/execution-usage.js";
import { prepareAgentExecution } from "./agent-execution.js";
import type { TaskExecutionContext } from "./task-execution-context.js";
import { fakeModel } from "../../test/fixtures/model.js";

function fixture(root: string) {
  const task: TaskDetail = {
    id: "review",
    parentId: "root",
    generation: 1,
    resourceVersion: 3,
    status: "running",
    outcome: "Review the draft",
    acceptance: ["Keep approval separate"],
    input: { background: "old notes" },
    summary: "Draft prepared",
    result: { understanding: "Wednesday", version: "v3" },
    facts: ["Venue: Cedar"],
    acceptedEvidence: { available: true, maxPageSize: 20 },
    conditions: [
      {
        id: "approval",
        type: "approval.observed",
        subject: "draft:v3",
        expected: true,
        owner: "human:reviewer",
        requestedAction: "Approve exact version",
        reviewAfterMs: 3600000,
        observation: { generation: 1, resourceVersion: 1, observedGeneration: 0, state: "unknown" },
      },
    ],
    pendingEvents: { items: [], truncated: false },
  };
  let current = structuredClone(task);
  let failure = false;
  const context = {
    taskBinding: { appId: "sample", taskId: task.id, generation: 1, attemptId: "attempt-1" },
    recoveryOwner: "app-task",
    executionPaths: { appDir: root, projectDir: root, workspaceDir: root },
    reconciliation: {
      task: structuredClone(task),
      appId: "sample",
      taskId: task.id,
      generation: 1,
      resourceVersion: 3,
      agent: "owner",
      outcome: task.outcome,
      acceptance: task.acceptance,
      input: task.input,
      events: { items: [], truncated: false },
      waits: { open: [], note: "attempt-start" },
      children: { live: [], completed: [] },
    },
    details: { task, declaredOutputs: [] },
    taskRead: {
      get: async () => {
        if (failure) throw new Error("read unavailable");
        return structuredClone(current);
      },
    },
  } as unknown as TaskExecutionContext;
  prepareTaskWorkspaceContext(context, root, []);
  return {
    context,
    task,
    setCurrent: (value: TaskDetail) => {
      current = value;
    },
    fail: () => {
      failure = true;
    },
  };
}

function packet(message: AgentMessage) {
  const content = message.content;
  if (typeof content === "string" || !Array.isArray(content)) throw new Error("Expected text blocks");
  const text = content.find((item) => item.type === "text");
  if (!text || text.type !== "text") throw new Error("Expected decision brief");
  return JSON.parse(text.text.slice(text.text.indexOf("\n{")));
}

test("refresh keeps current evidence, independent approval and a scoped last-known fallback", async () => {
  const root = mkdtempSync(join(tmpdir(), "decision-context-"));
  try {
    const f = fixture(root);
    const read = createTaskDecisionContext(f.context);
    const initial = packet(await read());
    expect(initial.conditions[0].observation.state).toBe("unknown");
    f.setCurrent({ ...f.task, resourceVersion: 4, result: { understanding: "Thursday", version: "v4" } });
    const updated = packet(await read());
    expect(updated.current.result).toEqual({ understanding: "Thursday", version: "v4" });
    expect(updated.conditions[0].subject).toBe("draft:v3");
    expect(updated.observed.resourceVersion).toBe(4);
    expect(updated.coverage.detail).not.toBe(initial.coverage.detail);
    f.fail();
    const fallback = packet(await read());
    expect(fallback.observed.refresh.available).toBe(false);
    expect(fallback.observed.snapshot).toBe("last-successful-read");
    expect(fallback.current).toEqual(updated.current);
    expect(fallback.conditions).toEqual(updated.conditions);
    expect(fallback.coverage.currentRead.taskId).toBe("review");
    expect(f.context.details?.task.result).toEqual({ understanding: "Wednesday", version: "v3" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("initial failure and a changed generation preserve known scope without claiming a fresh binding", async () => {
  const root = mkdtempSync(join(tmpdir(), "decision-scope-"));
  try {
    const f = fixture(root);
    f.setCurrent({ ...f.task, generation: 2, outcome: "Different assignment" });
    const read = createTaskDecisionContext(f.context);
    const stale = packet(await read());
    expect(stale.observed.refresh.bindingCurrent).toBe(false);
    expect(stale.assignment.outcome).toBe("Review the draft");
    f.fail();
    const missing = packet(await read());
    expect(missing.observed.snapshot).toBe("attempt-start");
    expect(missing.current.result.version).toBe("v3");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("large Unicode data stays discoverable without displacing current conclusions and approval", async () => {
  const root = mkdtempSync(join(tmpdir(), "decision-bounds-"));
  try {
    const f = fixture(root);
    const background = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`note/${i}`, '🧪"'.repeat(1000)]));
    f.setCurrent({ ...f.task, input: { background, correction: "Thursday" } });
    const message = await createTaskDecisionContext(f.context)();
    expect(Buffer.byteLength(JSON.stringify(message))).toBeLessThan(16 * 1024);
    const p = packet(message);
    expect(p.input.omitted).toBe(true);
    expect(p.current.result.version).toBe("v3");
    expect(p.conditions[0].id).toBe("approval");
    const detail = JSON.parse(readFileSync(p.coverage.detail, "utf8"));
    expect(detail.input).toEqual({ background, correction: "Thursday" });
    expect(detail.binding).toEqual(f.context.taskBinding);
    const path = join(root, "unwritable");
    writeFileSync(path, "file");
    f.context.workspaceBrief = { taskFile: join(path, "TASK.md") };
    const withoutFile = packet(await createTaskDecisionContext(f.context)());
    expect(withoutFile.coverage.detailError).toBeTruthy();
    expect(withoutFile.observed.refresh.available).toBe(true);
    expect(withoutFile.current).toEqual(p.current);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the production transform restores current facts after compaction without accumulating briefs", async () => {
  const root = mkdtempSync(join(tmpdir(), "decision-compaction-"));
  try {
    const f = fixture(root);
    const task = "Original caller request with full data";
    let supplied: string | undefined;
    const skill = {
      name: "review",
      description: "Review the evidence",
      filePath: join(root, "SKILL.md"),
      canonicalPath: join(root, "SKILL.md"),
      content: "Check the cited version before judging.",
      scope: "agent" as const,
      contentHash: "fixture-hash",
    };
    writeFileSync(skill.canonicalPath, skill.content);
    const helperSchema = Type.Object({ verdict: Type.String({ description: "App-owned review finding" }) });
    const prepared = prepareAgentExecution({
      definition: {
        name: "helper",
        description: "Review",
        systemPrompt: "App reviewer: assess evidence quality.",
        skillCatalog: { skills: new Map([[skill.name, skill]]), diagnostics: [], omittedFromPrompt: [] },
        domain: "test",
        model: fakeModel(),
        tools: [createFinishTool({ agentName: "helper", projectRoot: root })],
        compaction: true,
        contextPreparation: ({ task }) => {
          supplied = task;
          return "Review contribution only";
        },
      },
      projectRoot: root,
      sessionId: "helper-1",
      task,
      skill: "review",
      outputSchema: helperSchema,
      contextPrompt: "Host default",
      taskContext: f.context,
    });
    expect(supplied).toBe(task);
    expect(prepared.prompt).toContain("Review contribution only");
    const messages: AgentMessage[] = Array.from({ length: 30 }, (_, i) => ({
      role: "user",
      timestamp: i,
      content: [{ type: "text", text: "Old unrelated note. ".repeat(100) }],
    }));
    const requests: Context[] = [];
    const agent = createAgentRun({
      ...prepared.runner,
      streamFn: (_model, context) => {
        requests.push(JSON.parse(JSON.stringify(context)));
        const stream = createAssistantMessageEventStream();
        const invalidFinish = requests.length === 3;
        const message = usageReply(
          invalidFinish
            ? {
                stopReason: "toolUse",
                content: [
                  {
                    type: "toolCall",
                    id: "wrong-result",
                    name: "finish",
                    arguments: { summary: "wrong", result: { state: "converged" } },
                  },
                ],
              }
            : {},
        );
        stream.push({ type: "done", reason: invalidFinish ? "toolUse" : "stop", message });
        return stream;
      },
    });
    agent.state.messages = messages;
    await agent.prompt(prepared.prompt);
    expect(requests[0].messages.length).toBeLessThan(30);
    expect(JSON.stringify(requests[0].messages)).toContain("COMPACTED CONTEXT");
    expect(packet(requests[0].messages.at(-1)!).current.result.version).toBe("v3");
    f.setCurrent({ ...f.task, resourceVersion: 5, result: { understanding: "Thursday" } });
    await agent.prompt("Recheck the review");
    expect(packet(requests[1].messages.at(-1)!).current.result.understanding).toBe("Thursday");
    for (const request of requests) {
      expect(request.systemPrompt).toContain("App reviewer: assess evidence quality.");
      expect(request.systemPrompt).toContain("a helper still owes only its assigned contribution");
      expect(request.systemPrompt).toContain(skill.canonicalPath);
      expect(request.systemPrompt).not.toContain("workflow step");
      const finish = request.tools!.find((tool) => tool.name === "finish")!;
      expect(finish.parameters.properties.result).toEqual(helperSchema);
      expect(JSON.stringify(request.messages).split("Task decision brief")).toHaveLength(2);
    }
    expect(JSON.stringify(agent.state.messages)).not.toContain("Task decision brief");
    await agent.prompt("Return the review");
    expect(requests).toHaveLength(4);
    const rejected = requests[3].messages.find(
      (message) => message.role === "toolResult" && message.toolCallId === "wrong-result",
    );
    expect(rejected).toMatchObject({ isError: true });
    expect(JSON.stringify(rejected)).toContain("verdict");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
