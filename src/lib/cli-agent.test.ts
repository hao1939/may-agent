import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertLegacyCliTasksSettled,
  CLI_DIAGNOSTIC_TAIL_BYTES,
  createCliOutputCollector,
  runCliAgent,
  type CliAgentInput,
  type CliAgentOptions,
} from "./cli-agent.js";
import { currentAgentSessionId, runWithAgentSessionContext } from "./agent-session-context.js";
import {
  appendSessionMessage,
  ensureSessionDir,
  readSessionMessagesTail,
  readSessionBashProcessGroups,
} from "./persistence.js";
import { drainBashProcessGroup, processGroupContainsLiveMember } from "./tools/bash.js";
import { cliCallFacts, createRunCliAgentTool } from "./tools/run-cli-agent.js";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { EventBus, EVENT_DELIVERY_RESULT, type AgentEvent } from "../app/core/events/bus.js";
import { attachEventPersistence } from "../app/daemon-events.js";
import { closeAllDbs } from "./requests.js";

const fixture = fileURLToPath(new URL("../../test/fixtures/native-cli.cjs", import.meta.url));
let root: string;
let persistDir: string;
let pids: number[];
let observed: Array<{ command: string; args: string[]; options: any }>;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "may-bounded-cli-"));
  persistDir = join(root, ".state");
  pids = [];
  observed = [];
});
afterEach(async () => {
  for (const pid of pids) await drainBashProcessGroup(pid);
  closeAllDbs();
  rmSync(root, { recursive: true, force: true });
});

function nativeSpawn(config: Record<string, unknown> = {}): typeof spawn {
  return ((command: string, args: string[], options: any) => {
    observed.push({ command, args, options });
    const child = spawn(
      process.execPath,
      [fixture, JSON.stringify({ tool: command, resultPath: args[args.indexOf("-o") + 1], ...config })],
      {
        ...options,
        env: { PATH: process.env.PATH },
      },
    );
    if (child.pid) pids.push(child.pid);
    return child;
  }) as typeof spawn;
}
function options(overrides: Partial<CliAgentOptions> = {}): CliAgentOptions {
  return {
    agentName: "may",
    projectRoot: root,
    persistDir,
    sessionId: "caller",
    spawnCommand: nativeSpawn(),
    ...overrides,
  };
}
async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Fixture did not become ready");
    await Bun.sleep(10);
  }
}
function ready(): boolean {
  const runs = join(persistDir, "cli-runs");
  if (!existsSync(runs)) return false;
  return readdirSync(runs).some((id) => readFileSync(join(runs, id, "events.jsonl"), "utf8").includes("fixture.ready"));
}

