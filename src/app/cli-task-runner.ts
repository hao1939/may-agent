import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { eventData, type AgentEvent, type EventBus, type SubscriberResult } from "./event-bus.js";

type CliTool = "claude" | "codex";
type CliMode = "investigate" | "review" | "patch";
type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";
type EffectiveSandboxMode = SandboxMode;

type CliTaskRecord = {
  taskId: string;
  tool: CliTool;
  mode: CliMode;
  cwd: string;
  promptPath: string;
  resultPath: string;
  eventsPath?: string;
  sandbox?: SandboxMode;
  effectiveSandbox?: EffectiveSandboxMode;
  sandboxFallbackReason?: string;
  timeoutMs: number;
  sourceOwner: string;
  sourceSessionId?: string;
  resumeSessionId?: string;
  cliSessionId?: string;
  resumeCommand?: string[];
  status: "requested" | "running" | "completed" | "failed" | "orphaned";
  pid?: number;
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  error?: string;
  summary?: string;
};

export type CliTaskRunnerOptions = {
  bus: EventBus;
  persistDir: string;
  projectRoot: string;
  spawnCommand?: typeof spawn;
  now?: () => number;
};

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

function iso(now: () => number): string {
  return new Date(now()).toISOString();
}

function taskDir(persistDir: string, taskId: string): string {
  return join(persistDir, "cli-tasks", taskId);
}

function taskRecordPath(persistDir: string, taskId: string): string {
  return join(taskDir(persistDir, taskId), "task.json");
}

