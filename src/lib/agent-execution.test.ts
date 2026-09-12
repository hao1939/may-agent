import { afterEach, describe, expect, test } from "bun:test";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
  createAssistantMessageEventStream,
  Type,
  type AssistantMessage,
  type Context,
  type Model,
  type StreamFunction,
} from "@earendil-works/pi-ai";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GITHUB_COPILOT_IDE_TOKEN_EXPIRED,
  executePreparedAgent,
  prepareAgentExecution,
  withGithubCopilotIdeTokenRecovery,
} from "./agent-execution.js";
import { currentAgentSessionId } from "./agent-session-context.js";
import { createFinishTool } from "./tools/lifecycle.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tool(name: string): AgentTool {
  return {
    name,
    label: name,
    description: name,
    parameters: Type.Object({}),
    execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
  };
}

const fallbackTestModel = {
  api: "anthropic-messages",
  provider: "anthropic",
  id: "claude-opus-5",
} as Model<any>;

const streamTestModel = {
  api: "openai-responses",
  provider: "github-copilot",
  id: "gpt-5.6-sol",
  fallbackModel: fallbackTestModel,
} as Model<any> & { fallbackModel: Model<any> };

function assistantMessage(
  stopReason: "stop" | "error",
  errorMessage?: string,
  model: Model<any> = streamTestModel,
): AssistantMessage {
  return {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason,
    errorMessage,
    timestamp: 1,
  };
}

function terminalStream(message: AssistantMessage) {
  const stream = createAssistantMessageEventStream();
  if (message.stopReason === "error") {
    stream.push({ type: "error", reason: "error", error: message });
  } else {
    stream.push({ type: "done", reason: "stop", message });
  }
  return stream;
}

async function resultWithoutHang(stream: ReturnType<typeof createAssistantMessageEventStream>) {
  return Promise.race([
    stream.result(),
    Bun.sleep(100).then(() => {
      throw new Error("recovery stream did not terminate");
    }),
  ]);
}

describe("GitHub Copilot IDE token recovery", () => {
  test("switches the bounded Copilot auth envelope once to the declared independent fallback", async () => {
    const context: Context = { messages: [{ role: "user", content: "keep me", timestamp: 1 }] };
    const originalMessages = context.messages;
    const options = { apiKey: "opaque-test-key" };
    const calls: Array<{ model: Model<any>; context: Context; options: unknown }> = [];
    const boundedEnvelope = `OpenAI API error (401): {"message":"litellm.AuthenticationError: AuthenticationError: ${GITHUB_COPILOT_IDE_TOKEN_EXPIRED}\\n. Received Model Group=gpt-5.6-sol\\nAvailable Model Group Fallbacks=None","type":null,"param":null,"code":"401"}`;
    const provider: StreamFunction = (model, receivedContext, receivedOptions) => {
      calls.push({ model, context: receivedContext, options: receivedOptions });
      return model === streamTestModel
        ? terminalStream(assistantMessage("error", boundedEnvelope, model))
        : terminalStream(assistantMessage("stop", undefined, model));
    };

    const result = await resultWithoutHang(
      withGithubCopilotIdeTokenRecovery(provider)(streamTestModel, context, options),
    );

    expect(result.stopReason).toBe("stop");
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("claude-opus-5");
    expect(result.errorMessage).toBeUndefined();
    expect(result.errorMessage ?? "").not.toContain("Available Model Group Fallbacks=None");
    expect(calls).toHaveLength(2);
    expect(calls[0]?.model).toBe(streamTestModel);
    expect(calls[1]?.model).toBe(fallbackTestModel);
    expect(calls[0]?.context).toBe(context);
    expect(calls[1]?.context).toBe(context);
    expect(calls[0]?.options).toBe(options);
    expect(calls[1]?.options).toBe(options);
    expect(context.messages).toBe(originalMessages);
    expect(context.messages).toHaveLength(1);
  });

  test("does not silently reroute generic auth or non-auth provider failures", async () => {
    for (const errorMessage of [
      "OpenAI API error (401): permission denied",
      "OpenAI API error (403): account disabled",
      "OpenAI API error (500): upstream unavailable",
    ]) {
      const calls: Model<any>[] = [];
      const provider: StreamFunction = (model) => {
        calls.push(model);
        return terminalStream(assistantMessage("error", errorMessage, model));
      };

      const result = await resultWithoutHang(
        withGithubCopilotIdeTokenRecovery(provider)(streamTestModel, { messages: [] }),
      );

      expect(calls).toEqual([streamTestModel]);
      expect(result.stopReason).toBe("error");
      expect(result.errorMessage).toBe(errorMessage);
    }
  });
});

