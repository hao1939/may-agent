/**
 * Parse Codex CLI JSONL stream into a structured envelope.
 * Mirrors cc-stream-parser.ts but for Codex's event grammar.
 *
 * Codex events seen in the wild:
 *   - thread.started      { thread_id }
 *   - turn.started
 *   - turn.completed      { usage: { input_tokens, output_tokens, ... } }
 *   - item.started        { item: { id, type, ... } }
 *   - item.completed      { item: { id, type, ... } }
 * Item types:
 *   - agent_message       { text }            ← assistant reply
 *   - command_execution   { command, aggregated_output, exit_code, status }
 *   - reasoning           { ... }             ← internal thought (variable shape)
 *   - file_change         { ... }             ← (anticipated; not seen yet)
 */
export interface CodexToolOutput {
  tool: string;
  args_summary: string;
  stdout_tail: string;
  exit_code?: number;
  is_error?: boolean;
}

export interface CodexEnvelope {
  status: "completed" | "partial" | "timed_out" | "error" | "no_output";
  exit_code: number;
  thread_id: string | null;
  agent_messages: string[];        // every agent_message, in order
  last_message: string;            // shortcut: last agent_message
  tool_outputs: CodexToolOutput[]; // every command_execution etc.
  usage: { input_tokens?: number; output_tokens?: number; cached_input_tokens?: number; reasoning_output_tokens?: number } | null;
  stderr_tail: string;
  raw_tail: string;
}

export function parseCodexStream(stdout: string, stderr: string, exitCode: number): CodexEnvelope {
  const env: CodexEnvelope = {
    status: "completed",
    exit_code: exitCode,
    thread_id: null,
    agent_messages: [],
    last_message: "",
    tool_outputs: [],
    usage: null,
    stderr_tail: stderr.slice(-2000),
    raw_tail: stdout.slice(-1000),
  };

  // Track in-flight items so we can pair started→completed if needed
  const itemsInFlight = new Map<string, any>();

  const lines = stdout.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("{")) continue;

    let obj: any = null;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (obj.type === "thread.started" && obj.thread_id) {
      env.thread_id = obj.thread_id;
    }

    if (obj.type === "turn.completed" && obj.usage) {
      env.usage = obj.usage;
    }

    if (obj.type === "item.started" && obj.item?.id) {
      itemsInFlight.set(obj.item.id, obj.item);
    }

    if (obj.type === "item.completed" && obj.item) {
      const item = obj.item;
      itemsInFlight.delete(item.id);

      if (item.type === "agent_message" && typeof item.text === "string") {
        env.agent_messages.push(item.text);
        env.last_message = item.text;
      } else if (item.type === "command_execution") {
        env.tool_outputs.push({
          tool: "command_execution",
          args_summary: String(item.command || "").slice(0, 200),
          stdout_tail: String(item.aggregated_output || "").slice(-2000),
          exit_code: typeof item.exit_code === "number" ? item.exit_code : undefined,
          is_error: typeof item.exit_code === "number" ? item.exit_code !== 0 : undefined,
        });
      } else if (item.type === "file_change") {
        // Anticipated event shape (not seen yet) — capture defensively
        env.tool_outputs.push({
          tool: "file_change",
          args_summary: String(item.path || item.file || "").slice(0, 200),
          stdout_tail: String(item.diff || item.summary || JSON.stringify(item)).slice(-2000),
        });
      } else {
        // Unknown item type — preserve for debugging without losing it
        env.tool_outputs.push({
          tool: `item:${item.type || "unknown"}`,
          args_summary: "",
          stdout_tail: JSON.stringify(item).slice(0, 2000),
        });
      }
    }
  }

  // ── Rescue pass: if no JSONL parsed at all (auth failure / stream truncated
  // before first event), surface the stderr so master sees a real diagnosis.
  if (env.agent_messages.length === 0 && env.tool_outputs.length === 0) {
    if (exitCode !== 0) {
      env.status = exitCode === 143 || exitCode === 124 ? "timed_out" : "error";
    } else {
      env.status = "no_output";
    }
  } else if (env.tool_outputs.length > 0 || env.agent_messages.length > 0) {
    if (exitCode === 0) {
      env.status = "completed";
    } else if (exitCode === 143 || exitCode === 124) {
      env.status = "timed_out";
    } else {
      env.status = "partial";
    }
  }

  return env;
}

export function formatCodexEnvelope(env: CodexEnvelope, opts?: { verbose?: boolean }): string {
  const parts: string[] = [];
  parts.push(
    `[status=${env.status} exit=${env.exit_code} messages=${env.agent_messages.length} tools=${env.tool_outputs.length}${
      env.usage ? ` tokens_in=${env.usage.input_tokens || 0} out=${env.usage.output_tokens || 0}` : ""
    }]`,
  );

  if (env.last_message) {
    parts.push(`\n## Last agent message\n${env.last_message}`);
  }

  if (env.tool_outputs.length > 0) {
    parts.push(`\n## Tool outputs (${env.tool_outputs.length})`);
    for (let i = 0; i < env.tool_outputs.length; i++) {
      const t = env.tool_outputs[i];
      const errFlag = t.is_error ? " [ERROR]" : "";
      const exitTag = typeof t.exit_code === "number" ? ` exit=${t.exit_code}` : "";
      parts.push(`\n### [${i + 1}] ${t.tool}${exitTag}${errFlag}${t.args_summary ? ` — ${t.args_summary}` : ""}`);
      parts.push(t.stdout_tail || "(empty)");
    }
  }

  if (env.agent_messages.length > 1) {
    parts.push(`\n## Earlier agent messages (${env.agent_messages.length - 1})`);
    for (let i = 0; i < env.agent_messages.length - 1; i++) {
      parts.push(`\n— [${i + 1}] ${env.agent_messages[i]}`);
    }
  }

  if (env.status === "no_output") {
    parts.push(
      `\n## Notice\nCodex produced NO JSONL output. Likely cause: auth failure, model-provider unreachable, or codex CLI crashed before first event.\nstderr: ${env.stderr_tail || "(empty)"}\nCheck: ~/.codex/config.toml, LITELLM_API_KEY, network to model provider.`,
    );
  } else if (env.status === "timed_out") {
    parts.push(`\n## Notice\nCodex was cut off mid-stream by timeout. Tool outputs above are complete; final agent message may be missing.`);
  } else if (env.status === "error") {
    parts.push(`\n## Notice\nCodex exited non-zero (${env.exit_code}). stderr: ${env.stderr_tail || "(empty)"}`);
  }

  if (opts?.verbose && env.stderr_tail && env.status === "completed") {
    parts.push(`\n## stderr (tail)\n${env.stderr_tail}`);
  }

  return parts.join("\n");
}
