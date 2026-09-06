import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { eventData, type AgentEvent, type EventBus, type EventTrace, type SubscriberResult } from "./event-bus.js";

type CliTool = "claude" | "codex";
type CliMode = "investigate" | "review" | "patch";
type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";
type EffectiveSandboxMode = SandboxMode;

type CliTaskRecord = {
  taskId: string;
  purpose?: "may-analysis";
  tool: CliTool;
  mode: CliMode;
  cwd: string;
  promptPath: string;
  resultPath: string;
  structuredResultPath?: string;
  eventsPath?: string;
  sandbox?: SandboxMode;
  effectiveSandbox?: EffectiveSandboxMode;
  sandboxFallbackReason?: string;
  timeoutMs: number;
  sourceOwner: string;
  sourceSessionId?: string;
  sourceTrace?: EventTrace;
  resumeSessionId?: string;
  reuseSession?: boolean;
  files?: string[];
  worktree?: string;
  worktreePolicy?: "use-existing" | "require";
  expectedOutput?: { format: "markdown" | "json"; requiredFields?: string[] };
  cliSessionId?: string;
  resumeCommand?: string[];
  status: "requested" | "running" | "completed" | "failed" | "orphaned";
  runnerPid?: number;
  pid?: number;
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  error?: string;
  failureCategory?:
    | "timeout"
    | "permission"
    | "tool"
    | "no_output"
    | "output_schema"
    | "process"
    | "orphaned"
    | "admission";
  summary?: string;
};

type StructuredCliResult = {
  status: "completed" | "failed" | "partial" | "timed_out";
  summary: string;
  changedFiles?: string[];
  verification?: Array<{ command: string; outcome: "passed" | "failed" | "not_run"; outputRef?: string }>;
  evidenceRefs: string[];
  nativeSessionId?: string;
  nextAction?: string;
  exitCode?: number;
  error?: string;
  failureCategory?: CliTaskRecord["failureCategory"];
};