describe("shared agent execution preparation", () => {
  test("prepares convention prompts and tools without a manager or database", () => {
    const root = mkdtempSync(join(tmpdir(), "agent-preparation-"));
    roots.push(root);
    const agentDir = join(root, "agents", "sample");
    const definitionSharedRoot = join(root, "release", "shared");
    mkdirSync(join(root, "shared"), { recursive: true });
    mkdirSync(definitionSharedRoot, { recursive: true });
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(root, "shared", "common-sense.md"), "mutable rules\n");
    writeFileSync(join(definitionSharedRoot, "common-sense.md"), "released shared rules\n");
    writeFileSync(join(agentDir, "AGENTS.md"), "sample identity\n");
    writeFileSync(join(agentDir, "context.md"), "reported context is not activated guidance\n");

    const prepared = prepareAgentExecution({
      definition: {
        name: "sample",
        description: "sample",
        domain: "tests",
        agentDir,
        projectRoot: root,
        sharedRoot: definitionSharedRoot,
        model: { contextWindow: 10_000 } as any,
        tools: [tool("read"), tool("finish")],
      },
      projectRoot: root,
      sessionId: "direct-1",
      task: "do the work",
      promptTimestamp: "2026-07-19T00:00:00.000Z",
    });

    expect(prepared.task).toBe("do the work");
    expect(prepared.prompt).toBe("do the work");
    expect(prepared.tools.map((candidate) => candidate.name)).toEqual(["read", "finish"]);
    expect(prepared.tools.find((candidate) => candidate.name === "read")?.executionMode).toBeUndefined();
    expect(prepared.tools.find((candidate) => candidate.name === "finish")?.executionMode).toBe("sequential");
    expect(prepared.runner.sessionId).toBe("direct-1");
    expect(prepared.runner.streamFn).toBeFunction();
    expect(prepared.systemPrompt).toContain("released shared rules\n\nsample identity");
    expect(prepared.systemPrompt).not.toContain("mutable rules");
    expect(prepared.systemPrompt).not.toContain("reported context is not activated guidance");
    expect(prepared.systemPrompt).toContain("Available tools: read, finish");
    expect(prepared.systemPrompt).toContain("Current time: 2026-07-19T00:00:00.000Z");
  });

  test("synthesizes exactly one checkpoint for explicit full non-persistent preparation", () => {
    let checkpointCreations = 0;
    const prepared = prepareAgentExecution({
      definition: {
        name: "sample",
        description: "sample",
        domain: "tests",
        systemPrompt: "identity",
        model: { contextWindow: 10_000 } as any,
        tools: [tool("read")],
      },
      projectRoot: "/tmp",
      sessionId: "full-checkpoint-1",
      task: "do bounded work",
      toolPolicy: "full",
      createCheckpoint: () => {
        checkpointCreations += 1;
        return tool("checkpoint");
      },
    });

    expect(checkpointCreations).toBe(1);
    expect(prepared.tools.map((candidate) => candidate.name)).toEqual(["read", "checkpoint"]);
    expect(prepared.tools.filter((candidate) => candidate.name === "checkpoint")).toHaveLength(1);
    expect(prepared.tools.find((candidate) => candidate.name === "checkpoint")?.executionMode).toBe("sequential");
  });

  test("removes Host-private task inspection while preserving full task-executor tools", () => {
    const prepared = prepareAgentExecution({
      definition: {
        name: "sample",
        description: "sample",
        domain: "tests",
        systemPrompt: "identity",
        model: { contextWindow: 10_000 } as any,
        tools: [tool("read"), tool("tasks"), tool("finish")],
      },
      projectRoot: "/tmp",
      sessionId: "supplied-dependency-observation",
      task: "judge the supplied observation",
      toolPolicy: "full-no-tasks",
      createCheckpoint: () => tool("checkpoint"),
    });

    expect(prepared.tools.map((candidate) => candidate.name)).toEqual(["read", "finish", "checkpoint"]);
  });

  test("preserves one existing checkpoint without synthesizing a duplicate", () => {
    let checkpointCreations = 0;
    const existingCheckpoint = tool("checkpoint");
    const prepared = prepareAgentExecution({
      definition: {
        name: "sample",
        description: "sample",
        domain: "tests",
        systemPrompt: "identity",
        model: { contextWindow: 10_000 } as any,
        tools: [tool("read"), existingCheckpoint],
      },
      projectRoot: "/tmp",
      sessionId: "existing-checkpoint-1",
      task: "continue bounded work",
      toolPolicy: "full",
      createCheckpoint: () => {
        checkpointCreations += 1;
        return tool("checkpoint");
      },
    });

    expect(checkpointCreations).toBe(0);
    expect(prepared.tools.filter((candidate) => candidate.name === "checkpoint")).toHaveLength(1);
  });

  test("does not broaden checkpoint access outside explicit full non-persistent preparation", () => {
    for (const scenario of [
      { sessionId: "readonly-checkpoint", toolPolicy: "readonly" as const },
      { sessionId: "deputy-checkpoint", toolPolicy: "deputy" as const },
      { sessionId: "persistent-checkpoint", toolPolicy: "full" as const, persistentChat: true },
      { sessionId: "default-direct-checkpoint" },
    ]) {
      let checkpointCreations = 0;
      const prepared = prepareAgentExecution({
        definition: {
          name: "sample",
          description: "sample",
          domain: "tests",
          systemPrompt: "identity",
          model: { contextWindow: 10_000 } as any,
          tools: [tool("read")],
        },
        projectRoot: "/tmp",
        task: "inspect without checkpoint synthesis",
        createCheckpoint: () => {
          checkpointCreations += 1;
          return tool("checkpoint");
        },
        ...scenario,
      });

      expect(checkpointCreations).toBe(0);
      expect(prepared.tools.some((candidate) => candidate.name === "checkpoint")).toBe(false);
    }
  });

  test("keeps App owners inside the disposition ownership boundary", () => {
    const definition = {
      name: "owner",
      description: "App owner",
      domain: "tests",
      systemPrompt: "identity",
      model: { contextWindow: 10_000 } as any,
      tools: [
        "agents",
        "background_exec",
        "bash",
        "checkpoint",
        "cron",
        "edit",
        "finish",
        "message",
        "query_db",
        "read",
        "run_cli_agent",
        "workflow",
        "write",
      ].map(tool),
    };

    const full = prepareAgentExecution({
      definition,
      projectRoot: "/tmp",
      sessionId: "app-owner-full",
      task: "handle project input",
      toolPolicy: "app-owner-full",
      createCheckpoint: () => tool("checkpoint"),
    });
    const deputy = prepareAgentExecution({
      definition,
      projectRoot: "/tmp",
      sessionId: "app-owner-deputy",
      task: "handle human input",
      toolPolicy: "app-owner-deputy",
    });

    expect(full.tools.map((candidate) => candidate.name)).toEqual([
      "agents",
      "bash",
      "edit",
      "finish",
      "query_db",
      "read",
      "run_cli_agent",
      "workflow",
      "write",
    ]);
    expect(deputy.tools.map((candidate) => candidate.name)).toEqual(["agents", "finish", "query_db", "read", "run_cli_agent"]);
  });

  test("leaves compatibility deputy sessions unchanged during migration", () => {
    const prepared = prepareAgentExecution({
      definition: {
        name: "may",
        description: "May",
        domain: "tests",
        systemPrompt: "identity",
        model: { contextWindow: 10_000 } as any,
        tools: ["agents", "finish", "message", "read", "run_cli_agent"].map(tool),
      },
      projectRoot: "/tmp",
      sessionId: "legacy-deputy",
      task: "handle compatibility input",
      toolPolicy: "deputy",
    });

    expect(prepared.tools.map((candidate) => candidate.name)).toEqual([
      "agents",
      "finish",
      "message",
      "read",
      "run_cli_agent",
    ]);
  });

  test("binds shared tools to the exact concurrent agent session", async () => {
    const observations: Array<{ before?: string; after?: string }> = [];
    const sharedTool: AgentTool = {
      ...tool("message"),
      execute: async () => {
        const before = currentAgentSessionId("may");
        await Bun.sleep(before === "session-old" ? 5 : 1);
        observations.push({ before, after: currentAgentSessionId("may") });
        return { content: [{ type: "text", text: "ok" }] };
      },
    };
    const definition = {
      name: "may",
      description: "may",
      domain: "tests",
      systemPrompt: "identity",
      model: { contextWindow: 10_000 } as any,
      tools: [sharedTool],
    };
    const oldTurn = prepareAgentExecution({
      definition,
      projectRoot: "/tmp",
      sessionId: "session-old",
      task: "old turn",
    });
    const latestTurn = prepareAgentExecution({
      definition,
      projectRoot: "/tmp",
      sessionId: "session-latest",
      task: "latest turn",
    });

    await Promise.all([
      oldTurn.tools[0]!.execute("old-call", {} as never),
      latestTurn.tools[0]!.execute("latest-call", {} as never),
    ]);

    expect(observations).toContainEqual({ before: "session-old", after: "session-old" });
    expect(observations).toContainEqual({ before: "session-latest", after: "session-latest" });
  });

  test("does not select a skill from Task wording", () => {
    const skill = {
      name: "proof-first",
      description: "Prepare proof before broad rollout.",
      filePath: "/tmp/proof-first/SKILL.md",
      canonicalPath: "/tmp/proof-first/SKILL.md",
      content: "Freeze a baseline and candidate before broad rollout.",
      scope: "agent" as const,
      contentHash: "proof-first-hash",
    };
    const prepared = prepareAgentExecution({
      definition: {
        name: "sample",
        description: "sample",
        domain: "tests",
        systemPrompt: "identity",
        model: { contextWindow: 10_000 } as any,
        tools: [tool("read")],
        skillCatalog: {
          skills: new Map([[skill.name, skill]]),
          diagnostics: [],
          omittedFromPrompt: [],
        },
      },
      projectRoot: "/tmp",
      sessionId: "rule-skill-1",
      task: "Roll out this prompt to every agent.",
    });

    expect(prepared.skillActivation).toBeUndefined();
    expect(prepared.activatedSkill).toBeUndefined();
    expect(prepared.prompt).not.toContain("Freeze a baseline and candidate before broad rollout.");
    expect(prepared.prompt).toContain("Roll out this prompt to every agent.");
  });

  test("adapts the supplied finish capability for structured workflow results", () => {
    const prepared = prepareAgentExecution({
      definition: {
        name: "sample",
        description: "sample",
        domain: "tests",
        systemPrompt: "identity",
        model: { contextWindow: 10_000 } as any,
        tools: [tool("finish")],
      },
      projectRoot: "/tmp",
      sessionId: "direct-2",
      task: "return a result",
      outputSchema: Type.Object({ verdict: Type.String() }),
    });

    expect(prepared.requireFinish).toBe(true);
    expect(prepared.systemPrompt).toContain("Complete it only by calling finish()");
    expect((prepared.tools[0]!.parameters as any).required).toContain("result");
  });

  test("rebases filesystem tools onto the workflow execution root", async () => {
    const registeredRoot = mkdtempSync(join(tmpdir(), "agent-registered-root-"));
    const executionRoot = mkdtempSync(join(tmpdir(), "agent-execution-root-"));
    roots.push(registeredRoot, executionRoot);
    writeFileSync(join(executionRoot, "proof.txt"), "task workspace\n");

    const prepared = prepareAgentExecution({
      definition: {
        name: "sample",
        description: "sample",
        domain: "tests",
        systemPrompt: "identity",
        projectRoot: registeredRoot,
        model: { contextWindow: 10_000 } as any,
        tools: [tool("read")],
      },
      projectRoot: registeredRoot,
      executionRoot,
      sessionId: "isolated-1",
      task: "read proof",
    });

    const result = await prepared.tools[0]!.execute("call-1", { path: "proof.txt" } as never);
    expect(JSON.stringify(result)).toContain("task workspace");
    expect(prepared.definition.projectRoot).toBe(executionRoot);
  });

  test("rebases finish deliverable validation onto the workflow execution root", async () => {
    const registeredRoot = mkdtempSync(join(tmpdir(), "agent-finish-registered-root-"));
    const executionRoot = mkdtempSync(join(tmpdir(), "agent-finish-execution-root-"));
    roots.push(registeredRoot, executionRoot);
    writeFileSync(join(executionRoot, "proof.txt"), "task workspace\n");

    const prepared = prepareAgentExecution({
      definition: {
        name: "sample",
        description: "sample",
        domain: "tests",
        systemPrompt: "identity",
        projectRoot: registeredRoot,
        model: { contextWindow: 10_000 } as any,
        tools: [createFinishTool({ agentName: "sample", projectRoot: registeredRoot })],
      },
      projectRoot: registeredRoot,
      executionRoot,
      sessionId: "isolated-finish-1",
      task: "finish with proof",
      requireFinish: true,
      createFinish: () => createFinishTool({ agentName: "sample", projectRoot: executionRoot }),
    });

    const finish = prepared.tools.find((candidate) => candidate.name === "finish");
    const result = await finish!.execute("call-1", {
      status: "success",
      summary: "verified worktree evidence",
      deliverables: [{ path: "proof.txt", description: "worktree proof" }],
      verification_evidence: ["read(proof.txt) showed task workspace"],
    } as never);
    expect(JSON.stringify(result)).not.toContain("Deliverables not found on disk");
    expect(JSON.stringify(result)).toContain("SUCCESS");
  });
});

