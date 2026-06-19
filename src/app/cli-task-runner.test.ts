import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { attachCliTaskRunner, markOrphanedCliTasks } from "./cli-task-runner.js";
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
    if (outputIndex >= 0 && args[outputIndex + 1]) {
      writeFileSync(args[outputIndex + 1], "cli worker completed\n");
    } else {
      child.stdout.write("cli worker completed\n");
    }
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
    attachCliTaskRunner({ bus, persistDir, projectRoot: root, spawnCommand: fakeSpawn as any });

    const tool = createRunCliAgentTool({
      agentName: "may",
      projectRoot: root,
      persistDir,
      emit: (event) => bus.emit(event as any),
      getCallerSessionId: () => "chat-1",
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
      const completed = events.find((event) => event.type === "cli.task.completed") as any;
      expect(completed?.data?.cliSessionId).toBe("codex-session-1");
      expect(completed?.data?.resumeCommand).toContain("resume");
      expect(completed?.data?.effectiveSandbox).toBe("danger-full-access");
      expect(completed?.data?.sandboxFallbackReason).toBeUndefined();
      const steer = events.find((event) => event.type === "session.steer.requested") as any;
      expect(steer?.data?.sessionId).toBe("chat-1");
      expect(steer?.data?.message).toContain("CLI task");
      expect(steer?.data?.message).toContain(payload.resultPath);

      const db = getDb(persistDir);
      const pair = db
        .prepare("SELECT status FROM event_pair_runs WHERE pair_name = 'cli.task' AND correlation_key = ?")
        .get(payload.taskId) as { status: string } | undefined;
      expect(pair?.status).toBe("closed");
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
      expect(spawnedArgs[0]).toContain("danger-full-access");
      expect(spawnedArgs[0]).not.toContain("read-only");
      const completed = events.find((event) => event.type === "cli.task.completed") as any;
      expect(completed?.data?.effectiveSandbox).toBe("danger-full-access");
      expect(completed?.data?.sandboxFallbackReason).toBeUndefined();
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

  it("sets Codex skill home from the runner persist directory", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-cli-codex-home-"));
    const persistDir = join(root, ".state");
    mkdirSync(persistDir, { recursive: true });
    const bus = new EventBus();
    let spawnedEnv: NodeJS.ProcessEnv | undefined;
    const originalCodexHome = process.env.CODEX_HOME;
    delete process.env.CODEX_HOME;
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
      expect(spawnedEnv?.CODEX_HOME).toBe(join(persistDir, ".codex"));
    } finally {
      if (originalCodexHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = originalCodexHome;
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
});