export type CliTaskRunnerOptions = {
  bus: EventBus;
  persistDir: string;
  projectRoot: string;
  spawnCommand?: typeof spawn;
  now?: () => number;
  sourceSessionAvailable?: (sessionId: string) => boolean;
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

function taskRequestPath(persistDir: string, taskId: string): string {
  return join(taskDir(persistDir, taskId), "request.json");
}

type CliSessionStore = Partial<
  Record<
    CliTool,
    {
      cliSessionId: string;
      resumeCommand?: string[];
      updatedAt: string;
      taskId?: string;
    }
  >
>;

function ownerSessionName(owner: string): string {
  const clean = owner.replace(/^agent:/, "").replace(/[^a-zA-Z0-9_.-]+/g, "-");
  return clean || "may";
}

function sessionStorePath(persistDir: string, owner: string): string {
  return join(persistDir, "cli-sessions", `${ownerSessionName(owner)}.json`);
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

function readSessionStore(persistDir: string, owner: string): CliSessionStore {
  try {
    return JSON.parse(readFileSync(sessionStorePath(persistDir, owner), "utf8")) as CliSessionStore;
  } catch {
    return {};
  }
}

function writeSessionStore(persistDir: string, owner: string, store: CliSessionStore): void {
  const path = sessionStorePath(persistDir, owner);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`);
}

function reusableSessionId(persistDir: string, record: CliTaskRecord): string | undefined {
  if (!record.reuseSession || record.resumeSessionId) return undefined;
  return readSessionStore(persistDir, record.sourceOwner)[record.tool]?.cliSessionId;
}

function rememberReusableSession(persistDir: string, record: CliTaskRecord, now: () => number): void {
  if (!record.reuseSession || !record.cliSessionId) return;
  const store = readSessionStore(persistDir, record.sourceOwner);
  store[record.tool] = {
    cliSessionId: record.cliSessionId,
    resumeCommand: record.resumeCommand,
    updatedAt: iso(now),
    taskId: record.taskId,
  };
  writeSessionStore(persistDir, record.sourceOwner, store);
}

function ensureInside(root: string, path: string): string {
  const base = resolve(root);
  const resolved = resolve(base, path);
  if (resolved === base || resolved.startsWith(`${base}/`)) return resolved;
  throw new Error(`Path outside project root: ${path}`);
}

function safeOptionalPath(root: string, value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? ensureInside(root, value) : undefined;
}

function authorizedAgentContextRoot(projectRoot: string, event: AgentEvent, sourceOwner: string): string | undefined {
  if ((event as any).source !== sourceOwner) return undefined;
  const match = /^agent:([a-zA-Z0-9_.-]+)$/.exec(sourceOwner);
  return match ? join(resolve(projectRoot), "agents", match[1]!) : undefined;
}

function ensureInsideOneOf(roots: string[], path: string): string {
  for (const root of roots) {
    try {
      return ensureInside(root, path);
    } catch {
      // Continue through the finite authorized roots.
    }
  }
  throw new Error(`Path outside authorized context roots: ${path}`);
}

function safePathList(roots: string[], value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("CLI task files must be an array of non-empty paths");
  if (value.length === 0) return undefined;
  if (value.some((entry) => typeof entry !== "string" || entry.trim().length === 0)) {
    throw new Error("CLI task files must be an array of non-empty paths");
  }
  return (value as string[]).map((entry) => ensureInsideOneOf(roots, entry));
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

const DEFAULT_CODEX_MODEL = "gpt-5.6-sol";
const DEFAULT_CODEX_REASONING_EFFORT = "high";
const DEFAULT_CLAUDE_MODEL = "claude-opus-5";

function codexBaseArgs(): string[] {
  const model = process.env.CODEX_MODEL?.trim() || DEFAULT_CODEX_MODEL;
  const reasoningEffort = process.env.CODEX_REASONING_EFFORT?.trim() || DEFAULT_CODEX_REASONING_EFFORT;
  return [
    "exec",
    "--json",
    "--skip-git-repo-check",
    "--model",
    model,
    "--config",
    `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`,
  ];
}

function codexEffectiveSandbox(record: CliTaskRecord): {
  effectiveSandbox?: EffectiveSandboxMode;
} {
  if (record.tool !== "codex") return { effectiveSandbox: record.sandbox };
  return { effectiveSandbox: record.effectiveSandbox ?? record.sandbox };
}

function codexArgs(record: CliTaskRecord, prompt: string): string[] {
  const args = codexBaseArgs();
  const { effectiveSandbox } = codexEffectiveSandbox(record);
  if (effectiveSandbox) args.push("--sandbox", effectiveSandbox);
  args.push("-o", record.resultPath);
  if (record.resumeSessionId) args.push("resume", record.resumeSessionId, prompt);
  else args.push(prompt);
  return args;
}

function claudeModelArgs(): string[] {
  return ["--model", process.env.CLAUDE_MODEL?.trim() || DEFAULT_CLAUDE_MODEL];
}

function claudeArgs(record: CliTaskRecord, prompt: string): string[] {
  const args = ["-p", prompt, ...claudeModelArgs(), "--output-format", "stream-json", "--verbose"];
  if (record.purpose === "may-analysis") {
    args.push(
      "--permission-mode",
      "plan",
      "--allowedTools",
      "Read,Glob,Grep",
      "--disallowedTools",
      "Edit,Write,Bash,NotebookEdit",
    );
  } else {
    args.push("--permission-mode", "bypassPermissions", "--dangerously-skip-permissions");
  }
  if (record.resumeSessionId) args.push("--resume", record.resumeSessionId);
  return args;
}

function commandFor(record: CliTaskRecord, prompt: string): { command: string; args: string[] } {
  return record.tool === "codex"
    ? { command: "codex", args: codexArgs(record, prompt) }
    : { command: "claude", args: claudeArgs(record, prompt) };
}

function promptForRun(record: CliTaskRecord, prompt: string): string {
  const context: string[] = [];
  if (record.worktree) context.push(`Worktree: ${record.worktree}`);
  if (record.files?.length) {
    context.push("Relevant files:");
    for (const file of record.files) context.push(`- ${file}`);
  }
  if (context.length === 0) return prompt;
  return `${context.join("\n")}\n\nTask:\n${prompt}`;
}

export const CLI_DIAGNOSTIC_TAIL_BYTES = 64 * 1024;
const CLI_PROTOCOL_LINE_MAX_CHARS = 1024 * 1024;

type CliOutputSnapshot = {
  stdout: string;
  stderr: string;
  completedProtocol: boolean;
  finalText?: string;
  cliSessionId?: string;
  permissionFailure: boolean;
  toolFailure: boolean;
};

function appendBoundedTail(current: Buffer, chunk: Buffer): Buffer {
  if (chunk.byteLength >= CLI_DIAGNOSTIC_TAIL_BYTES) {
    return Buffer.from(chunk.subarray(chunk.byteLength - CLI_DIAGNOSTIC_TAIL_BYTES));
  }
  const retainedCurrentBytes = Math.min(current.byteLength, CLI_DIAGNOSTIC_TAIL_BYTES - chunk.byteLength);
  return Buffer.concat([current.subarray(current.byteLength - retainedCurrentBytes), chunk]);
}

/** Incrementally reads native JSONL protocol while retaining only bounded diagnostics. */
export function createCliOutputCollector(tool: CliTool): {
  stdout: (chunk: Buffer) => void;
  stderr: (chunk: Buffer) => void;
  finish: () => CliOutputSnapshot;
} {
  const decoder = new StringDecoder("utf8");
  let pendingLine = "";
  let skipOversizedLine = false;
  let stdoutTail: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let stderrTail: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let completedProtocol = false;
  let finalText: string | undefined;
  let cliSessionId: string | undefined;
  let permissionFailure = false;
  let toolFailure = false;
  let diagnosticCarry = "";

  const inspectDiagnostics = (text: string): void => {
    const sample = diagnosticCarry + text;
    permissionFailure ||= /permission denied|not permitted|approval required|sandbox.*denied|EACCES/i.test(sample);
    toolFailure ||= /tool.*(?:failed|error)|command not found|ENOENT/i.test(sample);
    diagnosticCarry = sample.slice(-256);
  };

  const inspectLine = (line: string): void => {
    if (!line.trim()) return;
    try {
      const event = JSON.parse(line) as Record<string, any>;
      if (tool === "codex") {
        if (event.type === "thread.started" && typeof event.thread_id === "string") cliSessionId = event.thread_id;
        if (event.type === "turn.completed") completedProtocol = true;
        if (event.type === "item.completed" && event.item?.type === "agent_message") {
          if (typeof event.item.text === "string") finalText = event.item.text;
        }
        return;
      }
      if (typeof event.session_id === "string") cliSessionId = event.session_id;
      if (event.type === "result") {
        if (event.subtype === "success" && event.is_error !== true) completedProtocol = true;
        if (typeof event.result === "string") finalText = event.result;
      }
      if (event.type === "assistant" && Array.isArray(event.message?.content)) {
        for (const block of event.message.content) {
          if (block?.type === "text" && typeof block.text === "string") finalText = block.text;
        }
      }
    } catch {
      // Non-protocol output remains available in the durable events file.
    }
  };

  const consume = (text: string): void => {
    let remaining = text;
    while (remaining.length > 0) {
      if (skipOversizedLine) {
        const newline = remaining.indexOf("\n");
        if (newline < 0) return;
        skipOversizedLine = false;
        remaining = remaining.slice(newline + 1);
        continue;
      }
      const newline = remaining.indexOf("\n");
      if (newline < 0) {
        pendingLine += remaining;
        if (pendingLine.length > CLI_PROTOCOL_LINE_MAX_CHARS) {
          pendingLine = "";
          skipOversizedLine = true;
        }
        return;
      }
      pendingLine += remaining.slice(0, newline);
      inspectLine(pendingLine);
      pendingLine = "";
      remaining = remaining.slice(newline + 1);
    }
  };

  return {
    stdout(chunk) {
      const text = decoder.write(chunk);
      stdoutTail = appendBoundedTail(stdoutTail, chunk);
      inspectDiagnostics(text);
      consume(text);
    },
    stderr(chunk) {
      const text = chunk.toString("utf8");
      stderrTail = appendBoundedTail(stderrTail, chunk);
      inspectDiagnostics(text);
    },
    finish() {
      const remainder = decoder.end();
      if (remainder) {
        inspectDiagnostics(remainder);
        consume(remainder);
      }
      if (!skipOversizedLine) inspectLine(pendingLine);
      return {
        stdout: stdoutTail.toString("utf8"),
        stderr: stderrTail.toString("utf8"),
        completedProtocol,
        finalText,
        cliSessionId,
        permissionFailure,
        toolFailure,
      };
    },
  };
}

function resumeCommand(record: CliTaskRecord, sessionId: string): string[] {
  if (record.tool === "codex") {
    const args = ["codex", ...codexBaseArgs()];
    if (record.effectiveSandbox) args.push("--sandbox", record.effectiveSandbox);
    args.push("resume", sessionId, "<prompt>");
    return args;
  }
  const args = ["claude", "-p", "<prompt>", ...claudeModelArgs(), "--output-format", "stream-json", "--verbose"];
  if (record.purpose === "may-analysis") {
    args.push(
      "--permission-mode",
      "plan",
      "--allowedTools",
      "Read,Glob,Grep",
      "--disallowedTools",
      "Edit,Write,Bash,NotebookEdit",
    );
  } else {
    args.push("--permission-mode", "bypassPermissions", "--dangerously-skip-permissions");
  }
  args.push("--resume", sessionId);
  return args;
}

function sandboxMode(value: unknown): SandboxMode {
  if (value === "read-only" || value === "workspace-write" || value === "danger-full-access") return value;
  return "danger-full-access";
}

function effectiveSandboxFor(
  record: CliTaskRecord,
  requested: SandboxMode,
): {
  effectiveSandbox: EffectiveSandboxMode;
  sandboxFallbackReason?: string;
} {
  if (record.purpose === "may-analysis") return { effectiveSandbox: "read-only" };
  if (requested === "danger-full-access") return { effectiveSandbox: "danger-full-access" };
  return {
    effectiveSandbox: "danger-full-access",
    sandboxFallbackReason: `May CLI workers run with danger-full-access in the trusted container; requested ${requested} was normalized.`,
  };
}

type CliAttemptResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  completedProtocol: boolean;
  finalText?: string;
  cliSessionId?: string;
  permissionFailure: boolean;
  toolFailure: boolean;
  timedOut: boolean;
  error?: string;
};

const CLI_TERMINATION_GRACE_MS = 1_000;

function signalCliProcessTree(child: ReturnType<typeof spawn>, signal: NodeJS.Signals): void {
  if (process.platform !== "win32" && child.pid) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall back to the direct child when it did not start a process group.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // The process may already have exited.
  }
}

function structuredStatus(record: CliTaskRecord): StructuredCliResult["status"] {
  if (record.status === "orphaned") return "failed";
  if (record.error?.toLowerCase().includes("timeout")) return "timed_out";
  if (record.status === "completed") return "completed";
  return "failed";
}

function classifyCliOutcome(
  tool: CliTool,
  attempt: CliAttemptResult,
  resultText: string,
  expected?: CliTaskRecord["expectedOutput"],
): { failureCategory?: CliTaskRecord["failureCategory"]; error?: string } {
  const diagnosticText = `${attempt.stderr}\n${attempt.stdout}\n${attempt.error ?? ""}`;
  const permissionFailure =
    attempt.permissionFailure ||
    /permission denied|not permitted|approval required|sandbox.*denied|EACCES/i.test(diagnosticText);
  if (attempt.timedOut) {
    return {
      failureCategory: "timeout",
      error: attempt.error ?? "CLI task exceeded its timeout",
    };
  }
  if (attempt.exitCode !== 0) {
    if (permissionFailure) {
      return {
        failureCategory: "permission",
        error: "CLI worker was denied a required permission",
      };
    }
    const category =
      attempt.toolFailure || /tool.*(?:failed|error)|command not found|ENOENT/i.test(diagnosticText)
        ? "tool"
        : "process";
    return { failureCategory: category, error: attempt.error ?? `CLI exited with code ${attempt.exitCode}` };
  }
  if (!attempt.completedProtocol) {
    if (permissionFailure) {
      return {
        failureCategory: "permission",
        error: "CLI worker was denied a required permission",
      };
    }
    return {
      failureCategory: "no_output",
      error: `CLI exited without a completed ${tool === "codex" ? "turn" : "result"}`,
    };
  }
  if (!resultText.trim()) {
    return { failureCategory: "no_output", error: "CLI worker exited successfully without a usable result" };
  }
  if (expected?.format === "json") {
    try {
      const parsed = JSON.parse(resultText) as Record<string, unknown>;
      const missing = (expected.requiredFields ?? []).filter((field) => !(field in parsed));
      if (missing.length > 0) {
        return {
          failureCategory: "output_schema",
          error: `CLI JSON result is missing required fields: ${missing.join(", ")}`,
        };
      }
    } catch (err) {
      return {
        failureCategory: "output_schema",
        error: `CLI result is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
  return {};
}

function writeStructuredResult(record: CliTaskRecord): void {
  if (!record.structuredResultPath) return;
  const evidenceRefs = [record.resultPath, record.eventsPath].filter((entry): entry is string => Boolean(entry));
  const result: StructuredCliResult = {
    status: structuredStatus(record),
    summary: record.summary ?? record.error ?? "(no summary)",
    evidenceRefs,
    nativeSessionId: record.cliSessionId,
    exitCode: record.exitCode,
    error: record.error,
    failureCategory: record.failureCategory,
  };
  mkdirSync(dirname(record.structuredResultPath), { recursive: true });
  writeFileSync(record.structuredResultPath, `${JSON.stringify(result, null, 2)}\n`);
}

function cliEnv(record?: CliTaskRecord): NodeJS.ProcessEnv {
  const modelApiKey = process.env.MODEL_API_KEY || "not-needed";
  const modelBaseUrl = process.env.MODEL_BASE_URL || "http://localhost:4000";
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: process.env.HOME || "/app/.state",
    MODEL_API_KEY: modelApiKey,
    ANTHROPIC_API_KEY: modelApiKey,
    ANTHROPIC_BASE_URL: modelBaseUrl,
  };
  const codexHome = process.env.CODEX_HOME || process.env.MAY_CODEX_HOME;
  if (codexHome) env.CODEX_HOME = codexHome;
  if (record?.purpose === "may-analysis") {
    const analysisHome = join(dirname(record.promptPath), "home");
    const analysisCodexHome = join(analysisHome, ".codex");
    mkdirSync(analysisCodexHome, { recursive: true });
    env.HOME = analysisHome;
    env.CODEX_HOME = analysisCodexHome;
    const baseUrl = modelBaseUrl.endsWith("/v1") ? modelBaseUrl : `${modelBaseUrl.replace(/\/$/, "")}/v1`;
    writeFileSync(
      join(analysisCodexHome, "config.toml"),
      [
        'model_provider = "model_endpoint"',
        'approval_policy = "never"',
        'sandbox_mode = "read-only"',
        "check_for_update_on_startup = false",
        "",
        "[model_providers.model_endpoint]",
        'name = "Configured model endpoint"',
        `base_url = ${JSON.stringify(baseUrl)}`,
        'env_key = "MODEL_API_KEY"',
        'wire_api = "responses"',
        "",
      ].join("\n"),
    );
  }
  return env;
}

function sandboxedCommand(record: CliTaskRecord, command: string, args: string[]): { command: string; args: string[] } {
  if (record.purpose !== "may-analysis") return { command, args };
  const writableTaskDir = dirname(record.promptPath);
  return {
    command: "bwrap",
    args: [
      "--die-with-parent",
      "--ro-bind",
      "/",
      "/",
      "--dev",
      "/dev",
      "--proc",
      "/proc",
      "--tmpfs",
      "/tmp",
      "--tmpfs",
      "/var/tmp",
      "--bind",
      writableTaskDir,
      writableTaskDir,
      "--chdir",
      record.cwd,
      "--",
      command,
      ...args,
    ],
  };
}

async function runCliAttempt(opts: {
  bus: EventBus;
  spawnCommand: typeof spawn;
  persistDir: string;
  record: CliTaskRecord;
  recordPath: string;
  prompt: string;
  now: () => number;
  attempt: number;
  signal: AbortSignal;
}): Promise<CliAttemptResult> {
  const { bus, spawnCommand, record, recordPath, prompt, attempt, signal } = opts;
  const native = commandFor(record, prompt);
  const { command, args } = sandboxedCommand(record, native.command, native.args);
  const collector = createCliOutputCollector(record.tool);
  const eventsPath = record.eventsPath ?? record.resultPath;
  mkdirSync(dirname(eventsPath), { recursive: true });
  const eventsFd = openSync(eventsPath, "a");
  let eventsClosed = false;
  let child: ReturnType<typeof spawn>;
  try {
    child = spawnCommand(command, args, {
      cwd: record.worktree ?? record.cwd,
      env: cliEnv(record),
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    closeSync(eventsFd);
    throw error;
  }
  record.runnerPid = process.pid;
  record.pid = child.pid;
  writeRecord(recordPath, record);

  const retainEventChunk = (chunk: Buffer): void => {
    if (!eventsClosed) writeSync(eventsFd, chunk);
  };

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
      structuredResultPath: record.structuredResultPath,
      eventsPath: record.eventsPath,
      sourceSessionId: record.sourceSessionId,
      pid: child.pid,
      attempt,
      effectiveSandbox: record.effectiveSandbox,
      sandboxFallbackReason: record.sandboxFallbackReason,
      reuseSession: record.reuseSession,
    },
    ...(record.sourceTrace ? { trace: record.sourceTrace } : {}),
  } as any);

  child.stdout?.on("data", (chunk: Buffer) => {
    collector.stdout(chunk);
    retainEventChunk(chunk);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    collector.stderr(chunk);
    retainEventChunk(chunk);
  });

  return await new Promise<CliAttemptResult>((resolveDone) => {
    let settled = false;
    let timedOut = false;
    let aborted = false;
    let forceTimer: ReturnType<typeof setTimeout> | undefined;
    const terminate = () => {
      if (forceTimer) clearTimeout(forceTimer);
      forceTimer = setTimeout(() => {
        signalCliProcessTree(child, "SIGKILL");
      }, CLI_TERMINATION_GRACE_MS);
      signalCliProcessTree(child, "SIGTERM");
    };
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      terminate();
    }, record.timeoutMs);
    const stopForAbort = () => {
      if (settled || aborted) return;
      aborted = true;
      terminate();
    };
    const finish = (result: Pick<CliAttemptResult, "exitCode" | "timedOut" | "error">): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      if (forceTimer) clearTimeout(forceTimer);
      signal.removeEventListener("abort", stopForAbort);
      if (!eventsClosed) {
        eventsClosed = true;
        closeSync(eventsFd);
      }
      resolveDone({ ...result, ...collector.finish() });
    };
    child.on("close", (code, signal) => {
      finish({
        exitCode: exitCode(code, signal),
        timedOut,
        error: aborted
          ? opts.signal.reason instanceof Error
            ? opts.signal.reason.message
            : "CLI task was cancelled"
          : timedOut
          ? `CLI task exceeded timeout ${record.timeoutMs}ms`
          : signal
            ? `CLI task was terminated by ${signal}`
            : undefined,
      });
    });
    child.on("error", (err) => {
      const message = err instanceof Error ? err.message : String(err);
      finish({
        exitCode: 1,
        timedOut,
        error: message,
      });
    });
    signal.addEventListener("abort", stopForAbort, { once: true });
    if (signal.aborted) stopForAbort();
  });
}

