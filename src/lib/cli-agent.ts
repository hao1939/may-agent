import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";
import type { EventTrace } from "../app/event-bus.js";
import { addSessionBashProcessGroup, removeSessionBashProcessGroup } from "./persistence.js";
import { BASH_PROCESS_GROUP_KILL_GRACE_MS, drainBashProcessGroup } from "./tools/bash.js";

type CliTool = "codex" | "claude";
export type CliAgentInput = {
  tool: CliTool;
  prompt: string;
  mode?: "investigate" | "review" | "patch";
  cwd?: string;
  files?: string[];
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  timeoutMs?: number;
  worktree?: string;
  worktreePolicy?: "use-existing" | "require";
  expectedOutput?: { format: "markdown" | "json"; requiredFields?: string[] };
  resumeSessionId?: string;
  /** Retained only to reject implicit cross-task session reuse explicitly. */
  reuseSession?: boolean;
};
type FailureCategory = "timeout" | "cancelled" | "permission" | "tool" | "no_output" | "output_schema" | "process";
export type CliAgentResult = {
  /** Compatibility correlation key for existing CLI event/evidence readers, not a durable Task. */
  taskId: string;
  status: "completed" | "failed";
  tool: CliTool;
  summary: string;
  resultPath: string;
  structuredResultPath: string;
  eventsPath: string;
  evidenceRefs: string[];
  nativeSessionId?: string;
  exitCode?: number;
  error?: string;
  failureCategory?: FailureCategory;
  effectiveSandbox: "danger-full-access";
  sandboxFallbackReason?: string;
  observationError?: string;
};
export type CliAgentOptions = {
  agentName: string;
  projectRoot: string;
  persistDir: string;
  sessionId: string;
  trace?: EventTrace;
  emit?: (event: { type: string; [key: string]: unknown }) => void;
  signal?: AbortSignal;
  spawnCommand?: typeof spawn;
  drainProcessGroup?: (pid: number) => Promise<boolean>;
};
const DEFAULT_TIMEOUT_MS = 600_000;
const MAX_RESULT_BYTES = 1024 * 1024;

function inside(root: string, path: string): string {
  const base = realpathSync(root);
  const target = realpathSync(resolve(base, path));
  const suffix = relative(base, target);
  if (suffix !== ".." && !suffix.startsWith("../") && !isAbsolute(suffix)) return target;
  throw new Error(`Path outside authorized root: ${path}`);
}

function nativeCommand(input: CliAgentInput, prompt: string, resultPath: string): { command: string; args: string[] } {
  if (input.tool === "codex") {
    const args = [
      "exec",
      "--json",
      "--skip-git-repo-check",
      "--model",
      process.env.CODEX_MODEL?.trim() || "gpt-5.6-sol",
      "--config",
      `model_reasoning_effort=${JSON.stringify(process.env.CODEX_REASONING_EFFORT?.trim() || "high")}`,
      "--sandbox",
      "danger-full-access",
      "-o",
      resultPath,
    ];
    if (input.resumeSessionId) args.push("resume", input.resumeSessionId);
    args.push(prompt);
    return { command: "codex", args };
  }
  const args = [
    "-p",
    prompt,
    "--model",
    process.env.CLAUDE_MODEL?.trim() || "claude-opus-5",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "bypassPermissions",
    "--dangerously-skip-permissions",
  ];
  if (input.resumeSessionId) args.push("--resume", input.resumeSessionId);
  return { command: "claude", args };
}

function cliEnvironment(): NodeJS.ProcessEnv {
  // Preserve the existing trusted-container endpoint and native config.
  const key = process.env.MODEL_API_KEY || "not-needed";
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MODEL_API_KEY: key,
    ANTHROPIC_API_KEY: key,
    ANTHROPIC_BASE_URL: process.env.MODEL_BASE_URL || "http://localhost:4000",
  };
  const codexConfig = process.env.CODEX_HOME || process.env.MAY_CODEX_HOME;
  if (codexConfig) env.CODEX_HOME = codexConfig;
  return env;
}

export const CLI_DIAGNOSTIC_TAIL_BYTES = 64 * 1024;
const CLI_PROTOCOL_LINE_MAX_CHARS = 1024 * 1024;