describe("direct structured judgment execution", () => {
  const judgment = { state: "incomplete", summary: "Further recovery exceeds the authorized budget." };
  const finishArgs = {
    status: "failure",
    summary: judgment.summary,
    blockers: [{ reason: "Recovery costs too much", context: "Four hours for a five-minute task" }],
    result: judgment,
  };

  function prepare(structured = true) {
    const root = mkdtempSync(join(tmpdir(), "agent-judgment-"));
    roots.push(root);
    return prepareAgentExecution({
      definition: {
        name: "judge",
        description: "Synthetic judgment fixture",
        domain: "tests",
        systemPrompt: "Judge the supplied evidence.",
        model: streamTestModel,
        tools: [createFinishTool({ agentName: "judge", projectRoot: root })],
      },
      projectRoot: root,
      sessionId: "judgment-fixture",
      task: "Decide whether recovery is worthwhile.",
      requireFinish: true,
      ...(structured ? { outputSchema: Type.Object({ state: Type.Literal("incomplete"), summary: Type.String() }) } : {}),
    });
  }

  function finishStream(args: Record<string, unknown>) {
    const stream = createAssistantMessageEventStream();
    stream.push({
      type: "done",
      reason: "toolUse",
      message: {
        ...assistantMessage("stop"),
        stopReason: "toolUse",
        content: [{ type: "toolCall", id: "judgment-finish", name: "finish", arguments: args }],
      },
    });
    return stream;
  }

  test.each([true, false])("preserves non-success output with structured=%s", async (structured) => {
    const prepared = prepare(structured);
    let calls = 0;
    prepared.runner.streamFn = () => {
      calls++;
      return finishStream(finishArgs);
    };

    const result = await executePreparedAgent(prepared);

    expect(result.status).toBe(structured ? "done" : "error");
    expect(result.error).toBeUndefined();
    expect(result.finishResult?.status).toBe("failure");
    expect(result.structuredResult).toEqual(judgment);
    expect(calls).toBe(1);
  });

  test.each([
    { ...finishArgs, result: { state: "unsupported" } },
    { ...finishArgs, result: undefined },
    { ...finishArgs, blockers: [] },
  ])("rejects an invalid or uncommitted judgment %#", async (args) => {
    const prepared = prepare();
    let calls = 0;
    prepared.runner.streamFn = () => {
      if (++calls === 1) return finishStream(args);
      return terminalStream({
        ...assistantMessage("stop"),
        content: [{ type: "text", text: "No valid judgment returned." }],
      });
    };

    const result = await executePreparedAgent(prepared);

    expect(result.status).toBe("error");
    expect(result.error).toContain("without calling finish()");
    expect(result.finishResult).toBeUndefined();
    expect(result.structuredResult).toBeUndefined();
    expect(calls).toBe(3); // Rejected tool, final text, one corrective prompt.
  });

  test("keeps a provider failure as an execution error", async () => {
    const prepared = prepare();
    prepared.runner.streamFn = () => terminalStream(assistantMessage("error", "HTTP 401 Unauthorized"));

    const result = await executePreparedAgent(prepared);

    expect(result.status).toBe("error");
    expect(result.error).toContain("HTTP 401 Unauthorized");
    expect(result.structuredResult).toBeUndefined();
  });

  test("keeps timeout before any committed judgment interrupted", async () => {
    const prepared = prepare();
    prepared.runner.streamFn = (_model, _context, options) => {
      const stream = createAssistantMessageEventStream();
      const aborted = () => stream.push({
        type: "error",
        reason: "aborted",
        error: { ...assistantMessage("error", "Aborted"), stopReason: "aborted" },
      });
      if (options?.signal?.aborted) aborted();
      else options?.signal?.addEventListener("abort", aborted, { once: true });
      return stream;
    };

    const result = await executePreparedAgent(prepared, { timeoutMs: 10 });

    expect(result.status).toBe("interrupted");
    expect(result.structuredResult).toBeUndefined();
  });

  test.each([true, false])("retains a committed finish when timeout races with turn cleanup (structured=%s)", async (structured) => {
    const prepared = prepare(structured);
    let calls = 0;
    let receipts = 0;
    let timedOutAfterReceipt = false;
    prepared.runner.streamFn = () => {
      calls++;
      return finishStream(finishArgs);
    };

    const result = await executePreparedAgent(prepared, {
      timeoutMs: 1_000,
      async onObservation(event, signal) {
        if (event.type !== "message_end" || event.message.role !== "toolResult" || event.message.toolName !== "finish") return;
        expect(event.message.isError).toBe(false);
        expect(signal.aborted).toBe(false);
        receipts++;
        // Hold actual turn cleanup after the receipt until the real deadline fires.
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
        timedOutAfterReceipt = true;
        throw new Error("Turn cleanup interrupted after committed finish");
      },
    });

    expect(timedOutAfterReceipt).toBe(true);
    expect(receipts).toBe(1);
    expect(calls).toBe(1);
    expect(result.status).toBe(structured ? "done" : "error");
    expect(result.error).toBeUndefined();
    expect(result.finishResult?.status).toBe("failure");
    expect(result.structuredResult).toEqual(judgment);
  });
});