function safeTaskId(value: unknown, now: () => number): string {
  if (typeof value === "string" && /^[a-zA-Z0-9_.:-]+$/.test(value)) return value;
  return `cli_${now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readRecord(path: string): CliTaskRecord | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as CliTaskRecord;
  } catch {
    return null;
  }
}

function writeRecord(path: string, record: CliTaskRecord): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
}

function appendFile(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { flag: "a" });
}

function ensureInside(root: string, path: string): string {
  const resolved = resolve(path);
  const base = resolve(root);
  if (resolved === base || resolved.startsWith(`${base}/`)) return resolved;
  throw new Error(`Path outside project root: ${path}`);
}

function summarize(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "(no output)";
  const line = trimmed.split("\n").find((entry) => entry.trim()) ?? trimmed;
  return line.length <= 300 ? line : `${line.slice(0, 297)}...`;
}

function exitCode(code: number | null, signal: NodeJS.Signals | null): number {
  if (code !== null) return code;
  if (signal === "SIGTERM") return 143;
  if (signal === "SIGKILL") return 137;
  return 1;
}

function codexEffectiveSandbox(record: CliTaskRecord): {
  effectiveSandbox?: EffectiveSandboxMode;
} {
  if (record.tool !== "codex") return { effectiveSandbox: record.sandbox };
  return { effectiveSandbox: record.effectiveSandbox ?? record.sandbox };
}

function codexArgs(record: CliTaskRecord, prompt: string): string[] {
  const args = ["exec", "--json", "--skip-git-repo-check"];
  const { effectiveSandbox } = codexEffectiveSandbox(record);
  if (effectiveSandbox) args.push("--sandbox", effectiveSandbox);
  args.push("-o", record.resultPath);
  if (record.resumeSessionId) args.push("resume", record.resumeSessionId, prompt);
  else args.push(prompt);
  return args;
}

function claudeArgs(record: CliTaskRecord, prompt: string): string[] {
  const args = ["-p", prompt, "--output-format", "stream-json", "--verbose"];
  if (record.mode === "patch") args.push("--permission-mode", "bypassPermissions", "--dangerously-skip-permissions");
  else args.push("--permission-mode", "plan");
  if (record.resumeSessionId) args.push("--resume", record.resumeSessionId);
  return args;
}

function commandFor(record: CliTaskRecord, prompt: string): { command: string; args: string[] } {
  return record.tool === "codex"
    ? { command: "codex", args: codexArgs(record, prompt) }
    : { command: "claude", args: claudeArgs(record, prompt) };
}

function extractCliSessionId(tool: CliTool, stdout: string): string | undefined {
  let found: string | undefined;
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      if (tool === "codex" && event.type === "thread.started" && typeof event.thread_id === "string") {
        found = event.thread_id;
      } else if (tool === "claude" && typeof event.session_id === "string") {
        found = event.session_id;
      }
    } catch {
      continue;
    }
  }
  return found;
}

function extractFinalText(tool: CliTool, stdout: string): string | undefined {
  let found: string | undefined;
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as Record<string, any>;
      if (tool === "codex" && event.type === "item.completed" && event.item?.type === "agent_message") {
        if (typeof event.item.text === "string") found = event.item.text;
      }
      if (tool === "claude") {
        if (event.type === "result" && typeof event.result === "string") found = event.result;
        if (event.type === "assistant" && Array.isArray(event.message?.content)) {
          for (const block of event.message.content) {
            if (block?.type === "text" && typeof block.text === "string") found = block.text;
          }
        }
      }
    } catch {
      continue;
    }
  }
  return found;
}

function resumeCommand(record: CliTaskRecord, sessionId: string): string[] {
  if (record.tool === "codex") {
    const args = ["codex", "exec", "--json", "--skip-git-repo-check"];
    if (record.effectiveSandbox) args.push("--sandbox", record.effectiveSandbox);
    args.push("resume", sessionId, "<prompt>");
    return args;
  }
  return ["claude", "-p", "<prompt>", "--output-format", "stream-json", "--verbose", "--resume", sessionId];
}

function shouldRetryCodexWithSandboxFallback(record: CliTaskRecord, output: string, code: number): boolean {
  if (code === 0) return false;
  if (record.tool !== "codex") return false;
  if (record.sandbox !== "read-only") return false;
  if (record.effectiveSandbox !== "read-only") return false;
  if (record.mode !== "investigate" && record.mode !== "review") return false;

  const text = output.toLowerCase();
  return (
    text.includes("bwrap") ||
    text.includes("bubblewrap") ||
    text.includes("user namespace") ||
    text.includes("unprivileged namespace") ||
    text.includes("operation not permitted")
  );
}

function sandboxMode(value: unknown): SandboxMode {
  if (value === "workspace-write" || value === "danger-full-access") return value;
  return "read-only";
}

type CliAttemptResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  error?: string;
};

async function runCliAttempt(opts: {
  bus: EventBus;
  spawnCommand: typeof spawn;
  record: CliTaskRecord;
  recordPath: string;
  prompt: string;
  now: () => number;
  attempt: number;
}): Promise<CliAttemptResult> {
  const { bus, spawnCommand, record, recordPath, prompt, now, attempt } = opts;
  const { command, args } = commandFor(record, prompt);
  const child = spawnCommand(command, args, {
    cwd: record.cwd,
    env: {
      ...process.env,
      HOME: process.env.HOME || "/app/.state",
      LITELLM_API_KEY: process.env.LITELLM_API_KEY || "sk-local",
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || process.env.LITELLM_API_KEY || "sk-local",
      ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || process.env.MODEL_BASE_URL || "http://localhost:4000",
    },
    timeout: record.timeoutMs,
    stdio: ["ignore", "pipe", "pipe"],
  });
  record.pid = child.pid;
  writeRecord(recordPath, record);
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  bus.emit({
    type: "cli.task.started",
    source: "cli-task-runner",
    owner: record.sourceOwner,
    data: {
      taskId: record.taskId,
      tool: record.tool,
      mode: record.mode,
      cwd: record.cwd,
      promptPath: record.promptPath,
      resultPath: record.resultPath,
      eventsPath: record.eventsPath,
      sourceSessionId: record.sourceSessionId,
      pid: child.pid,
      attempt,
      effectiveSandbox: record.effectiveSandbox,
      sandboxFallbackReason: record.sandboxFallbackReason,
    },
  } as any);

  child.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stdoutChunks.push(text);
    appendFile(record.eventsPath ?? record.resultPath, text);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stderrChunks.push(text);
    appendFile(record.eventsPath ?? record.resultPath, text);
  });

  return await new Promise<CliAttemptResult>((resolveDone) => {
    child.on("close", (code, signal) => {
      resolveDone({
        exitCode: exitCode(code, signal),
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
      });
    });
    child.on("error", (err) => {
      const message = err instanceof Error ? err.message : String(err);
      resolveDone({
        exitCode: 1,
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
        error: message,
      });
    });
  });
}

function emitSourceSessionUpdate(
  bus: EventBus,
  record: CliTaskRecord,
  status: "completed" | "failed" | "orphaned",
): void {
  if (!record.sourceSessionId) return;
  const lines = [
    `CLI task ${record.taskId} ${status}.`,
    `Tool: ${record.tool}`,
    record.summary ? `Summary: ${record.summary}` : undefined,
    record.error ? `Error: ${record.error}` : undefined,
    `Result: ${record.resultPath}`,
    record.eventsPath ? `Events: ${record.eventsPath}` : undefined,
    record.cliSessionId ? `CLI session: ${record.cliSessionId}` : undefined,
    record.resumeCommand ? `Resume command: ${record.resumeCommand.join(" ")}` : undefined,
    record.effectiveSandbox ? `Effective sandbox: ${record.effectiveSandbox}` : undefined,
    record.sandboxFallbackReason ? `Sandbox note: ${record.sandboxFallbackReason}` : undefined,
  ].filter(Boolean);
  bus.emit({
    type: "session.steer.requested",
    source: "cli-task-runner",
    owner: record.sourceOwner,
    data: {
      sessionId: record.sourceSessionId,
      message: lines.join("\n"),
    },
  } as any);
}

export function markOrphanedCliTasks(opts: { bus: EventBus; persistDir: string; now?: () => number }): number {
  const now = opts.now ?? Date.now;
  const root = join(opts.persistDir, "cli-tasks");
  if (!existsSync(root)) return 0;
  let count = 0;
  for (const taskId of readdirSync(root)) {
    const path = taskRecordPath(opts.persistDir, taskId);
    const record = readRecord(path);
    if (!record || record.status !== "running") continue;
    record.status = "orphaned";
    record.finishedAt = iso(now);
    record.error = "Runtime restarted while CLI task was running";
    writeRecord(path, record);
    opts.bus.emit({
      type: "cli.task.orphaned",
      source: "cli-task-runner",
      owner: record.sourceOwner,
      data: {
        taskId: record.taskId,
        tool: record.tool,
        pid: record.pid,
        reason: record.error,
        sourceSessionId: record.sourceSessionId,
        cliSessionId: record.cliSessionId,
        resumeCommand: record.resumeCommand,
        effectiveSandbox: record.effectiveSandbox,
        sandboxFallbackReason: record.sandboxFallbackReason,
      },
    } as any);
    emitSourceSessionUpdate(opts.bus, record, "orphaned");
    count++;
  }
  return count;
}

export function attachCliTaskRunner(opts: CliTaskRunnerOptions): () => void {
  const now = opts.now ?? Date.now;
  const spawnCommand = opts.spawnCommand ?? spawn;
  const running = new Set<string>();

  return opts.bus.subscribe((event: AgentEvent): SubscriberResult => {
    if (event.type !== "cli.task.requested") return;
    const data = eventData(event) as Record<string, unknown>;
    const taskId = safeTaskId(data.taskId, now);
    if (running.has(taskId)) {
      return {
        accepted: true,
        by: "cli-task-runner",
        route: "direct",
        note: "duplicate in-flight cli task request ignored",
      };
    }

    const recordPath = taskRecordPath(opts.persistDir, taskId);
    const existing = readRecord(recordPath);
    const sourceOwner = typeof data.sourceOwner === "string" ? data.sourceOwner : ((event as any).owner ?? "agent:may");
    const record: CliTaskRecord = existing ?? {
      taskId,
      tool: data.tool === "codex" ? "codex" : "claude",
      mode: data.mode === "patch" || data.mode === "review" ? data.mode : "investigate",
      cwd: typeof data.cwd === "string" ? ensureInside(opts.projectRoot, data.cwd) : opts.projectRoot,
      promptPath:
        typeof data.promptPath === "string"
          ? ensureInside(opts.projectRoot, data.promptPath)
          : join(taskDir(opts.persistDir, taskId), "prompt.md"),
      resultPath:
        typeof data.resultPath === "string"
          ? ensureInside(opts.projectRoot, data.resultPath)
          : join(taskDir(opts.persistDir, taskId), "result.md"),
      eventsPath:
        typeof data.eventsPath === "string"
          ? ensureInside(opts.projectRoot, data.eventsPath)
          : join(taskDir(opts.persistDir, taskId), "events.jsonl"),
      sandbox: sandboxMode(data.sandbox),
      timeoutMs:
        typeof data.timeoutMs === "number" && Number.isFinite(data.timeoutMs) ? data.timeoutMs : DEFAULT_TIMEOUT_MS,
      sourceOwner,
      sourceSessionId: typeof data.sourceSessionId === "string" ? data.sourceSessionId : undefined,
      resumeSessionId: typeof data.resumeSessionId === "string" ? data.resumeSessionId : undefined,
      status: "requested",
      requestedAt: iso(now),
    };
    writeRecord(recordPath, record);

    queueMicrotask(() => {
      running.add(taskId);
      void runCliTask({ bus: opts.bus, spawnCommand, record, recordPath, now }).finally(() => {
        running.delete(taskId);
      });
    });

    return {
      accepted: true,
      by: "cli-task-runner",
      route: "direct",
      note: "cli task accepted for async execution",
    };
  });
}

async function runCliTask(opts: {
  bus: EventBus;
  spawnCommand: typeof spawn;
  record: CliTaskRecord;
  recordPath: string;
  now: () => number;
}): Promise<void> {
  const { bus, spawnCommand, record, recordPath, now } = opts;
  try {
    const prompt = readFileSync(record.promptPath, "utf8");
    record.effectiveSandbox = record.sandbox;
    record.status = "running";
    record.startedAt = iso(now);
    writeRecord(recordPath, record);

    let attempt = await runCliAttempt({ bus, spawnCommand, record, recordPath, prompt, now, attempt: 1 });
    if (shouldRetryCodexWithSandboxFallback(record, `${attempt.stdout}\n${attempt.stderr}`, attempt.exitCode)) {
      record.effectiveSandbox = "danger-full-access";
      record.sandboxFallbackReason =
        "Codex read-only sandbox failed to start in this container; retried once with recorded compatibility fallback for read-only review/investigation.";
      writeRecord(recordPath, record);
      appendFile(
        record.eventsPath ?? record.resultPath,
        `${JSON.stringify({
          type: "runner.sandbox_fallback",
          tool: record.tool,
          requestedSandbox: record.sandbox,
          effectiveSandbox: record.effectiveSandbox,
          reason: record.sandboxFallbackReason,
        })}\n`,
      );
      attempt = await runCliAttempt({ bus, spawnCommand, record, recordPath, prompt, now, attempt: 2 });
    }

    record.exitCode = attempt.exitCode;
    record.finishedAt = iso(now);
    if (!existsSync(record.resultPath)) {
      const finalText = extractFinalText(record.tool, attempt.stdout);
      writeFileSync(record.resultPath, finalText ?? `${attempt.stdout}${attempt.stderr}${attempt.error ?? ""}`);
    }
    const cliSessionId = extractCliSessionId(record.tool, attempt.stdout);
    if (cliSessionId) {
      record.cliSessionId = cliSessionId;
      record.resumeCommand = resumeCommand(record, cliSessionId);
      writeFileSync(
        join(dirname(recordPath), "session.json"),
        `${JSON.stringify(
          {
            taskId: record.taskId,
            tool: record.tool,
            cliSessionId,
            resumeCommand: record.resumeCommand,
            effectiveSandbox: record.effectiveSandbox,
            sandboxFallbackReason: record.sandboxFallbackReason,
            recordedAt: iso(now),
          },
          null,
          2,
        )}\n`,
      );
    }
    const resultText = existsSync(record.resultPath) ? readFileSync(record.resultPath, "utf8") : "";
    record.summary = summarize(resultText);
    if (attempt.exitCode === 0) {
      record.status = "completed";
      writeRecord(recordPath, record);
      bus.emit({
        type: "cli.task.completed",
        source: "cli-task-runner",
        owner: record.sourceOwner,
        data: {
          taskId: record.taskId,
          tool: record.tool,
          resultPath: record.resultPath,
          eventsPath: record.eventsPath,
          exitCode: attempt.exitCode,
          summary: record.summary,
          sourceSessionId: record.sourceSessionId,
          cliSessionId: record.cliSessionId,
          resumeCommand: record.resumeCommand,
          effectiveSandbox: record.effectiveSandbox,
          sandboxFallbackReason: record.sandboxFallbackReason,
        },
      } as any);
      emitSourceSessionUpdate(bus, record, "completed");
    } else {
      record.status = "failed";
      record.error = attempt.error ?? `CLI exited with code ${attempt.exitCode}`;
      writeRecord(recordPath, record);
      bus.emit({
        type: "cli.task.failed",
        source: "cli-task-runner",
        owner: record.sourceOwner,
        data: {
          taskId: record.taskId,
          tool: record.tool,
          resultPath: record.resultPath,
          eventsPath: record.eventsPath,
          error: record.error,
          exitCode: attempt.exitCode,
          sourceSessionId: record.sourceSessionId,
          cliSessionId: record.cliSessionId,
          resumeCommand: record.resumeCommand,
          effectiveSandbox: record.effectiveSandbox,
          sandboxFallbackReason: record.sandboxFallbackReason,
        },
      } as any);
      emitSourceSessionUpdate(bus, record, "failed");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    record.status = "failed";
    record.finishedAt = iso(now);
    record.error = message;
    writeRecord(recordPath, record);
    bus.emit({
      type: "cli.task.failed",
      source: "cli-task-runner",
      owner: record.sourceOwner,
      data: {
        taskId: record.taskId,
        tool: record.tool,
        resultPath: record.resultPath,
        eventsPath: record.eventsPath,
        error: message,
        sourceSessionId: record.sourceSessionId,
        cliSessionId: record.cliSessionId,
        resumeCommand: record.resumeCommand,
        effectiveSandbox: record.effectiveSandbox,
        sandboxFallbackReason: record.sandboxFallbackReason,
      },
    } as any);
    emitSourceSessionUpdate(bus, record, "failed");
  }
}