function emitSourceSessionUpdate(
  bus: EventBus,
  record: CliTaskRecord,
  status: "completed" | "failed" | "orphaned",
  sourceSessionAvailable?: (sessionId: string) => boolean,
): void {
  if (!record.sourceSessionId) return;
  if (sourceSessionAvailable && !sourceSessionAvailable(record.sourceSessionId)) return;
  const lines = [
    `CLI task ${record.taskId} ${status}.`,
    `Tool: ${record.tool}`,
    record.summary ? `Summary: ${record.summary}` : undefined,
    record.error ? `Error: ${record.error}` : undefined,
    `Result: ${record.resultPath}`,
    record.structuredResultPath ? `Structured result: ${record.structuredResultPath}` : undefined,
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
    target: { sessionId: record.sourceSessionId },
    data: {
      message: lines.join("\n"),
    },
  } as any);
}

export function recoverMissingCliTaskRecords(opts: {
  bus: EventBus;
  persistDir: string;
  now?: () => number;
}): number {
  const now = opts.now ?? Date.now;
  const root = join(opts.persistDir, "cli-tasks");
  if (!existsSync(root)) return 0;
  let count = 0;
  for (const taskId of readdirSync(root)) {
    const recordPath = taskRecordPath(opts.persistDir, taskId);
    if (existsSync(recordPath)) continue;
    let request: Partial<CliTaskRecord>;
    try {
      request = JSON.parse(readFileSync(taskRequestPath(opts.persistDir, taskId), "utf8")) as Partial<CliTaskRecord>;
    } catch {
      continue;
    }
    if (
      request.taskId !== taskId ||
      (request.tool !== "claude" && request.tool !== "codex") ||
      typeof request.cwd !== "string" ||
      typeof request.promptPath !== "string" ||
      typeof request.resultPath !== "string" ||
      typeof request.timeoutMs !== "number" ||
      typeof request.sourceOwner !== "string"
    ) {
      continue;
    }
    const error = "Runtime recovered an accepted CLI request without a durable runner record";
    const record: CliTaskRecord = {
      ...(request as CliTaskRecord),
      taskId,
      mode: request.mode === "patch" || request.mode === "review" ? request.mode : "investigate",
      status: "failed",
      requestedAt: request.requestedAt ?? iso(now),
      finishedAt: iso(now),
      error,
      failureCategory: "admission",
      summary: error,
    };
    if (!existsSync(record.resultPath)) writeFileSync(record.resultPath, "");
    writeStructuredResult(record);
    writeRecord(recordPath, record);
    opts.bus.emit({
      type: "cli.task.failed",
      source: "cli-task-runner",
      owner: record.sourceOwner,
      data: {
        taskId: record.taskId,
        tool: record.tool,
        resultPath: record.resultPath,
        structuredResultPath: record.structuredResultPath,
        eventsPath: record.eventsPath,
        error,
        failureCategory: record.failureCategory,
        sourceSessionId: record.sourceSessionId,
      },
      ...(record.sourceTrace ? { trace: record.sourceTrace } : {}),
    } as any);
    count++;
  }
  return count;
}