describe("bounded native CLI call", () => {
  it("projects exact CLI facts from a persisted tool result, not claims or another session", async () => {
    const tool = createRunCliAgentTool({ ...options(), getCallerSessionId: () => "caller" });
    const result = await tool.execute("tool-call", { tool: "codex", prompt: "Review" });
    const message: AgentMessage = {
      role: "toolResult",
      toolName: "run_cli_agent",
      toolCallId: "tool-call",
      ...result,
      isError: false,
      timestamp: Date.now(),
    };
    const [call] = cliCallFacts("caller", [message]);
    expect(call).toMatchObject({ sessionId: "caller", toolCallId: "tool-call", tool: "codex", status: "completed" });
    expect(call.resultPath).toBe(JSON.parse((result.content[0] as { text: string }).text).resultPath);
    expect(cliCallFacts("other-caller", [message])).toEqual([]);
    expect(cliCallFacts("caller", [{ ...message, toolCallId: "another-call" }])).toEqual([]);
    expect(cliCallFacts("caller", [{ ...message, toolName: "bash" }])).toEqual([]);
    expect(cliCallFacts("caller", [{ ...message, details: undefined }])).toEqual([]);
    expect(cliCallFacts("caller", [{ ...message, role: "user" } as unknown as AgentMessage])).toEqual([]);
    expect(cliCallFacts("caller", [message, message])).toEqual([call]);

    ensureSessionDir(persistDir, "caller");
    appendSessionMessage(persistDir, "caller", message);
    expect(cliCallFacts("caller", readSessionMessagesTail(persistDir, "caller", 100))).toEqual([call]);
    expect(cliCallFacts("caller", readSessionMessagesTail(persistDir, "caller", 0))).toEqual([]);
    const many = Array.from({ length: 70 }, (_, index) => ({
      ...message,
      toolCallId: `tool-${index}`,
      details: { cliCall: { ...call, taskId: `cli-${index}`, toolCallId: `tool-${index}` } },
    }));
    expect(cliCallFacts("caller", many)).toHaveLength(64);
  });

  for (const tool of ["codex", "claude"] as const) {
    it(`awaits ${tool} completion and keeps facts without a second work lifecycle`, async () => {
      const bus = new EventBus();
      attachEventPersistence({ bus, persistDir });
      const emitted: AgentEvent[] = [];
      let returned = false;
      const resultPromise = runCliAgent(
        { tool, prompt: "Review the facts" },
        options({
          spawnCommand: nativeSpawn({ delay: 50 }),
          emit: (event) => {
            const stored = bus.emit(event as AgentEvent);
            emitted.push(stored);
            expect(stored[EVENT_DELIVERY_RESULT]?.accepted).toBe(true);
          },
        }),
      ).then((value) => {
        returned = true;
        return value;
      });
      expect(returned).toBe(false);
      expect(readSessionBashProcessGroups(persistDir, "caller")).toEqual(pids);
      const result = await resultPromise;
      expect(result.status).toBe("completed");
      expect(result.nativeSessionId).toBe(`${tool}-thread`);
      expect(JSON.parse(readFileSync(result.structuredResultPath, "utf8"))).toEqual(result);
      expect(readFileSync(result.resultPath, "utf8")).toContain("Review completed");
      expect(result.factsRefs.every(existsSync)).toBe(true);
      expect(emitted.map((event) => event.type)).toEqual([
        "cli.task.requested",
        "cli.task.started",
        "cli.task.completed",
      ]);
      expect(readSessionBashProcessGroups(persistDir, "caller")).toEqual([]);
      expect(existsSync(join(persistDir, "cli-tasks"))).toBe(false);
      expect(existsSync(join(persistDir, "cli-sessions"))).toBe(false);
      expect(readdirSync(join(persistDir, "cli-runs", result.taskId)).sort()).toEqual([
        "events.jsonl",
        "prompt.md",
        "result.json",
        "result.md",
      ]);
    });

    it(`passes ${tool}'s explicit continuation and reports effective permissions`, async () => {
      const result = await runCliAgent(
        { tool, prompt: "Continue this exact review", resumeSessionId: "exact-thread", sandbox: "read-only" },
        options(),
      );
      expect(result.status).toBe("completed");
      expect(result.effectiveSandbox).toBe("danger-full-access");
      expect(result.sandboxFallbackReason).toContain("read-only");
      expect(observed[0]!.args).toContain("exact-thread");
      expect(observed[0]!.args).toContain(tool === "codex" ? "resume" : "--resume");
      expect(observed[0]!.args).toContain(tool === "codex" ? "danger-full-access" : "--dangerously-skip-permissions");
      expect(observed[0]!.options.detached).toBe(true);
    });
  }

  it("keeps model/config overrides and the shared endpoint without a new native home", async () => {
    const keys = [
      "CODEX_HOME",
      "MAY_CODEX_HOME",
      "CODEX_MODEL",
      "CODEX_REASONING_EFFORT",
      "CLAUDE_MODEL",
      "MODEL_BASE_URL",
      "MODEL_API_KEY",
    ];
    const prior = keys.map((key) => process.env[key]);
    try {
      for (const key of keys) delete process.env[key];
      await runCliAgent({ tool: "codex", prompt: "Review" }, options());
      expect(observed[0]!.args).toContain("gpt-5.6-sol");
      expect(observed[0]!.options.env.CODEX_HOME).toBeUndefined();
      process.env.MAY_CODEX_HOME = "/fixture/config";
      process.env.CODEX_MODEL = "fixture-codex";
      process.env.CODEX_REASONING_EFFORT = "medium";
      process.env.MODEL_BASE_URL = "https://fixture.invalid";
      process.env.MODEL_API_KEY = "fixture-key";
      await runCliAgent({ tool: "codex", prompt: "Review" }, options());
      expect(observed[1]!.args).toContain("fixture-codex");
      expect(observed[1]!.args).toContain('model_reasoning_effort="medium"');
      expect(observed[1]!.options.env.CODEX_HOME).toBe("/fixture/config");
      expect(observed[1]!.options.env.ANTHROPIC_BASE_URL).toBe("https://fixture.invalid");
      expect(observed[1]!.options.env.ANTHROPIC_API_KEY).toBe("fixture-key");
      await runCliAgent({ tool: "claude", prompt: "Review" }, options());
      expect(observed[2]!.args).toContain("claude-opus-5");
      process.env.CODEX_HOME = "/fixture/explicit";
      process.env.CLAUDE_MODEL = "fixture-claude";
      await runCliAgent({ tool: "claude", prompt: "Review" }, options());
      expect(observed[3]!.args).toContain("fixture-claude");
      expect(observed[3]!.options.env.CODEX_HOME).toBe("/fixture/explicit");
    } finally {
      keys.forEach((key, index) => {
        if (prior[index] === undefined) delete process.env[key];
        else process.env[key] = prior[index];
      });
    }
  });

  for (const [config, category] of [
    [{ noOutput: true }, "no_output"],
    [{ noProtocol: true }, "no_output"],
    [{ failedProtocol: true }, "process"],
    [{ exitCode: 2 }, "process"],
    [{ exitCode: 2, stderr: "permission denied" }, "permission"],
    [{ exitCode: 2, stderr: "command not found" }, "tool"],
    [{ oversized: true }, "no_output"],
  ] as const) {
    it(`rejects unusable results (${category}, ${Object.keys(config).join(", ")})`, async () => {
      const result = await runCliAgent(
        { tool: "codex", prompt: "Review" },
        options({ spawnCommand: nativeSpawn(config) }),
      );
      expect(result.status).toBe("failed");
      expect(result.failureCategory).toBe(category);
    });
  }

  for (const [text, requiredFields, status] of [
    ['{"verdict":"ok"}', ["verdict"], "completed"],
    ['{"verdict":"ok"}', ["toString"], "failed"],
    ["[]", [], "failed"],
    ["null", [], "failed"],
    ["not JSON", [], "failed"],
  ] as const) {
    it(`validates the requested JSON contract: ${text}, ${requiredFields}`, async () => {
      const result = await runCliAgent(
        { tool: "claude", prompt: "Review", expectedOutput: { format: "json", requiredFields: [...requiredFields] } },
        options({ spawnCommand: nativeSpawn({ text }) }),
      );
      expect(result.status).toBe(status);
      if (status === "failed") expect(result.failureCategory).toBe("output_schema");
    });
  }

  it("rejects implicit cross-task session reuse, missing identity, and invalid deadlines before spawning", async () => {
    for (const input of [{ reuseSession: true }, { timeoutMs: 0 }, { timeoutMs: Infinity }, { timeoutMs: 2 ** 31 }]) {
      await expect(runCliAgent({ tool: "codex", prompt: "Review", ...input }, options())).rejects.toThrow();
    }
    await expect(runCliAgent({ tool: "codex", prompt: "Review" }, options({ sessionId: "" }))).rejects.toThrow(
      "exact caller session",
    );
    expect(pids).toEqual([]);
    expect(existsSync(persistDir)).toBe(false);
  });

  it("scopes files and worktree paths, including symlink escapes", async () => {
    const project = join(root, "project");
    const worktree = join(root, "worktree");
    const context = join(project, "agents", "may");
    mkdirSync(context, { recursive: true });
    mkdirSync(worktree);
    writeFileSync(join(worktree, "input.md"), "facts");
    writeFileSync(join(context, "context.md"), "context");
    symlinkSync(root, join(project, "escape"));
    const scoped = options({ projectRoot: project });
    const result = await runCliAgent(
      {
        tool: "codex",
        prompt: "Patch",
        mode: "patch",
        worktree,
        worktreePolicy: "require",
        files: ["input.md", join(context, "context.md")],
      },
      scoped,
    );
    expect(result.status).toBe("completed");
    expect(observed[0]!.options.cwd).toBe(worktree);
    expect(observed[0]!.args.at(-1)).toContain(join(worktree, "input.md"));
    expect(observed[0]!.args.at(-1)).toContain(join(context, "context.md"));
    for (const input of [
      { cwd: "escape" },
      { files: ["../worktree/input.md"] },
      { mode: "patch", worktreePolicy: "require" },
      { worktree: "/" },
    ]) {
      await expect(
        runCliAgent({ tool: "codex", prompt: "Review", ...input } as CliAgentInput, scoped),
      ).rejects.toThrow();
    }
    expect(observed).toHaveLength(1);
  });

  it("stops the exact caller's process tree on cancellation, even when the leader exits zero", async () => {
    const controller = new AbortController();
    const descendant = join(root, "descendant.pid");
    const pending = runCliAgent(
      { tool: "codex", prompt: "Review" },
      options({ signal: controller.signal, spawnCommand: nativeSpawn({ hang: true, descendant }) }),
    );
    await waitFor(ready);
    controller.abort();
    const result = await pending;
    expect(result.status).toBe("failed");
    expect(result.failureCategory).toBe("cancelled");
    expect(existsSync(descendant)).toBe(true);
    expect(processGroupContainsLiveMember(pids[0]!, readdirSync("/proc"))).toBe(false);
    expect(readSessionBashProcessGroups(persistDir, "caller")).toEqual([]);
  });

  it("bounds timeouts and escalates past a native process that ignores TERM", async () => {
    const result = await runCliAgent(
      { tool: "claude", prompt: "Review", timeoutMs: 500 },
      options({ spawnCommand: nativeSpawn({ hang: true, ignoreTerm: true }) }),
    );
    expect(result.failureCategory).toBe("timeout");
    expect(processGroupContainsLiveMember(pids[0]!, readdirSync("/proc"))).toBe(false);
  });

  it("does not turn a zero exit after the deadline into success", async () => {
    const result = await runCliAgent(
      { tool: "codex", prompt: "Review", timeoutMs: 500 },
      options({ spawnCommand: nativeSpawn({ hang: true }) }),
    );
    expect(result.failureCategory).toBe("timeout");
    expect(readFileSync(result.eventsPath, "utf8")).toContain("turn.completed");
  });

  it("keeps an undrained group in the caller's recovery record", async () => {
    const result = await runCliAgent(
      { tool: "codex", prompt: "Review", timeoutMs: 50 },
      options({ spawnCommand: nativeSpawn({ hang: true }), drainProcessGroup: async () => false }),
    );
    expect(result.status).toBe("failed");
    expect(result.error).toContain("did not drain");
    expect(readSessionBashProcessGroups(persistDir, "caller")).toEqual(pids);
  });

  it("passes tool cancellation and keeps concurrent calls attached to their exact sessions", async () => {
    const tool = createRunCliAgentTool({
      ...options(),
      getCallerSessionId: () => currentAgentSessionId("may"),
      spawnCommand: nativeSpawn({ hang: true }),
    });
    const a = new AbortController();
    const b = new AbortController();
    const first = runWithAgentSessionContext("may", "first", () =>
      tool.execute("a", { tool: "codex", prompt: "A" }, a.signal),
    );
    const second = runWithAgentSessionContext("may", "second", () =>
      tool.execute("b", { tool: "claude", prompt: "B" }, b.signal),
    );
    expect(readSessionBashProcessGroups(persistDir, "first")).toEqual([pids[0]!]);
    expect(readSessionBashProcessGroups(persistDir, "second")).toEqual([pids[1]!]);
    a.abort();
    const result = await first;
    expect(JSON.parse((result.content[0] as { text: string }).text).failureCategory).toBe("cancelled");
    expect(readSessionBashProcessGroups(persistDir, "second")).toEqual([pids[1]!]);
    b.abort();
    await second;
    expect(readSessionBashProcessGroups(persistDir, "first")).toEqual([]);
    expect(readSessionBashProcessGroups(persistDir, "second")).toEqual([]);
  });

  it("fails visibly without native tools and retains the error artifact", async () => {
    const result = await runCliAgent(
      { tool: "codex", prompt: "Review" },
      options({
        spawnCommand: ((_command: string, _args: string[], opts: any) =>
          spawn(join(root, "missing-native-cli"), [], opts)) as typeof spawn,
      }),
    );
    expect(result.status).toBe("failed");
    expect(result.error).toContain("ENOENT");
    expect(JSON.parse(readFileSync(result.structuredResultPath, "utf8")).status).toBe("failed");
  });

  it("does not hide executed work when terminal observation publication fails", async () => {
    const result = await runCliAgent(
      { tool: "codex", prompt: "Review" },
      options({
        emit: (event) => {
          if (event.type === "cli.task.completed") throw new Error("fixture journal unavailable");
        },
      }),
    );
    expect(result.status).toBe("completed");
    expect(result.observationError).toBe("fixture journal unavailable");
    expect(JSON.parse(readFileSync(result.structuredResultPath, "utf8"))).toEqual(result);
    expect(pids).toHaveLength(1);
  });

  it("drains the process if recording the start fails", async () => {
    const result = await runCliAgent(
      { tool: "codex", prompt: "Review" },
      options({
        spawnCommand: nativeSpawn({ hang: true }),
        emit: (event) => {
          if (event.type === "cli.task.started") throw new Error("fixture start journal unavailable");
        },
      }),
    );
    expect(result.status).toBe("failed");
    expect(result.error).toBe("fixture start journal unavailable");
    expect(readSessionBashProcessGroups(persistDir, "caller")).toEqual([]);
    expect(processGroupContainsLiveMember(pids[0]!, readdirSync("/proc"))).toBe(false);
  });
});