type CliOutputSnapshot = {
  stdout: string;
  stderr: string;
  completedProtocol: boolean;
  failedProtocol: boolean;
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
  let failedProtocol = false;
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
        if (event.type === "turn.started") completedProtocol = false;
        if (event.type === "turn.failed" || event.type === "error") {
          failedProtocol = true;
          completedProtocol = false;
          inspectDiagnostics(JSON.stringify(event.error ?? event.message ?? ""));
        }
        if (event.type === "turn.started") finalText = undefined;
        if (event.type === "turn.completed") completedProtocol = true;
        if (event.type === "item.completed" && event.item?.type === "agent_message") {
          if (typeof event.item.text === "string") finalText = event.item.text;
        }
        return;
      }
      if (typeof event.session_id === "string") cliSessionId = event.session_id;
      if (event.type === "result") {
        completedProtocol = event.subtype === "success" && event.is_error !== true;
        if (!completedProtocol) {
          failedProtocol = true;
          inspectDiagnostics(JSON.stringify(event.errors ?? event.result ?? ""));
        }
        if (typeof event.result === "string") finalText = event.result;
      }
      if (event.type === "assistant" && Array.isArray(event.message?.content)) {
        for (const block of event.message.content) {
          if (block?.type === "text" && typeof block.text === "string") finalText = block.text;
        }
      }
    } catch {
      // Non-protocol output remains available in the durable events file.
      inspectDiagnostics(line);
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
      if (pendingLine.length <= CLI_PROTOCOL_LINE_MAX_CHARS) inspectLine(pendingLine);
      pendingLine = "";
      remaining = remaining.slice(newline + 1);
    }
  };

  return {
    stdout(chunk) {
      const text = decoder.write(chunk);
      stdoutTail = appendBoundedTail(stdoutTail, chunk);
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
        consume(remainder);
      }
      if (!skipOversizedLine) inspectLine(pendingLine);
      return {
        stdout: stdoutTail.toString("utf8"),
        stderr: stderrTail.toString("utf8"),
        completedProtocol,
        failedProtocol,
        finalText,
        cliSessionId,
        permissionFailure,
        toolFailure,
      };
    },
  };
}

/** One native process belongs to the caller session, just like its other shell commands. */
async function executeNative(input: {
  command: string;
  args: string[];
  cwd: string;
  eventsPath: string;
  timeoutMs: number;
  tool: CliTool;
  opts: CliAgentOptions;
  started: (pid?: number) => void;
}): Promise<CliOutputSnapshot & { exitCode: number | null; stop?: "timeout" | "cancelled"; error?: string }> {
  const { opts } = input;
  opts.signal?.throwIfAborted();
  const collector = createCliOutputCollector(input.tool);
  const fd = openSync(input.eventsPath, "w");
  let child: ReturnType<typeof spawn>;
  try {
    child = (opts.spawnCommand ?? spawn)(input.command, input.args, {
      cwd: input.cwd,
      env: cliEnvironment(),
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    closeSync(fd);
    throw error;
  }
  return await new Promise((resolveDone, reject) => {
    let settling = false;
    let captureClosed = false;
    let stop: "timeout" | "cancelled" | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let closeChild!: () => void;
    const closed = new Promise<void>((resolveClosed) => {
      closeChild = resolveClosed;
    });
    child.once("close", closeChild);
    const finish = async (exitCode: number | null, error?: string) => {
      if (settling) return;
      settling = true;
      if (timeout) clearTimeout(timeout);
      opts.signal?.removeEventListener("abort", abort);
      try {
        if (child.pid) {
          const drained = await (opts.drainProcessGroup ?? drainBashProcessGroup)(child.pid);
          if (!drained)
            throw new Error(`CLI process group ${child.pid} did not drain; caller session recovery is required`);
          removeSessionBashProcessGroup(opts.persistDir, opts.sessionId, child.pid);
        }
        // A descendant that escaped the group must not hold our output pipes
        // open forever. Normal close drains buffered output before settlement.
        let closeDeadline: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            closed,
            new Promise<never>((_, rejectClose) => {
              closeDeadline = setTimeout(
                () => rejectClose(new Error("CLI output pipes did not close after process drain")),
                BASH_PROCESS_GROUP_KILL_GRACE_MS,
              );
            }),
          ]);
        } finally {
          clearTimeout(closeDeadline);
        }
        resolveDone({ ...collector.finish(), exitCode, ...(stop ? { stop } : {}), ...(error ? { error } : {}) });
      } catch (drainError) {
        reject(drainError);
      } finally {
        captureClosed = true;
        child.stdout?.destroy();
        child.stderr?.destroy();
        closeSync(fd);
      }
    };
    const abort = () => {
      stop = "cancelled";
      void finish(null, "CLI call was cancelled with its caller");
    };
    const capture = (chunk: Buffer, stderr: boolean) => {
      if (captureClosed) return;
      try {
        if (stderr) collector.stderr(chunk);
        else collector.stdout(chunk);
        writeSync(fd, chunk);
      } catch (error) {
        void finish(null, error instanceof Error ? error.message : String(error));
      }
    };
    child.stdout?.on("data", (chunk: Buffer) => capture(chunk, false));
    child.stderr?.on("data", (chunk: Buffer) => capture(chunk, true));
    child.once("exit", (code) => void finish(code));
    child.once("error", (error) => void finish(null, error.message));
    try {
      if (child.pid) addSessionBashProcessGroup(opts.persistDir, opts.sessionId, child.pid);
      input.started(child.pid);
      timeout = setTimeout(() => {
        stop = "timeout";
        void finish(null, `CLI call exceeded timeout ${input.timeoutMs}ms`);
      }, input.timeoutMs);
      opts.signal?.addEventListener("abort", abort, { once: true });
      if (opts.signal?.aborted) abort();
    } catch (error) {
      void finish(null, error instanceof Error ? error.message : String(error));
    }
  });
}