export function markOrphanedCliTasks(opts: {
  bus: EventBus;
  persistDir: string;
  now?: () => number;
  sourceSessionAvailable?: (sessionId: string) => boolean;
}): number {
  const now = opts.now ?? Date.now;
  const root = join(opts.persistDir, "cli-tasks");
  if (!existsSync(root)) return 0;
  let count = 0;
  for (const taskId of readdirSync(root)) {
    const path = taskRecordPath(opts.persistDir, taskId);
    const record = readRecord(path);
    if (!record || record.status !== "running") continue;
    if (record.runnerPid) {
      try {
        process.kill(record.runnerPid, 0);
        continue;
      } catch {
        // The runtime that owned this task is gone, so recovery may orphan it.
      }
    }
    record.status = "orphaned";
    record.finishedAt = iso(now);
    record.error = "Runtime restarted while CLI task was running";
    record.failureCategory = "orphaned";
    record.summary = record.error;
    writeStructuredResult(record);
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
        structuredResultPath: record.structuredResultPath,
        sourceSessionId: record.sourceSessionId,
        cliSessionId: record.cliSessionId,
        resumeCommand: record.resumeCommand,
        effectiveSandbox: record.effectiveSandbox,
        sandboxFallbackReason: record.sandboxFallbackReason,
        reuseSession: record.reuseSession,
      },
      ...(record.sourceTrace ? { trace: record.sourceTrace } : {}),
    } as any);
    emitSourceSessionUpdate(opts.bus, record, "orphaned", opts.sourceSessionAvailable);
    count++;
  }
  return count;
}