describe("native protocol collector", () => {
  it("keeps Unicode intact and diagnostics bounded while parsing verbose output", () => {
    const collector = createCliOutputCollector("codex");
    collector.stderr(Buffer.from("permission denied"));
    for (let i = 0; i < 256; i++)
      collector.stdout(Buffer.from(JSON.stringify({ type: "item.updated", detail: "x".repeat(8192) }) + "\n"));
    const text = Buffer.from(
      JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "你好🌱" } }) + "\n",
    );
    for (const byte of text) collector.stdout(Buffer.from([byte]));
    collector.stdout(Buffer.from('{"type":"turn.completed"}\n'));
    const output = collector.finish();
    expect(output.finalText).toBe("你好🌱");
    expect(output.completedProtocol).toBe(true);
    expect(output.permissionFailure).toBe(true);
    expect(Buffer.byteLength(output.stdout)).toBeLessThanOrEqual(CLI_DIAGNOSTIC_TAIL_BYTES);
  });
  it("does not mistake oversized protocol lines or a later failed turn for completion", () => {
    const collector = createCliOutputCollector("claude");
    collector.stdout(
      Buffer.from(JSON.stringify({ type: "result", subtype: "success", result: "x".repeat(1024 * 1024 + 1) }) + "\n"),
    );
    expect(collector.finish().completedProtocol).toBe(false);
    const codex = createCliOutputCollector("codex");
    codex.stdout(Buffer.from('{"type":"turn.completed"}\n{"type":"turn.failed"}\n'));
    expect(codex.finish().completedProtocol).toBe(false);
  });
});

describe("read-only legacy upgrade fence", () => {
  it("allows history but never silently replays or discards pending old admissions", () => {
    assertLegacyCliTasksSettled(persistDir);
    for (const status of ["completed", "failed", "orphaned", "requested", "running", "unknown", "broken", "missing"]) {
      const dir = join(persistDir, "cli-tasks", status);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "request.json"), '{"taskId":"legacy"}');
      const original = status === "broken" ? "unreadable JSON" : JSON.stringify({ status });
      if (status !== "missing") writeFileSync(join(dir, "task.json"), original);
      if (["completed", "failed"].includes(status)) assertLegacyCliTasksSettled(persistDir);
      else expect(() => assertLegacyCliTasksSettled(persistDir)).toThrow("previous Host");
      if (status !== "missing") expect(readFileSync(join(dir, "task.json"), "utf8")).toBe(original);
      rmSync(dir, { recursive: true });
    }
  });
});
