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
  structuredResultPath?: string;
  eventsPath?: string;
  sandbox?: SandboxMode;
  effectiveSandbox?: EffectiveSandboxMode;
  sandboxFallbackReason?: string;
  timeoutMs: number;
  sourceOwner: string;
  sourceSessionId?: string;
  resumeSessionId?: string;
  reuseSession?: boolean;
  files?: string[];
  worktree?: string;
  worktreePolicy?: "use-existing" | "require";
  expectedOutput?: { format: "markdown" | "json"; requiredFields?: string[] };
  cliSessionId?: string;
  resumeCommand?: string[];
  status: "requested" | "running" | "completed" | "failed" | "orphaned";
  pid?: number;
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  error?: string;
  failureCategory?: "timeout" | "permission" | "tool" | "no_output" | "output_schema" | "process" | "orphaned";
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

function appendFile(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { flag: "a" });
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

function safePathList(root: string, value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const paths = value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  if (paths.length === 0) return undefined;
  return paths.map((entry) => ensureInside(root, entry));
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
  const args = [
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "bypassPermissions",
    "--dangerously-skip-permissions",
  ];
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
  return [
    "claude",
    "-p",
    "<prompt>",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "bypassPermissions",
    "--dangerously-skip-permissions",
    "--resume",
    sessionId,
  ];
}

function sandboxMode(value: unknown): SandboxMode {
  if (value === "read-only" || value === "workspace-write" || value === "danger-full-access") return value;
  return "danger-full-access";
}

function effectiveSandboxFor(_tool: CliTool, requested: SandboxMode): {
  effectiveSandbox: EffectiveSandboxMode;
  sandboxFallbackReason?: string;
} {
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
  error?: string;
};

function structuredStatus(record: CliTaskRecord): StructuredCliResult["status"] {
  if (record.status === "orphaned") return "failed";
  if (record.error?.toLowerCase().includes("timeout")) return "timed_out";
  if (record.status === "completed") return "completed";
  return "failed";
}

function classifyCliOutcome(
  attempt: CliAttemptResult,
  resultText: string,
  expected?: CliTaskRecord["expectedOutput"],
): { failureCategory?: CliTaskRecord["failureCategory"]; error?: string } {
  const diagnosticText = `${attempt.stderr}\n${attempt.stdout}\n${attempt.error ?? ""}`;
  if (attempt.error?.toLowerCase().includes("timeout") || attempt.error?.toLowerCase().includes("terminated")) {
    return { failureCategory: "timeout", error: attempt.error };
  }
  if (/permission denied|not permitted|approval required|sandbox.*denied|EACCES/i.test(diagnosticText)) {
    return { failureCategory: "permission", error: "CLI worker was denied a required permission" };
  }
  if (attempt.exitCode !== 0) {
    const category = /tool.*(?:failed|error)|command not found|ENOENT/i.test(diagnosticText) ? "tool" : "process";
    return { failureCategory: category, error: attempt.error ?? `CLI exited with code ${attempt.exitCode}` };
  }
  if (!resultText.trim()) {
    return { failureCategory: "no_output", error: "CLI worker exited successfully without a usable result" };
  }
  if (expected?.format === "json") {
    try {
      const parsed = JSON.parse(resultText) as Record<string, unknown>;
      const missing = (expected.requiredFields ?? []).filter((field) => !(field in parsed));
      if (missing.length > 0) {
        return { failureCategory: "output_schema", error: `CLI JSON result is missing required fields: ${missing.join(", ")}` };
      }
    } catch (err) {
      return { failureCategory: "output_schema", error: `CLI result is not valid JSON: ${err instanceof Error ? err.message : String(err)}` };
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

function cliEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: process.env.HOME || "/app/.state",
    LITELLM_API_KEY: process.env.LITELLM_API_KEY || "sk-local",
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || process.env.LITELLM_API_KEY || "sk-local",
    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || process.env.MODEL_BASE_URL || "http://localhost:4000",
  };
  const codexHome = process.env.CODEX_HOME || process.env.MAY_CODEX_HOME;
  if (codexHome) env.CODEX_HOME = codexHome;
  return env;
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
}): Promise<CliAttemptResult> {
  const { bus, spawnCommand, record, recordPath, prompt, now, attempt } = opts;
  const { command, args } = commandFor(record, prompt);
  const child = spawnCommand(command, args, {
    cwd: record.worktree ?? record.cwd,
    env: cliEnv(),
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
      structuredResultPath: record.structuredResultPath,
      eventsPath: record.eventsPath,
      sourceSessionId: record.sourceSessionId,
      pid: child.pid,
      attempt,
      effectiveSandbox: record.effectiveSandbox,
      sandboxFallbackReason: record.sandboxFallbackReason,
      reuseSession: record.reuseSession,
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
        error: signal === "SIGTERM" ? `CLI task was terminated, likely after timeout ${record.timeoutMs}ms` : undefined,
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
    const cwd = typeof data.cwd === "string" ? ensureInside(opts.projectRoot, data.cwd) : opts.projectRoot;
    const worktree = safeOptionalPath(dirname(opts.projectRoot), data.worktree);
    const filesRoot = worktree ?? cwd;
    const record: CliTaskRecord = existing ?? {
      taskId,
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
      resumeSessionId: typeof data.resumeSessionId === "string" ? data.resumeSessionId : undefined,
      reuseSession: data.reuseSession === true,
      files: safePathList(filesRoot, data.files),
      worktree,
      worktreePolicy: data.worktreePolicy === "require" ? "require" : "use-existing",
      expectedOutput:
        data.expectedOutput && typeof data.expectedOutput === "object"
          ? {
              format: (data.expectedOutput as any).format === "json" ? "json" : "markdown",
              requiredFields: Array.isArray((data.expectedOutput as any).requiredFields)
                ? (data.expectedOutput as any).requiredFields.filter((field: unknown): field is string => typeof field === "string")
                : undefined,
            }
          : undefined,
      status: "requested",
      requestedAt: iso(now),
    };
    record.resumeSessionId ??= reusableSessionId(opts.persistDir, record);
    writeRecord(recordPath, record);

    queueMicrotask(() => {
      running.add(taskId);
      void runCliTask({ bus: opts.bus, spawnCommand, persistDir: opts.persistDir, record, recordPath, now }).finally(
        () => {
          running.delete(taskId);
        },
      );
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
  persistDir: string;
  record: CliTaskRecord;
  recordPath: string;
  now: () => number;
}): Promise<void> {
  const { bus, spawnCommand, persistDir, record, recordPath, now } = opts;
  try {
    const prompt = promptForRun(record, readFileSync(record.promptPath, "utf8"));
    record.resumeSessionId ??= reusableSessionId(persistDir, record);
    const sandbox = effectiveSandboxFor(record.tool, record.sandbox ?? "danger-full-access");
    record.effectiveSandbox = sandbox.effectiveSandbox;
    record.sandboxFallbackReason = sandbox.sandboxFallbackReason;
    record.status = "running";
    record.startedAt = iso(now);
    writeRecord(recordPath, record);

    const attempt = await runCliAttempt({ bus, spawnCommand, persistDir, record, recordPath, prompt, now, attempt: 1 });

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
    const outcome = classifyCliOutcome(attempt, resultText, record.expectedOutput);
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
      } as any);
      emitSourceSessionUpdate(bus, record, "completed");
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
      } as any);
      emitSourceSessionUpdate(bus, record, "failed");
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
    } as any);
    emitSourceSessionUpdate(bus, record, "failed");
  }
}
