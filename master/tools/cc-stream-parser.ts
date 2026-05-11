/**
 * Parse Claude Code stream-json output into a structured envelope.
 * Handles partial / truncated streams (SIGTERM mid-stream) gracefully.
 */
export interface CCToolOutput {
  tool: string;
  args_summary: string;
  stdout_tail: string;     // last ~2KB of tool stdout
  is_error?: boolean;
}

export interface CCEnvelope {
  status: "completed" | "partial" | "timed_out" | "error";
  exit_code: number;
  session_id: string | null;
  assistant_text: string;          // last assistant text block (cc's narration)
  result_text: string | null;      // cc's final `result` envelope, if it arrived
  tool_outputs: CCToolOutput[];    // every tool_use_result captured, in order
  files_touched: string[];         // parsed from tool calls
  stderr_tail: string;
  raw_tail: string;                // last 1KB of raw stream, debug only
}

interface ToolUseInFlight {
  id: string;
  name: string;
  input?: any;
}

export function parseCCStream(stdout: string, stderr: string, exitCode: number): CCEnvelope {
  const env: CCEnvelope = {
    status: "completed",
    exit_code: exitCode,
    session_id: null,
    assistant_text: "",
    result_text: null,
    tool_outputs: [],
    files_touched: [],
    stderr_tail: stderr.slice(-2000),
    raw_tail: stdout.slice(-1000),
  };

  // Track in-flight tool calls so we can pair tool_use → tool_use_result by id
  const inflight = new Map<string, ToolUseInFlight>();
  const touched = new Set<string>();

  // Stream-json is newline-delimited. We tolerate partial last lines.
  const lines = stdout.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("{")) continue;

    // Try to parse; if last line is truncated mid-JSON we attempt a regex rescue below.
    let obj: any = null;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (obj.type === "system" && obj.session_id) {
      env.session_id = obj.session_id;
    }

    if (obj.type === "result") {
      env.result_text = obj.result || null;
      if (obj.session_id) env.session_id = obj.session_id;
    }

    if (obj.type === "assistant" && obj.message?.content) {
      for (const block of obj.message.content) {
        if (block.type === "text") {
          env.assistant_text = block.text;
        }
        if (block.type === "tool_use") {
          inflight.set(block.id, { id: block.id, name: block.name, input: block.input });
          // Heuristic: capture file paths from common tools
          if (block.name === "Read" && block.input?.file_path) touched.add(block.input.file_path);
          if (block.name === "Edit" && block.input?.file_path) touched.add(block.input.file_path);
          if (block.name === "Write" && block.input?.file_path) touched.add(block.input.file_path);
        }
      }
    }

    // tool_use_result can arrive as a `user` message with content[].type == "tool_result"
    // or as a top-level "tool_use_result" payload (varies by CC version)
    if (obj.type === "user" && obj.message?.content) {
      for (const block of obj.message.content) {
        if (block.type === "tool_result") {
          const id = block.tool_use_id;
          const meta = inflight.get(id);
          const text = extractToolResultText(block.content);
          env.tool_outputs.push({
            tool: meta?.name || "unknown",
            args_summary: summarizeArgs(meta?.input),
            stdout_tail: text.slice(-2000),
            is_error: block.is_error || false,
          });
        }
      }
    }

    if (obj.tool_use_result) {
      const r = obj.tool_use_result;
      const text = r.stdout || extractToolResultText(r.content) || "";
      env.tool_outputs.push({
        tool: r.tool || "unknown",
        args_summary: "",
        stdout_tail: text.slice(-2000),
        is_error: r.is_error || false,
      });
    }
  }

  // ── Rescue pass: regex-scrape `"stdout":"..."` or `"text":"..."` fragments we couldn't parse cleanly.
  // Runs only when no tool_outputs were captured (truncated stream lost the closing brace).
  if (env.tool_outputs.length === 0 && (stdout.includes('"stdout"') || stdout.includes('"text"'))) {
    const re = /"(?:stdout|text)":"((?:[^"\\]|\\.)*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(stdout)) !== null) {
      const raw = m[1];
      let decoded = raw;
      try {
        decoded = JSON.parse(`"${raw}"`);
      } catch {
        // partial escape at truncation point — best-effort un-escape
        decoded = raw.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      }
      env.tool_outputs.push({
        tool: "unknown(rescued)",
        args_summary: "",
        stdout_tail: decoded.slice(-2000),
      });
    }
  }

  env.files_touched = [...touched];

  // ── Determine status
  if (exitCode === 0 && env.result_text !== null) {
    env.status = "completed";
  } else if (exitCode === 143 || exitCode === 124) {
    env.status = "timed_out";
  } else if (exitCode !== 0) {
    env.status = "error";
  } else if (env.result_text === null && env.tool_outputs.length > 0) {
    env.status = "partial";
  }

  return env;
}

function extractToolResultText(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === "string" ? c : c?.text ?? c?.stdout ?? ""))
      .join("\n");
  }
  if (content && typeof content === "object") {
    return content.text ?? content.stdout ?? JSON.stringify(content);
  }
  return "";
}

function summarizeArgs(input: any): string {
  if (!input) return "";
  if (typeof input === "string") return input.slice(0, 200);
  if (input.command) return String(input.command).slice(0, 200);
  if (input.file_path) return String(input.file_path);
  if (input.pattern) return `pattern=${input.pattern}`;
  try {
    return JSON.stringify(input).slice(0, 200);
  } catch {
    return "";
  }
}

/** Format an envelope for return to master — structured but human-readable. */
export function formatEnvelope(env: CCEnvelope, opts?: { verbose?: boolean }): string {
  const parts: string[] = [];
  parts.push(`[status=${env.status} exit=${env.exit_code} tools=${env.tool_outputs.length} files=${env.files_touched.length}]`);

  if (env.result_text) {
    parts.push(`\n## Result\n${env.result_text}`);
  } else if (env.assistant_text) {
    parts.push(`\n## Last assistant text (no final result envelope)\n${env.assistant_text}`);
  }

  if (env.tool_outputs.length > 0) {
    parts.push(`\n## Tool outputs (${env.tool_outputs.length})`);
    for (let i = 0; i < env.tool_outputs.length; i++) {
      const t = env.tool_outputs[i];
      const errFlag = t.is_error ? " [ERROR]" : "";
      parts.push(`\n### [${i + 1}] ${t.tool}${errFlag}${t.args_summary ? ` — ${t.args_summary}` : ""}`);
      parts.push(t.stdout_tail || "(empty)");
    }
  }

  if (env.files_touched.length > 0) {
    parts.push(`\n## Files touched\n${env.files_touched.map((f) => `- ${f}`).join("\n")}`);
  }

  if (env.status === "timed_out") {
    parts.push(`\n## Notice\ncc was cut off mid-stream by timeout. Tool outputs above are complete; assistant's final summary did not arrive.`);
  }

  if (opts?.verbose && env.stderr_tail) {
    parts.push(`\n## stderr (tail)\n${env.stderr_tail}`);
  }

  return parts.join("\n");
}