export function attachCliTaskRunner(opts: CliTaskRunnerOptions): () => void {
  const now = opts.now ?? Date.now;
  const spawnCommand = opts.spawnCommand ?? spawn;
  const running = new Map<string, AbortController>();

  const schedule = (record: CliTaskRecord, recordPath: string): void => {
    if (running.has(record.taskId)) return;
    const controller = new AbortController();
    running.set(record.taskId, controller);
    queueMicrotask(() => {
      void runCliTask({
        bus: opts.bus,
        spawnCommand,
        persistDir: opts.persistDir,
        record,
        recordPath,
        now,
        signal: controller.signal,
        sourceSessionAvailable: opts.sourceSessionAvailable,
      }).finally(() => {
        running.delete(record.taskId);
      });
    });
  };

  const unsubscribe = opts.bus.subscribeDurableRoute((event: AgentEvent): SubscriberResult => {
    if (event.type === "cli.task.cancelled") {
      const data = eventData(event) as Record<string, unknown>;
      const taskId = typeof data.taskId === "string" ? data.taskId : "";
      const controller = running.get(taskId);
      if (controller) {
        const reason = typeof data.reason === "string" ? data.reason : "CLI task was cancelled";
        controller.abort(new Error(reason));
      }
      return {
        accepted: true,
        by: "cli-task-runner",
        route: "direct",
        note: controller ? "active cli task cancellation accepted" : "cli task was not active",
      };
    }
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
    if (existing && ["completed", "failed", "orphaned"].includes(existing.status)) {
      return {
        accepted: true,
        by: "cli-task-runner",
        route: "direct",
        note: "duplicate terminal cli task request ignored",
      };
    }
    const sourceOwner = typeof data.sourceOwner === "string" ? data.sourceOwner : ((event as any).owner ?? "agent:may");
    const cwd = typeof data.cwd === "string" ? ensureInside(opts.projectRoot, data.cwd) : opts.projectRoot;
    const worktree = safeOptionalPath(dirname(opts.projectRoot), data.worktree);
    const filesRoot = worktree ?? cwd;
    const agentContextRoot = authorizedAgentContextRoot(opts.projectRoot, event, sourceOwner);
    const authorizedFileRoots = agentContextRoot ? [filesRoot, agentContextRoot] : [filesRoot];
    const record: CliTaskRecord = existing ?? {
      taskId,
      purpose: data.purpose === "may-analysis" ? "may-analysis" : undefined,
      tool: data.tool === "codex" ? "codex" : "claude",
      mode: data.mode === "patch" || data.mode === "review" ? data.mode : "investigate",
      cwd,
      promptPath:
        typeof data.promptPath === "string"
          ? ensureInside(opts.projectRoot, data.promptPath)
          : join(taskDir(opts.persistDir, taskId), "prompt.md"),
      resultPath:
        typeof data.resultPath === "string"
          ? ensureInside(opts.projectRoot, data.resultPath)
          : join(taskDir(opts.persistDir, taskId), "result.md"),
      structuredResultPath:
        typeof data.structuredResultPath === "string"
          ? ensureInside(opts.projectRoot, data.structuredResultPath)
          : join(taskDir(opts.persistDir, taskId), "result.json"),
      eventsPath:
        typeof data.eventsPath === "string"
          ? ensureInside(opts.projectRoot, data.eventsPath)
          : join(taskDir(opts.persistDir, taskId), "events.jsonl"),
      sandbox: sandboxMode(data.sandbox),
      timeoutMs:
        typeof data.timeoutMs === "number" && Number.isFinite(data.timeoutMs) ? data.timeoutMs : DEFAULT_TIMEOUT_MS,
      sourceOwner,
      sourceSessionId: typeof data.sourceSessionId === "string" ? data.sourceSessionId : undefined,
      sourceTrace: event.trace,
      resumeSessionId: typeof data.resumeSessionId === "string" ? data.resumeSessionId : undefined,
      reuseSession: data.reuseSession === true,
      files: safePathList(authorizedFileRoots, data.files),
      worktree,
      worktreePolicy: data.worktreePolicy === "require" ? "require" : "use-existing",
      expectedOutput:
        data.expectedOutput && typeof data.expectedOutput === "object"
          ? {
              format: (data.expectedOutput as any).format === "json" ? "json" : "markdown",
              requiredFields: Array.isArray((data.expectedOutput as any).requiredFields)
                ? (data.expectedOutput as any).requiredFields.filter(
                    (field: unknown): field is string => typeof field === "string",
                  )
                : undefined,
            }
          : undefined,
      status: "requested",
      requestedAt: iso(now),
    };
    record.resumeSessionId ??= reusableSessionId(opts.persistDir, record);
    writeRecord(recordPath, record);

    schedule(record, recordPath);

    return {
      accepted: true,
      by: "cli-task-runner",
      route: "direct",
      note: "cli task accepted for async execution",
    };
  });

  // A crash can happen after a requested record is durable but before its
  // queued microtask starts. Requested records are safe to resume because the
  // task ID is the admission identity and terminal records are never rerun.
  const root = join(opts.persistDir, "cli-tasks");
  if (existsSync(root)) {
    for (const taskId of readdirSync(root)) {
      const path = taskRecordPath(opts.persistDir, taskId);
      const record = readRecord(path);
      if (record?.status === "requested") schedule(record, path);
    }
  }

  return unsubscribe;
}

