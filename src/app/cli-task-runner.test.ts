import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import {
  attachCliTaskRunner,
  markOrphanedCliTasks,
  recoverMissingCliTaskRecords,
} from "./cli-task-runner.js";
import { EventBus, type AgentEvent } from "./event-bus.js";
import { attachEventPersistence } from "./daemon-events.js";
import { createRunCliAgentTool } from "../lib/tools/run-cli-agent.js";
import { getDb } from "../lib/requests.js";

function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error("timed out waiting for condition"));
      setTimeout(tick, 10);
    };
    tick();
  });
}

function fakeSpawn(_command: string, args: string[]): any {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    pid: number;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.pid = 12345;
  queueMicrotask(() => {
    const outputIndex = args.indexOf("-o");
    child.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "codex-session-1" }) + "\n");
    child.stdout.write(JSON.stringify({ type: "turn.started" }) + "\n");
    if (outputIndex >= 0 && args[outputIndex + 1]) {
      writeFileSync(args[outputIndex + 1], "cli worker completed\n");
    } else {
      child.stdout.write(
        JSON.stringify({
          type: "result",
          subtype: "success",
          is_error: false,
          result: "cli worker completed",
          session_id: "claude-session-1",
        }) + "\n",
      );
    }
    child.stdout.write(JSON.stringify({ type: "turn.completed" }) + "\n");
    child.stdout.end();
    child.stderr.end();
    child.emit("close", 0, null);
  });
  return child;
}

function fakeSuccessfulSpawnWithPermissionWords(_command: string, args: string[]): any {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    pid: number;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.pid = 12346;
  queueMicrotask(() => {
    const outputIndex = args.indexOf("-o");
    child.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "codex-session-2" }) + "\n");
    child.stdout.write(
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "agent_message",
          text: "The reviewed documentation mentions permission denied and approval required.",
        },
      }) + "\n",
    );
    if (outputIndex >= 0 && args[outputIndex + 1]) {
      writeFileSync(args[outputIndex + 1], "successful review\n");
    }
    child.stdout.write(JSON.stringify({ type: "turn.completed" }) + "\n");
    child.stdout.end();
    child.stderr.end();
    child.emit("close", 0, null);
  });
  return child;
}