/** Await one bounded opinion/patch. This function owns no queue, retries, or durable work state. */
export async function runCliAgent(input: CliAgentInput, opts: CliAgentOptions): Promise<CliAgentResult> {
  opts.signal?.throwIfAborted();
  if (!opts.sessionId) throw new Error("CLI execution requires its exact caller session");
  if (input.tool !== "codex" && input.tool !== "claude") throw new Error("tool must be codex or claude");
  if (typeof input.prompt !== "string" || !input.prompt.trim()) throw new Error("prompt is required");
  if (input.reuseSession && !input.resumeSessionId) {
    throw new Error(
      "Automatic shared session reuse is retired; pass resumeSessionId to continue an exact native session",
    );
  }
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new Error("timeoutMs must be a positive bounded timer duration");
  }
  const cwd = inside(opts.projectRoot, input.cwd ?? ".");
  const worktree = input.worktree ? inside(dirname(resolve(opts.projectRoot)), input.worktree) : undefined;
  if (input.mode === "patch" && input.worktreePolicy === "require" && !worktree) {
    throw new Error("patch mode requires an explicitly prepared worktree");
  }
  const runRoot = worktree ?? cwd;
  const contextRoot = join(resolve(opts.projectRoot), "agents", opts.agentName);
  const files = input.files?.map((path) => {
    if (typeof path !== "string" || !path.trim()) throw new Error("files must contain non-empty paths");
    try {
      return inside(runRoot, path);
    } catch {
      // Agent-owned context may be explicitly attached, but another agent's may not.
      if (isAbsolute(path) && existsSync(contextRoot)) return inside(contextRoot, path);
      throw new Error(`Path outside authorized context roots: ${path}`);
    }
  });
  const taskId = `cli_${randomUUID()}`;
  const dir = join(opts.persistDir, "cli-runs", taskId);
  mkdirSync(dir, { recursive: true });
  const resultPath = join(dir, "result.md");
  const structuredResultPath = join(dir, "result.json");
  const eventsPath = join(dir, "events.jsonl");
  const promptPath = join(dir, "prompt.md");
  const prompt = [
    ...(worktree ? [`Worktree: ${worktree}`] : []),
    ...(files?.length ? ["Relevant files:", ...files.map((file) => `- ${file}`)] : []),
    input.prompt,
  ].join("\n\n");
  writeFileSync(promptPath, prompt);
  writeFileSync(resultPath, "");
  writeFileSync(eventsPath, "");
  const result: CliAgentResult = {
    taskId,
    tool: input.tool,
    status: "failed",
    summary: "CLI execution did not complete",
    resultPath,
    structuredResultPath,
    eventsPath,
    evidenceRefs: [promptPath, resultPath, eventsPath],
    effectiveSandbox: "danger-full-access",
    ...(input.sandbox && input.sandbox !== "danger-full-access"
      ? {
          sandboxFallbackReason: `May CLI workers run with danger-full-access in the trusted container; requested ${input.sandbox} was normalized.`,
        }
      : {}),
  };
  const publish = (type: string, extra: Record<string, unknown> = {}) =>
    opts.emit?.({
      type,
      source: `agent:${opts.agentName}`,
      owner: `agent:${opts.agentName}`,
      data: {
        taskId,
        tool: input.tool,
        mode: input.mode ?? "investigate",
        cwd,
        promptPath,
        resultPath,
        structuredResultPath,
        eventsPath,
        sourceOwner: `agent:${opts.agentName}`,
        sourceSessionId: opts.sessionId,
        sandbox: input.sandbox,
        timeoutMs,
        worktree,
        files,
        resumeSessionId: input.resumeSessionId,
        effectiveSandbox: result.effectiveSandbox,
        sandboxFallbackReason: result.sandboxFallbackReason,
        ...extra,
      },
      ...(opts.trace ? { trace: opts.trace } : {}),
    });
  const fail = (category: FailureCategory, error: string) => {
    result.failureCategory = category;
    result.error = error;
    result.summary = error;
  };
  try {
    // Historical event names remain observation compatibility, not a command route.
    publish("cli.task.requested");
    const native = nativeCommand(input, prompt, resultPath);
    const attempt = await executeNative({
      ...native,
      cwd: runRoot,
      eventsPath,
      timeoutMs,
      tool: input.tool,
      opts,
      started: (pid) => publish("cli.task.started", { pid }),
    });
    result.exitCode = attempt.exitCode ?? undefined;
    result.nativeSessionId = attempt.cliSessionId;
    if (attempt.finalText && !statSync(resultPath).size) writeFileSync(resultPath, attempt.finalText);
    const size = statSync(resultPath).size;
    const text = size <= MAX_RESULT_BYTES ? readFileSync(resultPath, "utf8") : "";
    if (opts.signal?.aborted) fail("cancelled", "CLI call was cancelled with its caller");
    else if (attempt.stop) fail(attempt.stop, attempt.error!);
    else if (attempt.error || attempt.exitCode !== 0 || !attempt.completedProtocol || attempt.failedProtocol) {
      fail(
        attempt.permissionFailure
          ? "permission"
          : attempt.toolFailure
            ? "tool"
            : attempt.exitCode === 0 && !attempt.error && !attempt.failedProtocol
              ? "no_output"
              : "process",
        attempt.error ??
          (attempt.exitCode !== 0
            ? `CLI exited with code ${attempt.exitCode}`
            : attempt.failedProtocol
              ? "Native CLI reported a failed turn"
              : "CLI exited without a completed native result"),
      );
    } else if (!text.trim())
      fail(
        "no_output",
        size > MAX_RESULT_BYTES ? "CLI result exceeds the bounded result size" : "CLI produced no usable result",
      );
    else {
      if (input.expectedOutput?.format === "json") {
        try {
          const parsed: unknown = JSON.parse(text);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("expected a JSON object");
          const missing = (input.expectedOutput.requiredFields ?? []).filter((field) => !Object.hasOwn(parsed, field));
          if (missing.length) throw new Error(`missing required fields: ${missing.join(", ")}`);
        } catch (error) {
          fail(
            "output_schema",
            `CLI result is not the expected JSON: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      if (!result.error) {
        result.status = "completed";
        result.summary = text.trim().split("\n")[0]!.slice(0, 300);
      }
    }
  } catch (error) {
    fail(opts.signal?.aborted ? "cancelled" : "process", error instanceof Error ? error.message : String(error));
  }
  writeFileSync(structuredResultPath, JSON.stringify(result, null, 2) + "\n");
  try {
    publish(result.status === "completed" ? "cli.task.completed" : "cli.task.failed", {
      summary: result.summary,
      error: result.error,
      failureCategory: result.failureCategory,
      exitCode: result.exitCode,
      cliSessionId: result.nativeSessionId,
      sandboxFallbackReason: result.sandboxFallbackReason,
    });
  } catch (error) {
    // Losing an observation must not hide an executed patch or invite an
    // accidental retry. Return its real outcome and evidence with the warning.
    result.observationError = error instanceof Error ? error.message : String(error);
    writeFileSync(structuredResultPath, JSON.stringify(result, null, 2) + "\n");
  }
  return result;
}

/** Read-only upgrade fence; never replay or erase work admitted by the removed runner. */
export function assertLegacyCliTasksSettled(persistDir: string): void {
  const root = join(persistDir, "cli-tasks");
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(root, entry.name);
    const taskFile = join(dir, "task.json");
    const requestFile = join(dir, "request.json");
    if (!existsSync(taskFile) && !existsSync(requestFile)) continue;
    let status: unknown;
    try {
      status = JSON.parse(readFileSync(taskFile, "utf8")).status;
    } catch {
      /* Fail closed below. */
    }
    // The old runner marked orphaned without draining the native process.
    // Its record is not proof that mutation has stopped; require operator review.
    if (["completed", "failed"].includes(String(status))) continue;
    throw new Error(
      `Unfinished, orphaned, or unreadable legacy CLI work at ${dir}. Drain or cancel active work using the previous Host. Inspect orphaned/unreadable records and archive them only after confirming their work and processes are settled; no artifacts were changed.`,
    );
  }
}