async function runCliTask(opts: {
  bus: EventBus;
  spawnCommand: typeof spawn;
  persistDir: string;
  record: CliTaskRecord;
  recordPath: string;
  now: () => number;
  signal: AbortSignal;
  sourceSessionAvailable?: (sessionId: string) => boolean;
}): Promise<void> {
  const { bus, spawnCommand, persistDir, record, recordPath, now, signal, sourceSessionAvailable } = opts;
  try {
    signal.throwIfAborted();
    const prompt = promptForRun(record, readFileSync(record.promptPath, "utf8"));
    record.resumeSessionId ??= reusableSessionId(persistDir, record);
    const sandbox = effectiveSandboxFor(record, record.sandbox ?? "danger-full-access");
    record.effectiveSandbox = sandbox.effectiveSandbox;
    record.sandboxFallbackReason = sandbox.sandboxFallbackReason;
    record.status = "running";
    record.startedAt = iso(now);
    writeRecord(recordPath, record);

    const attempt = await runCliAttempt({
      bus,
      spawnCommand,
      persistDir,
      record,
      recordPath,
      prompt,
      now,
      attempt: 1,
      signal,
    });

    record.exitCode = attempt.exitCode;
    record.finishedAt = iso(now);
    if (!existsSync(record.resultPath)) {
      writeFileSync(record.resultPath, attempt.finalText ?? "");
    }
    const cliSessionId = attempt.cliSessionId;
    if (cliSessionId) {
      record.cliSessionId = cliSessionId;
      record.resumeCommand = resumeCommand(record, cliSessionId);
      rememberReusableSession(persistDir, record, now);
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
            reuseSession: record.reuseSession,
            recordedAt: iso(now),
          },
          null,
          2,
        )}\n`,
      );
    }
    const resultText = existsSync(record.resultPath) ? readFileSync(record.resultPath, "utf8") : "";
    record.summary = summarize(resultText);
    const outcome = classifyCliOutcome(record.tool, attempt, resultText, record.expectedOutput);
    if (!outcome.failureCategory) {
      record.status = "completed";
      writeStructuredResult(record);
      writeRecord(recordPath, record);
      bus.emit({
        type: "cli.task.completed",
        source: "cli-task-runner",
        owner: record.sourceOwner,
        data: {
          taskId: record.taskId,
          tool: record.tool,
          resultPath: record.resultPath,
          structuredResultPath: record.structuredResultPath,
          eventsPath: record.eventsPath,
          exitCode: attempt.exitCode,
          summary: record.summary,
          sourceSessionId: record.sourceSessionId,
          cliSessionId: record.cliSessionId,
          resumeCommand: record.resumeCommand,
          effectiveSandbox: record.effectiveSandbox,
          sandboxFallbackReason: record.sandboxFallbackReason,
          reuseSession: record.reuseSession,
        },
        ...(record.sourceTrace ? { trace: record.sourceTrace } : {}),
      } as any);
      emitSourceSessionUpdate(bus, record, "completed", sourceSessionAvailable);
    } else {
      record.status = "failed";
      record.failureCategory = outcome.failureCategory;
      record.error = outcome.error ?? `CLI exited with code ${attempt.exitCode}`;
      record.summary = record.error;
      writeStructuredResult(record);
      writeRecord(recordPath, record);
      bus.emit({
        type: "cli.task.failed",
        source: "cli-task-runner",
        owner: record.sourceOwner,
        data: {
          taskId: record.taskId,
          tool: record.tool,
          resultPath: record.resultPath,
          structuredResultPath: record.structuredResultPath,
          eventsPath: record.eventsPath,
          error: record.error,
          failureCategory: record.failureCategory,
          exitCode: attempt.exitCode,
          sourceSessionId: record.sourceSessionId,
          cliSessionId: record.cliSessionId,
          resumeCommand: record.resumeCommand,
          effectiveSandbox: record.effectiveSandbox,
          sandboxFallbackReason: record.sandboxFallbackReason,
          reuseSession: record.reuseSession,
        },
        ...(record.sourceTrace ? { trace: record.sourceTrace } : {}),
      } as any);
      emitSourceSessionUpdate(bus, record, "failed", sourceSessionAvailable);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    record.status = "failed";
    record.finishedAt = iso(now);
    record.error = message;
    record.failureCategory = "process";
    record.summary = message;
    writeStructuredResult(record);
    writeRecord(recordPath, record);
    bus.emit({
      type: "cli.task.failed",
      source: "cli-task-runner",
      owner: record.sourceOwner,
      data: {
        taskId: record.taskId,
        tool: record.tool,
        resultPath: record.resultPath,
        structuredResultPath: record.structuredResultPath,
        eventsPath: record.eventsPath,
        error: message,
        failureCategory: record.failureCategory,
        sourceSessionId: record.sourceSessionId,
        cliSessionId: record.cliSessionId,
        resumeCommand: record.resumeCommand,
        effectiveSandbox: record.effectiveSandbox,
        sandboxFallbackReason: record.sandboxFallbackReason,
        reuseSession: record.reuseSession,
      },
      ...(record.sourceTrace ? { trace: record.sourceTrace } : {}),
    } as any);
    emitSourceSessionUpdate(bus, record, "failed", sourceSessionAvailable);
  }
}