describe("CLI task runner", () => {
  it("tracks run_cli_agent through requested, started, and completed events", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-runner-"));
    const persistDir = join(root, ".state");
    mkdirSync(persistDir, { recursive: true });
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    attachEventPersistence({ bus, persistDir });
    bus.subscribe((event) => {
      events.push(event);
    });
    attachCliTaskRunner({
      bus,
      persistDir,
      projectRoot: root,
      spawnCommand: fakeSpawn as any,
      sourceSessionAvailable: () => true,
    });

    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
      getCallerSessionId: () => "chat-1",
      getCallerTrace: () => ({ traceId: "trace-human-cli", parentEventId: 41 }),
    });

    try {
      const result = await tool.execute("call-1", {
        tool: "codex",
        mode: "investigate",
        prompt: "Find the issue.",
        cwd: root,
      });
      const payload = JSON.parse(result.content[0].text);
      expect(payload.status).toBe("accepted");

      await waitFor(() => events.some((event) => event.type === "cli.task.completed"));

      expect(events.map((event) => event.type)).toContain("cli.task.requested");
      expect(events.map((event) => event.type)).toContain("cli.task.started");
      expect(events.map((event) => event.type)).toContain("cli.task.completed");
      const started = events.find((event) => event.type === "cli.task.started") as any;
      const completed = events.find((event) => event.type === "cli.task.completed") as any;
      expect(started?.trace?.traceId).toBe("trace-human-cli");
      expect(completed?.trace?.traceId).toBe("trace-human-cli");
      expect(completed?.data?.cliSessionId).toBe("codex-session-1");
      expect(completed?.data?.structuredResultPath).toBe(payload.structuredResultPath);
      expect(completed?.data?.resumeCommand).toContain("resume");
      expect(completed?.data?.effectiveSandbox).toBe("danger-full-access");
      expect(completed?.data?.sandboxFallbackReason).toBeUndefined();
      const structured = JSON.parse(readFileSync(payload.structuredResultPath, "utf8")) as any;
      expect(structured.status).toBe("completed");
      expect(structured.summary).toContain("cli worker completed");
      expect(structured.evidenceRefs).toContain(payload.resultPath);
      const steer = events.find((event) => event.type === "session.steer.requested") as any;
      expect(steer?.target?.sessionId).toBe("chat-1");
      expect(steer?.data?.message).toContain("CLI task");
      expect(steer?.data?.message).toContain(payload.resultPath);
      expect(steer?.data?.message).toContain(payload.structuredResultPath);

      const db = getDb(persistDir);
      const pair = db
        .prepare("SELECT status FROM event_pair_runs WHERE pair_name = 'cli.task' AND correlation_key = ?")
        .get(payload.taskId) as { status: string } | undefined;
      expect(pair?.status).toBe("closed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails admission visibly when no durable CLI runner accepts the request", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-missing-runner-"));
    const persistDir = join(root, ".state");
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
      getCallerSessionId: () => "caller-1",
    });

    try {
      const result = await tool.execute("call-missing-runner", {
        tool: "codex",
        prompt: "Do not disappear.",
        cwd: root,
      });
      const payload = JSON.parse(result.content[0].text);
      expect(payload.status).toBe("failed");
      expect(payload.error).toContain("durable runner record");
      const directory = join(persistDir, "cli-tasks", payload.taskId);
      expect(JSON.parse(readFileSync(join(directory, "task.json"), "utf8"))).toMatchObject({
        status: "failed",
        failureCategory: "admission",
      });
      expect(JSON.parse(readFileSync(join(directory, "result.json"), "utf8"))).toMatchObject({
        status: "failed",
        failureCategory: "admission",
      });
      expect(events.map((event) => event.type)).toEqual(["cli.task.requested", "cli.task.failed"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not treat permission words in a successful Codex review as a failure", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-permission-words-"));
    const persistDir = join(root, ".state");
    mkdirSync(persistDir, { recursive: true });
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    attachCliTaskRunner({
      bus,
      persistDir,
      projectRoot: root,
      spawnCommand: fakeSuccessfulSpawnWithPermissionWords as any,
    });
    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
    });

    try {
      const result = await tool.execute("call-1", {
        tool: "codex",
        mode: "review",
        prompt: "Review permission handling documentation.",
        cwd: root,
      });
      const payload = JSON.parse(result.content[0].text);
      await waitFor(() => events.some((event) => event.type === "cli.task.completed"));

      expect(events.some((event) => event.type === "cli.task.failed")).toBe(false);
      const structured = JSON.parse(readFileSync(payload.structuredResultPath, "utf8")) as any;
      expect(structured.status).toBe("completed");
      expect(structured.failureCategory).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not steer a source session that is no longer available", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-lost-source-"));
    const persistDir = join(root, ".state");
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    attachCliTaskRunner({
      bus,
      persistDir,
      projectRoot: root,
      spawnCommand: fakeSpawn as any,
      sourceSessionAvailable: () => false,
    });
    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
      getCallerSessionId: () => "lost-session",
      getCallerTrace: () => ({ traceId: "trace-human-cli" }),
    });
    try {
      await tool.execute("call-1", { tool: "codex", prompt: "Review this." });
      await waitFor(() => events.some((event) => event.type === "cli.task.completed"));
      expect(events.some((event) => event.type === "session.steer.requested")).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("normalizes stale sandbox requests to full-power Codex execution", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-full-power-"));
    const persistDir = join(root, ".state");
    mkdirSync(persistDir, { recursive: true });
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    const spawnedArgs: string[][] = [];
    const originalCodexModel = process.env.CODEX_MODEL;
    const originalCodexReasoningEffort = process.env.CODEX_REASONING_EFFORT;
    delete process.env.CODEX_MODEL;
    delete process.env.CODEX_REASONING_EFFORT;
    attachEventPersistence({ bus, persistDir });
    bus.subscribe((event) => {
      events.push(event);
    });
    attachCliTaskRunner({
      bus,
      persistDir,
      projectRoot: root,
      spawnCommand: ((_command: string, args: string[]) => {
        spawnedArgs.push(args);
        return fakeSpawn(_command, args);
      }) as any,
    });

    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
    });

    try {
      await tool.execute("call-1", {
        tool: "codex",
        mode: "investigate",
        prompt: "Find the issue.",
        cwd: root,
        sandbox: "read-only",
      });
      await waitFor(() => events.some((event) => event.type === "cli.task.completed"));

      expect(spawnedArgs).toHaveLength(1);
      expect(spawnedArgs[0]).toContain("--model");
      expect(spawnedArgs[0]?.[spawnedArgs[0].indexOf("--model") + 1]).toBe("gpt-5.6-sol");
      expect(spawnedArgs[0]).toContain('model_reasoning_effort="high"');
      expect(spawnedArgs[0]).toContain("danger-full-access");
      expect(spawnedArgs[0]).not.toContain("read-only");
      const completed = events.find((event) => event.type === "cli.task.completed") as any;
      expect(completed?.data?.effectiveSandbox).toBe("danger-full-access");
      expect(completed?.data?.sandboxFallbackReason).toContain("requested read-only was normalized");
      expect(completed?.data?.resumeCommand).toContain("gpt-5.6-sol");
      expect(completed?.data?.resumeCommand).toContain('model_reasoning_effort="high"');
    } finally {
      if (originalCodexModel === undefined) delete process.env.CODEX_MODEL;
      else process.env.CODEX_MODEL = originalCodexModel;
      if (originalCodexReasoningEffort === undefined) delete process.env.CODEX_REASONING_EFFORT;
      else process.env.CODEX_REASONING_EFFORT = originalCodexReasoningEffort;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses Claude Opus 5 by default and allows an explicit Claude model", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-claude-model-"));
    const persistDir = join(root, ".state");
    mkdirSync(persistDir, { recursive: true });
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    const spawnedArgs: string[][] = [];
    const originalClaudeModel = process.env.CLAUDE_MODEL;
    delete process.env.CLAUDE_MODEL;
    bus.subscribe((event) => events.push(event));
    attachCliTaskRunner({
      bus,
      persistDir,
      projectRoot: root,
      spawnCommand: ((_command: string, args: string[]) => {
        spawnedArgs.push(args);
        return fakeSpawn(_command, args);
      }) as any,
    });

    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
    });

    try {
      await tool.execute("call-1", {
        tool: "claude",
        prompt: "Review this.",
        cwd: root,
      });
      await waitFor(() => events.some((event) => event.type === "cli.task.completed"));

      expect(spawnedArgs[0]).toContain("--model");
      expect(spawnedArgs[0]?.[spawnedArgs[0].indexOf("--model") + 1]).toBe("claude-opus-5");
      const completed = events.find((event) => event.type === "cli.task.completed") as any;
      expect(completed?.data?.resumeCommand).toContain("--model");
      expect(completed?.data?.resumeCommand).toContain("claude-opus-5");

      process.env.CLAUDE_MODEL = "claude-sonnet-5";
      await tool.execute("call-2", {
        tool: "claude",
        prompt: "Review this with Sonnet 5.",
        cwd: root,
      });
      await waitFor(() => events.filter((event) => event.type === "cli.task.completed").length === 2);
      expect(spawnedArgs[1]?.[spawnedArgs[1].indexOf("--model") + 1]).toBe("claude-sonnet-5");
    } finally {
      if (originalClaudeModel === undefined) delete process.env.CLAUDE_MODEL;
      else process.env.CLAUDE_MODEL = originalClaudeModel;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("passes scoped files and worktree context to the native worker", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-context-"));
    const persistDir = join(root, ".state");
    const worktree = join(dirname(root), `${basename(root)}-worktree-a`);
    mkdirSync(join(worktree, "src"), { recursive: true });
    writeFileSync(join(worktree, "src", "target.ts"), "export const value = 1;\n");
    const bus = new EventBus();
    let spawnedCwd: string | undefined;
    let spawnedArgs: string[] = [];
    attachCliTaskRunner({
      bus,
      persistDir,
      projectRoot: root,
      spawnCommand: ((command: string, args: string[], options: { cwd?: string }) => {
        spawnedCwd = options.cwd;
        spawnedArgs = [command, ...args];
        return fakeSpawn(command, args);
      }) as any,
    });

    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
    });

    try {
      await tool.execute("call-1", {
        tool: "codex",
        mode: "review",
        prompt: "Review this file.",
        cwd: root,
        worktree,
        files: ["src/target.ts"],
      });
      await waitFor(() => spawnedArgs.length > 0);

      expect(spawnedCwd).toBe(worktree);
      const prompt = spawnedArgs[spawnedArgs.length - 1];
      expect(prompt).toContain(`Worktree: ${worktree}`);
      expect(prompt).toContain(join(worktree, "src", "target.ts"));
      expect(prompt).toContain("Task:\nReview this file.");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(worktree, { recursive: true, force: true });
    }
  });

  it("resolves relative files against requested cwd", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-cwd-files-"));
    const project = join(root, "project");
    const persistDir = join(root, ".state");
    mkdirSync(join(project, "src"), { recursive: true });
    writeFileSync(join(project, "src", "target.ts"), "export const value = 1;\n");
    const bus = new EventBus();
    let spawnedArgs: string[] = [];
    attachCliTaskRunner({
      bus,
      persistDir,
      projectRoot: root,
      spawnCommand: ((command: string, args: string[]) => {
        spawnedArgs = [command, ...args];
        return fakeSpawn(command, args);
      }) as any,
    });

    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
    });

    try {
      await tool.execute("call-1", {
        tool: "codex",
        mode: "review",
        prompt: "Review this file.",
        cwd: project,
        files: ["src/target.ts"],
      });
      await waitFor(() => spawnedArgs.length > 0);

      const prompt = spawnedArgs[spawnedArgs.length - 1];
      expect(prompt).toContain(join(project, "src", "target.ts"));
      expect(prompt).not.toContain(join(root, "src", "target.ts"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows only the calling agent's context root outside cwd and rejects unsafe context inputs", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-agent-context-"));
    const project = join(root, "projects", "may-agent");
    const agentDir = join(root, "agents", "may");
    const otherAgentDir = join(root, "agents", "other");
    const persistDir = join(root, ".state");
    mkdirSync(project, { recursive: true });
    mkdirSync(agentDir, { recursive: true });
    mkdirSync(otherAgentDir, { recursive: true });
    writeFileSync(join(agentDir, "AGENTS.md"), "# May\n");
    writeFileSync(join(otherAgentDir, "AGENTS.md"), "# Other\n");
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    let spawnedArgs: string[] = [];
    bus.subscribe((event) => events.push(event));
    attachCliTaskRunner({
      bus,
      persistDir,
      projectRoot: root,
      spawnCommand: ((command: string, args: string[]) => {
        spawnedArgs = [command, ...args];
        return fakeSpawn(command, args);
      }) as any,
    });
    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
    });

    try {
      await tool.execute("authorized", {
        tool: "codex",
        mode: "review",
        prompt: "Review authorized May context.",
        cwd: project,
        files: [join(agentDir, "AGENTS.md")],
      });
      await waitFor(() => events.some((event) => event.type === "cli.task.completed"));
      expect(spawnedArgs[spawnedArgs.length - 1]).toContain(join(agentDir, "AGENTS.md"));
      expect(events.some((event) => event.type === "subscriber.failed")).toBe(false);

      const negativeCases: Array<{ taskId: string; source: string; sourceOwner: string; files: unknown }> = [
        {
          taskId: "traversal-context",
          source: "agent:may",
          sourceOwner: "agent:may",
          files: ["../../foreign/secret.md"],
        },
        {
          taskId: "foreign-context",
          source: "agent:may",
          sourceOwner: "agent:may",
          files: [join(otherAgentDir, "AGENTS.md")],
        },
        {
          taskId: "malformed-context",
          source: "agent:may",
          sourceOwner: "agent:may",
          files: [42],
        },
        {
          taskId: "unauthorized-context",
          source: "agent:other",
          sourceOwner: "agent:may",
          files: [join(agentDir, "AGENTS.md")],
        },
      ];
      for (const negative of negativeCases) {
        bus.emit({
          type: "cli.task.requested",
          source: negative.source,
          owner: "runtime:cli-task-runner",
          data: {
            taskId: negative.taskId,
            tool: "codex",
            mode: "review",
            cwd: project,
            sourceOwner: negative.sourceOwner,
            files: negative.files,
          },
        } as any);
      }

      const failures = events.filter((event) => event.type === "subscriber.failed") as any[];
      expect(failures).toHaveLength(4);
      expect(failures.map((failure) => failure.data?.error).join("\n")).toContain("outside authorized context roots");
      expect(failures.map((failure) => failure.data?.error).join("\n")).toContain("array of non-empty paths");
      for (const negative of negativeCases) {
        expect(
          events.some((event: any) => event.type === "cli.task.started" && event.data?.taskId === negative.taskId),
        ).toBe(false);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("passes a requested native resume session to the CLI command", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-resume-"));
    const persistDir = join(root, ".state");
    mkdirSync(persistDir, { recursive: true });
    const bus = new EventBus();
    let spawnedArgs: string[] = [];
    attachCliTaskRunner({
      bus,
      persistDir,
      projectRoot: root,
      spawnCommand: ((command: string, args: string[]) => {
        spawnedArgs = [command, ...args];
        return fakeSpawn(command, args);
      }) as any,
    });

    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
    });

    try {
      await tool.execute("call-1", {
        tool: "codex",
        prompt: "Continue.",
        cwd: root,
        resumeSessionId: "codex-session-1",
      });
      await waitFor(() => spawnedArgs.length > 0);
      expect(spawnedArgs).toContain("resume");
      expect(spawnedArgs).toContain("codex-session-1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reuses May's stored native CLI session when requested", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-reuse-"));
    const persistDir = join(root, ".state");
    mkdirSync(persistDir, { recursive: true });
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    const spawnedArgs: string[][] = [];
    bus.subscribe((event) => {
      events.push(event);
    });
    attachCliTaskRunner({
      bus,
      persistDir,
      projectRoot: root,
      spawnCommand: ((command: string, args: string[]) => {
        spawnedArgs.push([command, ...args]);
        return fakeSpawn(command, args);
      }) as any,
    });

    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
    });

    try {
      await tool.execute("call-1", {
        tool: "codex",
        prompt: "First task.",
        cwd: root,
        reuseSession: true,
      });
      await waitFor(() => events.filter((event) => event.type === "cli.task.completed").length >= 1);

      const store = JSON.parse(readFileSync(join(persistDir, "cli-sessions", "may.json"), "utf8")) as any;
      expect(store.codex.cliSessionId).toBe("codex-session-1");

      await tool.execute("call-2", {
        tool: "codex",
        prompt: "Second task.",
        cwd: root,
        reuseSession: true,
      });
      await waitFor(() => spawnedArgs.length >= 2);

      expect(spawnedArgs[1]).toContain("resume");
      expect(spawnedArgs[1]).toContain("codex-session-1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses configured Codex home when provided", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-codex-home-"));
    const persistDir = join(root, ".state");
    const codexHome = join(persistDir, ".codex");
    mkdirSync(persistDir, { recursive: true });
    const bus = new EventBus();
    let spawnedEnv: NodeJS.ProcessEnv | undefined;
    const originalCodexHome = process.env.CODEX_HOME;
    const originalMayCodexHome = process.env.MAY_CODEX_HOME;
    process.env.CODEX_HOME = codexHome;
    delete process.env.MAY_CODEX_HOME;
    attachCliTaskRunner({
      bus,
      persistDir,
      projectRoot: root,
      spawnCommand: ((command: string, args: string[], options: { env?: NodeJS.ProcessEnv }) => {
        spawnedEnv = options.env;
        return fakeSpawn(command, args);
      }) as any,
    });

    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
    });

    try {
      await tool.execute("call-1", {
        tool: "codex",
        prompt: "Use a skill.",
        cwd: root,
      });
      await waitFor(() => Boolean(spawnedEnv));
      expect(spawnedEnv?.CODEX_HOME).toBe(codexHome);
    } finally {
      if (originalCodexHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = originalCodexHome;
      if (originalMayCodexHome === undefined) delete process.env.MAY_CODEX_HOME;
      else process.env.MAY_CODEX_HOME = originalMayCodexHome;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not force an unauthenticated Codex home by default", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-default-codex-home-"));
    const persistDir = join(root, ".state");
    mkdirSync(persistDir, { recursive: true });
    const bus = new EventBus();
    let spawnedEnv: NodeJS.ProcessEnv | undefined;
    const originalCodexHome = process.env.CODEX_HOME;
    const originalMayCodexHome = process.env.MAY_CODEX_HOME;
    delete process.env.CODEX_HOME;
    delete process.env.MAY_CODEX_HOME;
    attachCliTaskRunner({
      bus,
      persistDir,
      projectRoot: root,
      spawnCommand: ((command: string, args: string[], options: { env?: NodeJS.ProcessEnv }) => {
        spawnedEnv = options.env;
        return fakeSpawn(command, args);
      }) as any,
    });

    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
    });

    try {
      await tool.execute("call-1", {
        tool: "codex",
        prompt: "Use normal Codex auth.",
        cwd: root,
      });
      await waitFor(() => Boolean(spawnedEnv));
      expect(spawnedEnv?.CODEX_HOME).toBeUndefined();
    } finally {
      if (originalCodexHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = originalCodexHome;
      if (originalMayCodexHome === undefined) delete process.env.MAY_CODEX_HOME;
      else process.env.MAY_CODEX_HOME = originalMayCodexHome;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("passes the generic model endpoint credentials to CLI workers", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-model-endpoint-"));
    const persistDir = join(root, ".state");
    mkdirSync(persistDir, { recursive: true });
    const bus = new EventBus();
    let spawnedEnv: NodeJS.ProcessEnv | undefined;
    const originalModelApiKey = process.env.MODEL_API_KEY;
    const originalModelBaseUrl = process.env.MODEL_BASE_URL;
    const originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const originalAnthropicBaseUrl = process.env.ANTHROPIC_BASE_URL;
    process.env.MODEL_API_KEY = "endpoint-key";
    process.env.MODEL_BASE_URL = "http://model-endpoint:4000";
    process.env.ANTHROPIC_API_KEY = "direct-key";
    process.env.ANTHROPIC_BASE_URL = "https://api.anthropic.com";
    attachCliTaskRunner({
      bus,
      persistDir,
      projectRoot: root,
      spawnCommand: ((command: string, args: string[], options: { env?: NodeJS.ProcessEnv }) => {
        spawnedEnv = options.env;
        return fakeSpawn(command, args);
      }) as any,
    });

    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
    });

    try {
      await tool.execute("call-1", {
        tool: "claude",
        prompt: "Use the configured endpoint.",
        cwd: root,
      });
      await waitFor(() => Boolean(spawnedEnv));
      expect(spawnedEnv?.MODEL_API_KEY).toBe("endpoint-key");
      expect(spawnedEnv?.ANTHROPIC_API_KEY).toBe("endpoint-key");
      expect(spawnedEnv?.ANTHROPIC_BASE_URL).toBe("http://model-endpoint:4000");
    } finally {
      if (originalModelApiKey === undefined) delete process.env.MODEL_API_KEY;
      else process.env.MODEL_API_KEY = originalModelApiKey;
      if (originalModelBaseUrl === undefined) delete process.env.MODEL_BASE_URL;
      else process.env.MODEL_BASE_URL = originalModelBaseUrl;
      if (originalAnthropicApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = originalAnthropicApiKey;
      if (originalAnthropicBaseUrl === undefined) delete process.env.ANTHROPIC_BASE_URL;
      else process.env.ANTHROPIC_BASE_URL = originalAnthropicBaseUrl;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("runs Claude patch tasks with non-interactive write permissions", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-claude-patch-"));
    const persistDir = join(root, ".state");
    mkdirSync(persistDir, { recursive: true });
    const bus = new EventBus();
    let spawnedArgs: string[] = [];
    attachCliTaskRunner({
      bus,
      persistDir,
      projectRoot: root,
      spawnCommand: ((command: string, args: string[]) => {
        spawnedArgs = [command, ...args];
        return fakeSpawn(command, args);
      }) as any,
    });

    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
    });

    try {
      await tool.execute("call-1", {
        tool: "claude",
        mode: "patch",
        prompt: "Write a file.",
        cwd: root,
      });
      await waitFor(() => spawnedArgs.length > 0);
      expect(spawnedArgs).toContain("--permission-mode");
      expect(spawnedArgs).toContain("bypassPermissions");
      expect(spawnedArgs).toContain("--dangerously-skip-permissions");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires an explicitly prepared worktree when patch isolation is required", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-worktree-required-"));
    const tool = createRunCliAgentTool({ agentName: "may", projectRoot: root, persistDir: join(root, ".state") });
    try {
      const result = await tool.execute("call-1", {
        tool: "codex",
        mode: "patch",
        prompt: "Patch the code.",
        worktreePolicy: "require",
      });
      expect(JSON.parse(result.content[0].text).error).toContain("requires an explicitly prepared worktree");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("classifies a successful process with invalid expected output as an output-schema failure", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-schema-failure-"));
    const persistDir = join(root, ".state");
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    attachCliTaskRunner({ bus, persistDir, projectRoot: root, spawnCommand: fakeSpawn as any });
    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
    });
    try {
      await tool.execute("call-1", {
        tool: "codex",
        prompt: "Return JSON.",
        expectedOutput: { format: "json", requiredFields: ["summary"] },
      });
      await waitFor(() => events.some((event) => event.type === "cli.task.failed"));
      const failed = events.find((event) => event.type === "cli.task.failed") as any;
      expect(failed.data.failureCategory).toBe("output_schema");
      expect(failed.data.error).toContain("valid JSON");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("classifies a handled timeout as timeout even when Codex exits zero", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-handled-timeout-"));
    const persistDir = join(root, ".state");
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const handledTimeoutSpawn = ((_command: string, _args: string[]) => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: PassThrough;
        stderr: PassThrough;
        pid: number;
        kill: (signal: NodeJS.Signals) => boolean;
      };
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.pid = 987_654;
      child.kill = () => {
        child.stdout.end();
        child.stderr.end();
        queueMicrotask(() => child.emit("close", 0, null));
        return true;
      };
      queueMicrotask(() => {
        child.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "timed-out-session" }) + "\n");
        child.stdout.write(JSON.stringify({ type: "turn.started" }) + "\n");
      });
      return child;
    }) as any;
    attachCliTaskRunner({ bus, persistDir, projectRoot: root, spawnCommand: handledTimeoutSpawn });
    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
    });
    try {
      const accepted = await tool.execute("call-timeout", {
        tool: "codex",
        prompt: "Take longer than the deadline.",
        timeoutMs: 10,
      });
      const payload = JSON.parse(accepted.content[0].text);
      await waitFor(() => events.some((event) => event.type === "cli.task.failed"));

      const failed = events.find((event) => event.type === "cli.task.failed") as any;
      expect(failed.data.failureCategory).toBe("timeout");
      expect(events.some((event) => event.type === "cli.task.completed")).toBe(false);
      const structured = JSON.parse(readFileSync(payload.structuredResultPath, "utf8")) as any;
      expect(structured.status).toBe("timed_out");
      expect(structured.failureCategory).toBe("timeout");
      expect(readFileSync(payload.resultPath, "utf8")).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects protocol-only Codex output even when the process exits zero", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-incomplete-protocol-"));
    const persistDir = join(root, ".state");
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const incompleteSpawn = ((_command: string, _args: string[]) => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: PassThrough;
        stderr: PassThrough;
        pid: number;
      };
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.pid = 123_456;
      queueMicrotask(() => {
        child.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "incomplete-session" }) + "\n");
        child.stdout.write(JSON.stringify({ type: "turn.started" }) + "\n");
        child.stdout.end();
        child.stderr.end();
        child.emit("close", 0, null);
      });
      return child;
    }) as any;
    attachCliTaskRunner({ bus, persistDir, projectRoot: root, spawnCommand: incompleteSpawn });
    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
    });
    try {
      await tool.execute("call-incomplete", {
        tool: "codex",
        prompt: "Return a result.",
        timeoutMs: 1_000,
      });
      await waitFor(() => events.some((event) => event.type === "cli.task.failed"));

      const failed = events.find((event) => event.type === "cli.task.failed") as any;
      expect(failed.data.failureCategory).toBe("no_output");
      expect(failed.data.error).toContain("completed turn");
      expect(events.some((event) => event.type === "cli.task.completed")).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("recovers an accepted request with no runner artifact exactly once", () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-missing-artifact-recovery-"));
    const persistDir = join(root, ".state");
    const directory = join(persistDir, "cli-tasks", "cli-accepted-only");
    mkdirSync(directory, { recursive: true });
    const promptPath = join(directory, "prompt.md");
    const resultPath = join(directory, "result.md");
    writeFileSync(promptPath, "Previously accepted but never admitted");
    writeFileSync(
      join(directory, "request.json"),
      `${JSON.stringify({
        taskId: "cli-accepted-only",
        tool: "claude",
        mode: "patch",
        cwd: root,
        promptPath,
        resultPath,
        structuredResultPath: join(directory, "result.json"),
        eventsPath: join(directory, "events.jsonl"),
        sandbox: "workspace-write",
        timeoutMs: 600_000,
        sourceOwner: "agent:may",
        sourceSessionId: "caller-accepted-only",
        status: "requested",
        requestedAt: "2026-08-19T20:25:19.326Z",
      })}\n`,
    );
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));

    try {
      expect(recoverMissingCliTaskRecords({ bus, persistDir, now: () => 2_000 })).toBe(1);
      expect(recoverMissingCliTaskRecords({ bus, persistDir, now: () => 3_000 })).toBe(0);
      expect(JSON.parse(readFileSync(join(directory, "task.json"), "utf8"))).toMatchObject({
        taskId: "cli-accepted-only",
        status: "failed",
        failureCategory: "admission",
      });
      expect(JSON.parse(readFileSync(join(directory, "result.json"), "utf8"))).toMatchObject({
        status: "failed",
        failureCategory: "admission",
      });
      expect(events.filter((event) => event.type === "cli.task.failed")).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("marks stale running CLI tasks orphaned on restart", () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-orphan-"));
    const persistDir = join(root, ".state");
    const taskDir = join(persistDir, "cli-tasks", "cli-stale");
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(
      join(taskDir, "task.json"),
      `${JSON.stringify(
        {
          taskId: "cli-stale",
          tool: "codex",
          mode: "investigate",
          cwd: root,
          promptPath: join(taskDir, "prompt.md"),
          resultPath: join(taskDir, "result.md"),
          timeoutMs: 60000,
          sourceOwner: "agent:may",
          sourceSessionId: "chat-1",
          status: "running",
          requestedAt: "2026-06-19T00:00:00.000Z",
          startedAt: "2026-06-19T00:00:01.000Z",
          pid: 999,
        },
        null,
        2,
      )}\n`,
    );
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => {
      events.push(event);
    });

    try {
      const count = markOrphanedCliTasks({ bus, persistDir, now: () => 1 });
      expect(count).toBe(1);
      expect(events.some((event) => event.type === "cli.task.orphaned")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves running CLI tasks owned by a live daemon", () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-live-owner-"));
    const persistDir = join(root, ".state");
    const taskDir = join(persistDir, "cli-tasks", "cli-running");
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(
      join(taskDir, "task.json"),
      `${JSON.stringify(
        {
          taskId: "cli-running",
          tool: "codex",
          mode: "investigate",
          cwd: root,
          promptPath: join(taskDir, "prompt.md"),
          resultPath: join(taskDir, "result.md"),
          timeoutMs: 60000,
          sourceOwner: "agent:may",
          status: "running",
          requestedAt: "2026-06-19T00:00:00.000Z",
          startedAt: "2026-06-19T00:00:01.000Z",
          runnerPid: process.pid,
          pid: 999,
        },
        null,
        2,
      )}\n`,
    );
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));

    try {
      const count = markOrphanedCliTasks({ bus, persistDir, now: () => 1 });
      expect(count).toBe(0);
      expect(events.some((event) => event.type === "cli.task.orphaned")).toBe(false);
      const record = JSON.parse(readFileSync(join(taskDir, "task.json"), "utf8"));
      expect(record.status).toBe("running");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("runs May analysis inside the read-only OS sandbox with restricted CLI arguments", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-analysis-sandbox-"));
    const persistDir = join(root, ".state");
    mkdirSync(persistDir, { recursive: true });
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    const spawns: Array<{ command: string; args: string[] }> = [];
    bus.subscribe((event) => events.push(event));
    attachCliTaskRunner({
      bus,
      persistDir,
      projectRoot: root,
      spawnCommand: ((command: string, args: string[]) => {
        spawns.push({ command, args });
        return fakeSpawn(command, args);
      }) as any,
    });

    try {
      for (const [taskId, tool] of [
        ["analysis-codex", "codex"],
        ["analysis-claude", "claude"],
      ] as const) {
        const directory = join(persistDir, "cli-tasks", taskId);
        mkdirSync(directory, { recursive: true });
        const promptPath = join(directory, "prompt.md");
        writeFileSync(promptPath, "Review without changing anything");
        bus.emit({
          type: "cli.task.requested",
          source: "app:may",
          owner: "runtime:cli-task-runner",
          data: {
            taskId,
            purpose: "may-analysis",
            tool,
            mode: "review",
            cwd: root,
            promptPath,
            resultPath: join(directory, "result.md"),
            structuredResultPath: join(directory, "result.json"),
            eventsPath: join(directory, "events.jsonl"),
            sandbox: "danger-full-access",
            timeoutMs: 10_000,
            sourceOwner: "agent:may",
          },
        });
      }
      await waitFor(() => events.filter((event) => event.type === "cli.task.completed").length === 2);

      expect(spawns).toHaveLength(2);
      for (const spawn of spawns) {
        expect(spawn.command).toBe("bwrap");
        expect(spawn.args).toContain("--ro-bind");
        expect(spawn.args).toContain("--tmpfs");
      }
      const codex = spawns.find((spawn) => spawn.args.includes("codex"))!;
      expect(codex.args).toContain("read-only");
      const claude = spawns.find((spawn) => spawn.args.includes("claude"))!;
      expect(claude.args).toContain("plan");
      expect(claude.args).toContain("Read,Glob,Grep");
      expect(claude.args).not.toContain("bypassPermissions");
      expect(claude.args).not.toContain("--dangerously-skip-permissions");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resumes a durable requested CLI task after runtime restart", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-requested-recovery-"));
    const persistDir = join(root, ".state");
    const directory = join(persistDir, "cli-tasks", "analysis-requested");
    mkdirSync(directory, { recursive: true });
    const promptPath = join(directory, "prompt.md");
    const resultPath = join(directory, "result.md");
    writeFileSync(promptPath, "Recover me");
    writeFileSync(
      join(directory, "task.json"),
      `${JSON.stringify({
        taskId: "analysis-requested",
        purpose: "may-analysis",
        tool: "codex",
        mode: "review",
        cwd: root,
        promptPath,
        resultPath,
        structuredResultPath: join(directory, "result.json"),
        eventsPath: join(directory, "events.jsonl"),
        sandbox: "read-only",
        timeoutMs: 10_000,
        sourceOwner: "agent:may",
        status: "requested",
        requestedAt: "2026-08-17T00:00:00.000Z",
      })}\n`,
    );
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));

    try {
      attachCliTaskRunner({ bus, persistDir, projectRoot: root, spawnCommand: fakeSpawn as any });
      await waitFor(() => events.some((event) => event.type === "cli.task.completed"));
      expect(JSON.parse(readFileSync(join(directory, "task.json"), "utf8"))).toMatchObject({
        taskId: "analysis-requested",
        status: "completed",
        effectiveSandbox: "read-only",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
