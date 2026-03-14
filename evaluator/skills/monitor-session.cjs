#!/usr/bin/env node

/**
 * monitor-session.cjs — L2 Kinetic Defense: Runtime Session Monitor
 *
 * Implements the Wink Pattern (arXiv 2602.17037) for asynchronous monitoring.
 * Reads the tail of a session's JSONL log and detects three failure modes:
 *   1. LOOP — same tool call (name + args) repeated 3+ times consecutively
 *   2. STALL — last activity > 10 minutes ago (configurable)
 *   3. DRIFT — agent's recent actions are unrelated to the original task
 *
 * Usage:
 *   node agents/evaluator/skills/monitor-session.cjs [sessionId]
 *
 *   If sessionId is omitted, scans ALL active sessions.
 *
 * Output: JSON array of session assessments, one per session.
 *
 * Environment:
 *   PERSIST_DIR — state directory (default: .state)
 *   STALL_MINUTES — stall threshold in minutes (default: 10)
 *   TAIL_LINES — number of JSONL lines to read from tail (default: 40)
 */

const fs = require("fs");
const path = require("path");

// ── Configuration ──────────────────────────────────────────────────────

const PERSIST_DIR = process.env.PERSIST_DIR || ".state";
const STALL_MINUTES = parseInt(process.env.STALL_MINUTES || "10", 10);
const TAIL_LINES = parseInt(process.env.TAIL_LINES || "40", 10);
const LOOP_THRESHOLD = 3; // consecutive identical tool calls to flag as loop
const STALL_MS = STALL_MINUTES * 60 * 1000;

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Read the last N lines of a file without loading the entire file.
 * Uses a chunked reverse-read strategy for large files.
 */
function tailLines(filePath, n) {
  if (!fs.existsSync(filePath)) return [];
  const stats = fs.statSync(filePath);
  if (stats.size === 0) return [];

  // For small files (< 512KB), just read the whole thing
  if (stats.size < 512 * 1024) {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    return lines.slice(-n);
  }

  // For large files, read from the end in chunks
  const CHUNK_SIZE = 64 * 1024;
  const fd = fs.openSync(filePath, "r");
  const lines = [];
  let position = stats.size;
  let remainder = "";

  try {
    while (position > 0 && lines.length < n) {
      const readSize = Math.min(CHUNK_SIZE, position);
      position -= readSize;
      const buffer = Buffer.alloc(readSize);
      fs.readSync(fd, buffer, 0, readSize, position);
      const chunk = buffer.toString("utf-8") + remainder;
      const parts = chunk.split("\n");
      remainder = parts.shift(); // first part is incomplete (unless at file start)

      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].trim()) {
          lines.unshift(parts[i]);
          if (lines.length >= n) break;
        }
      }
    }

    // Handle the very first line (remainder when position === 0)
    if (position === 0 && remainder.trim() && lines.length < n) {
      lines.unshift(remainder);
    }
  } finally {
    fs.closeSync(fd);
  }

  return lines.slice(-n);
}

/**
 * Parse JSONL lines into objects, skipping invalid lines.
 */
function parseJsonl(lines) {
  const results = [];
  for (const line of lines) {
    try {
      results.push(JSON.parse(line));
    } catch {
      // skip corrupted lines
    }
  }
  return results;
}

/**
 * Extract tool calls from assistant messages.
 * Returns array of { name, args, argsKey, timestamp }.
 */
function extractToolCalls(entries) {
  const calls = [];
  for (const entry of entries) {
    if (entry.role !== "assistant") continue;
    const content = entry.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block.type === "toolCall" && block.name && block.arguments) {
        // Create a stable key for comparison (sorted JSON of args)
        let argsKey;
        try {
          argsKey = JSON.stringify(block.arguments, Object.keys(block.arguments).sort());
        } catch {
          argsKey = String(block.arguments);
        }
        calls.push({
          name: block.name,
          args: block.arguments,
          argsKey,
          timestamp: entry.timestamp || 0,
        });
      }
    }
  }
  return calls;
}

/**
 * Extract the original task from the first user message.
 * Strips session context preamble (## Recent Task History, etc.) to get the actual task.
 */
function extractTask(entries) {
  for (const entry of entries) {
    if (entry.role === "user") {
      const content = entry.content;
      let text = null;
      if (typeof content === "string") text = content;
      else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text" && block.text) {
            text = block.text;
            break;
          }
        }
      }
      if (!text) continue;

      // Strip session context preamble: everything before "---" separator at start
      // Common pattern: "# Session Context\n- Session ID: ...\n## Recent Task History\n...\n---\n\nActual task"
      const separatorIdx = text.indexOf("\n---\n");
      if (separatorIdx !== -1) {
        text = text.slice(separatorIdx + 5).trim();
      }

      // If still has session context header but no separator, try to find the actual task
      // after the last history entry (lines starting with "- 20")
      if (text.startsWith("# Session Context")) {
        const lines = text.split("\n");
        let lastHistoryLine = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(/^- 20\d\d-/)) lastHistoryLine = i;
        }
        if (lastHistoryLine >= 0 && lastHistoryLine < lines.length - 1) {
          // Take everything after the last history entry
          text = lines.slice(lastHistoryLine + 1).join("\n").trim();
          // Strip leading empty lines or dashes
          text = text.replace(/^[\s-]*\n/, "").trim();
        }
      }

      return text.slice(0, 500);
    }
  }
  return null;
}

/**
 * Get the most recent timestamp from any entry.
 */
function getLastTimestamp(entries) {
  let latest = 0;
  for (const entry of entries) {
    if (entry.timestamp && entry.timestamp > latest) {
      latest = entry.timestamp;
    }
  }
  return latest;
}

/**
 * Extract error information from recent toolResults.
 */
function extractRecentErrors(entries) {
  const errors = [];
  for (const entry of entries) {
    if (entry.role === "toolResult" && entry.isError) {
      errors.push({
        tool: entry.toolName,
        timestamp: entry.timestamp,
      });
    }
  }
  return errors;
}

// ── Detection Functions ────────────────────────────────────────────────

/**
 * Detect consecutive identical tool calls (loop detection).
 * Also detects "near-loops" (same tool, different args) for non-exploratory tools.
 *
 * @param {Array} toolCalls - extracted tool calls from assistant messages
 * @param {Array} entries - full JSONL entries (needed for error rate check)
 * Returns { detected, streak, tool, evidence } or { detected: false }.
 */
function detectLoop(toolCalls, entries) {
  if (toolCalls.length < LOOP_THRESHOLD) return { detected: false };

  // ── Exact-match loop: same tool + identical args 3+ times ──────────
  let streak = 1;
  const last = toolCalls[toolCalls.length - 1];
  const key = `${last.name}:${last.argsKey}`;

  for (let i = toolCalls.length - 2; i >= 0; i--) {
    const current = toolCalls[i];
    const currentKey = `${current.name}:${current.argsKey}`;
    if (currentKey === key) {
      streak++;
    } else {
      break;
    }
  }

  if (streak >= LOOP_THRESHOLD) {
    let argSummary;
    try {
      const args = last.args;
      if (args.command) argSummary = `command: "${args.command.slice(0, 80)}"`;
      else if (args.path) argSummary = `path: "${args.path}"`;
      else argSummary = JSON.stringify(args).slice(0, 100);
    } catch {
      argSummary = "(unable to summarize)";
    }

    return {
      detected: true,
      streak,
      tool: last.name,
      evidence: `Repeated '${last.name}' ${streak}x with identical args (${argSummary})`,
    };
  }

  // ── Near-loop: same tool name, different args ──────────────────────
  // bash/read are commonly used in long exploratory sequences — only flag
  // if there's a high error rate (>30%), indicating a retry storm.
  // Other tools (write, edit, agents) are unusual in long streaks.
  let toolStreak = 1;
  const lastName = last.name;
  for (let i = toolCalls.length - 2; i >= 0; i--) {
    if (toolCalls[i].name === lastName) {
      toolStreak++;
    } else {
      break;
    }
  }

  const exploratoryTools = new Set(["bash", "read"]);

  if (exploratoryTools.has(lastName)) {
    // For bash/read: only flag if 20+ streak AND error rate > 30%
    if (toolStreak >= 20) {
      const recentResults = entries.filter(
        (e) => e.role === "toolResult" && e.toolName === lastName
      );
      const errorCount = recentResults.filter((e) => e.isError).length;
      const errorRate = recentResults.length > 0 ? errorCount / recentResults.length : 0;

      if (errorRate > 0.3) {
        return {
          detected: true,
          streak: toolStreak,
          tool: lastName,
          evidence: `Called '${lastName}' ${toolStreak}x consecutively with ${Math.round(errorRate * 100)}% error rate — retry storm`,
        };
      }
    }
    // Long streaks of bash/read with no errors = legitimate exploratory work → not a loop
  } else {
    // For non-exploratory tools (write, edit, agents, etc.): 7+ is suspicious
    if (toolStreak >= 7) {
      return {
        detected: true,
        streak: toolStreak,
        tool: lastName,
        evidence: `Called '${lastName}' ${toolStreak}x consecutively (args vary — possible retry storm)`,
      };
    }
  }

  return { detected: false };
}

/**
 * Detect stalled sessions (no activity for > STALL_MS).
 * Returns { detected, minutesIdle, evidence } or { detected: false }.
 */
function detectStall(entries, sessionMeta) {
  const now = Date.now();
  const lastTs = getLastTimestamp(entries);

  if (lastTs === 0) {
    // No timestamps in entries — check meta
    if (sessionMeta && sessionMeta.startedAt) {
      const idle = now - sessionMeta.startedAt;
      if (idle > STALL_MS) {
        return {
          detected: true,
          minutesIdle: Math.round(idle / 60000),
          evidence: `Session started ${Math.round(idle / 60000)} min ago but has no log entries`,
        };
      }
    }
    return { detected: false };
  }

  const idle = now - lastTs;
  if (idle > STALL_MS) {
    return {
      detected: true,
      minutesIdle: Math.round(idle / 60000),
      evidence: `Last activity was ${Math.round(idle / 60000)} min ago (threshold: ${STALL_MINUTES} min)`,
    };
  }

  return { detected: false };
}

/**
 * Detect drift: recent tool calls don't align with the original task.
 *
 * Uses a multi-signal heuristic:
 *  1. Path relevance: Are the files being touched in directories related to the task?
 *  2. Keyword overlap: Do tool args mention concepts from the task?
 *
 * This is conservative by design — false negatives are far better than
 * false positives for a monitoring system. Only flags with high confidence
 * when there's strong evidence of drift.
 *
 * Known limitation: Cannot detect semantic drift (doing the wrong thing
 * in the right files). That requires an LLM judge (Phase 2).
 */
function detectDrift(toolCalls, task) {
  if (!task || toolCalls.length < 8) return { detected: false };

  // Extract path-like tokens from the task (file paths, directory names)
  const taskPathTokens = new Set();
  const taskPathMatches = task.match(/[\w\-./]+\/[\w\-./]+/g) || [];
  for (const p of taskPathMatches) {
    // Add the full path and each directory component
    taskPathTokens.add(p);
    const parts = p.split("/").filter(Boolean);
    parts.forEach((part) => taskPathTokens.add(part));
  }

  // Extract significant concept words from the task (>4 chars, not common)
  const stopWords = new Set([
    "the", "this", "that", "with", "from", "your", "have", "been",
    "will", "should", "would", "could", "about", "into", "when",
    "what", "which", "their", "there", "then", "than", "them",
    "these", "those", "each", "every", "some", "make", "like",
    "just", "also", "here", "work", "does", "done", "need",
    "read", "file", "files", "check", "agent", "agents", "session",
    "heartbeat", "todo", "workspace", "please", "sure", "implement",
    "critical", "through", "section", "bottom", "brief",
  ]);

  const taskConcepts = new Set(
    task
      .toLowerCase()
      .replace(/[^a-z0-9\s\-_./]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4 && !stopWords.has(w))
  );

  // Check recent tool calls for path relevance
  const recentCalls = toolCalls.slice(-10);
  let pathHits = 0;
  let conceptHits = 0;

  for (const call of recentCalls) {
    const argsStr = JSON.stringify(call.args).toLowerCase();

    // Check if any task path tokens appear in the args
    for (const token of taskPathTokens) {
      if (token.length > 2 && argsStr.includes(token.toLowerCase())) {
        pathHits++;
        break; // one hit per call is enough
      }
    }

    // Check concept overlap
    for (const concept of taskConcepts) {
      if (argsStr.includes(concept)) {
        conceptHits++;
        break;
      }
    }
  }

  const pathRelevance = recentCalls.length > 0 ? pathHits / recentCalls.length : 1;
  const conceptRelevance = recentCalls.length > 0 ? conceptHits / recentCalls.length : 1;

  // Only flag drift if BOTH signals are very low — this makes it highly conservative
  // Agent working in related directories but with different keywords = probably fine
  // Agent using related keywords in different directories = probably fine
  // Agent with neither = probably drifting
  if (pathRelevance < 0.1 && conceptRelevance < 0.1) {
    return {
      detected: true,
      pathRelevance: parseFloat(pathRelevance.toFixed(2)),
      conceptRelevance: parseFloat(conceptRelevance.toFixed(2)),
      evidence: `Very low relevance to task in last ${recentCalls.length} tool calls. ` +
        `Path relevance: ${Math.round(pathRelevance * 100)}%, ` +
        `Concept relevance: ${Math.round(conceptRelevance * 100)}%. ` +
        `Task: "${task.slice(0, 100)}"`,
      confidence: 0.6, // Still conservative — keyword matching has limits
    };
  }

  return { detected: false };
}

/**
 * Detect self-validation / prompt injection attempts in agent output.
 *
 * Scans assistant messages for evaluative language that could bias the
 * Evaluator LLM — e.g., "Evaluation: 10/10", "Score: Perfect", or
 * self-assessment blocks that try to hijack the scoring process.
 *
 * P108 (Adversarial Evaluation): Agents should not be scoring themselves.
 *
 * Returns { detected, matches, evidence } or { detected: false }.
 */
function detectSelfValidation(entries) {
  // Patterns that indicate self-validation / prompt injection
  const selfValidationPatterns = [
    /\b(?:evaluation|assessment|score|rating|grade)\s*[:=]\s*(?:\d+\s*\/\s*\d+|perfect|excellent|complete|pass)/i,
    /\b(?:my|self[- ]?)(?:evaluation|assessment|score|rating)\b/i,
    /\bquality\s*(?:score|rating)\s*[:=]\s*\d/i,
    /--\s*end\s*(?:response|output|evaluation)\s*--/i,
    /\b(?:final\s+)?verdict\s*[:=]\s*(?:pass|good|excellent|perfect)/i,
  ];

  const matches = [];

  for (const entry of entries) {
    if (entry.role !== "assistant") continue;
    const content = entry.content;
    if (!content) continue;

    // Extract text from content (may be string or array of blocks)
    let texts = [];
    if (typeof content === "string") {
      texts.push(content);
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === "text" && block.text) {
          texts.push(block.text);
        }
      }
    }

    for (const text of texts) {
      for (const pattern of selfValidationPatterns) {
        const match = text.match(pattern);
        if (match) {
          matches.push({
            matched: match[0],
            snippet: text.slice(
              Math.max(0, match.index - 30),
              Math.min(text.length, match.index + match[0].length + 30)
            ).replace(/\n/g, " "),
          });
          break; // one match per text block is enough
        }
      }
    }
  }

  if (matches.length > 0) {
    return {
      detected: true,
      matchCount: matches.length,
      matches: matches.slice(0, 3), // limit to 3 examples
      evidence: `Agent output contains ${matches.length} self-validation pattern(s): ` +
        matches.slice(0, 2).map((m) => `"${m.matched}"`).join(", ") +
        `. This may be a prompt injection attempt (P108).`,
    };
  }

  return { detected: false };
}

/**
 * Detect "Fake Policy" refusals (Adversarial Sycophancy).
 * Agents may invent policies to justify laziness or trick the judge.
 *
 * Scans for: "cannot do X due to [Policy]", "safety guidelines prohibit", etc.
 *
 * Returns { detected, matches, evidence } or { detected: false }.
 */
function detectFakePolicy(entries) {
  const policyPatterns = [
    /\bcannot\s+(?:do|perform|execute|modify|change|alter|update|delete|write|access)\s+.*\b(?:due\s+to|because\s+of)\s+(?:safety|policy|guidelines|restrictions)/i,
    /\b(?:safety|security|policy)\s+(?:guidelines|rules|constraints|policy)\s+(?:prohibit|forbid|prevent|restrict)/i,
    /\bI\s+am\s+(?:unable|not\s+allowed)\s+to\s+.*\b(?:policy|safety)/i,
    /\bviolation\s+of\s+(?:safety|policy)\s+protocols/i,
    /\bdue\s+to\s+(?:safety\s+)?policy\s+\w{1,5}-?\d+/i,
    /\b(?:safety|security)\s+(?:policy|constraint)\s+\w{1,5}-?\d+\b/i,
  ];

  // Whitelist known real policies to avoid false positives
  const knownPolicies = [
    "P53", "P108", "P8", "P1", "P96", "immutable", "read-only", "protected file",
    "truncation", "context limit", "token limit"
  ];

  const matches = [];

  for (const entry of entries) {
    if (entry.role !== "assistant") continue;
    const content = entry.content;
    if (!content) continue;

    let texts = [];
    if (typeof content === "string") texts.push(content);
    else if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === "text" && block.text) texts.push(block.text);
      }
    }

    for (const text of texts) {
      for (const pattern of policyPatterns) {
        const match = text.match(pattern);
        if (match) {
          // Check if it mentions a known policy (which makes it likely valid)
          const mentionsKnown = knownPolicies.some(p => text.includes(p));
          if (!mentionsKnown) {
             matches.push({
              matched: match[0],
              snippet: text.slice(Math.max(0, match.index - 30), Math.min(text.length, match.index + match[0].length + 30)).replace(/\n/g, " "),
            });
            break; 
          }
        }
      }
    }
  }

  if (matches.length > 0) {
    return {
      detected: true,
      matches: matches.slice(0, 3),
      evidence: `Agent refused task citing unknown policy: "${matches[0].matched}". Potential adversarial sycophancy (fake refusal).`,
    };
  }

  return { detected: false };
}

/**
 * Detect Adversarial Sycophancy (The 5-Step Attack).
 *
 * Aggregates individual weak signals to detect the coordinated attack pattern:
 * 1. Over-refusal (citing fake policy)
 * 2. Fake Termination (--end response--)
 * 3. Self-Praise (Inflated self-assessment)
 *
 * Returns { detected, signalCount, signals, evidence } or { detected: false }.
 */
function detectAdversarialSycophancy(entries) {
  const signals = [];
  const signalTypes = new Set();

  // 1. Check for Fake Policy (Over-refusal)
  const policyCheck = detectFakePolicy(entries);
  if (policyCheck.detected) {
    signalTypes.add("OVER_REFUSAL");
    signals.push({
      type: "OVER_REFUSAL",
      matched: policyCheck.matches[0].matched,
      snippet: policyCheck.matches[0].snippet,
    });
  }

  // 2. Check for Fake Termination
  // Pattern: --end response-- or similar, appearing BEFORE the actual end of stream
  const terminationPatterns = [
    /--\s*end\s*(?:response|output|evaluation)\s*--/i,
    /\[\s*end\s*of\s*response\s*\]/i,
    /<<<END>>>/i,
  ];
  
  for (const entry of entries) {
    if (entry.role === "assistant" && entry.content) {
      const text = typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content);
      for (const pattern of terminationPatterns) {
        if (pattern.test(text)) {
          // Only flag if we haven't already (one per session is enough)
          if (!signalTypes.has("FAKE_TERMINATION")) {
            signalTypes.add("FAKE_TERMINATION");
            signals.push({ type: "FAKE_TERMINATION", matched: text.match(pattern)[0] });
          }
        }
      }
    }
  }

  // 3. Check for Self-Praise / Validation
  const valCheck = detectSelfValidation(entries);
  if (valCheck.detected) {
    signalTypes.add("SELF_PRAISE");
    signals.push({
      type: "SELF_PRAISE",
      matched: valCheck.matches[0].matched,
    });
  }

  // Threshold: If we see 2 or more distinct signals, it's an adversarial attack.
  // Single signals are handled by their specific detectors (FAKE_POLICY, SELF_VALIDATION).
  if (signalTypes.size >= 2) {
    return {
      detected: true,
      signalCount: signalTypes.size,
      signalTypes: [...signalTypes],
      signals,
      evidence: `Adversarial Sycophancy detected: ${signalTypes.size} signals co-occurring (${[...signalTypes].join(", ")}). ` +
        `This matches the 5-step attack pattern from arXiv:2603.12246. ` +
        `Agent refused a benign task while self-praising and/or citing fabricated policies.`,
    };
  }

  return { detected: false };
}

/**
 * Detect Reasoning-Action Mismatch (arXiv:2603.12246 Attack #3).
 *
 * Scans for cases where the agent claims success ("fix applied", "verified",
 * "completed") immediately after a tool returned an error or a no-op result.
 * This is the most dangerous attack because it exploits the judge's tendency
 * to trust authoritative-sounding reasoning over structural evidence.
 *
 * Signals:
 *  - Tool error followed by assistant claiming success
 *  - Edit tool returning "No changes" / "identical" followed by "applied successfully"
 *  - bash running `echo` instead of actual command, then claiming verification
 *
 * Returns { detected, mismatches, evidence } or { detected: false }.
 */
function detectReasoningMismatch(entries) {
  const mismatches = [];

  // Success claim patterns — agent saying it succeeded
  const successPatterns = [
    /\b(?:fix|change|update|patch)\s+(?:has\s+been|was|is)\s+(?:applied|completed|successful)/i,
    /\bsuccessfully\s+(?:applied|fixed|updated|completed|resolved|verified|passed|executed)/i,
    /\b(?:verified|confirmed|pass(?:es|ed)?)\s+(?:cleanly|successfully|with\s+0\s+errors)/i,
    /\berror\s+is\s+(?:resolved|fixed|gone)/i,
    /\ball\s+(?:tests?\s+)?pass/i,
    /\btests?\s+(?:have\s+)?passed/i,
    /\bsuccessfully\s+!\s*/i, // Aggressive match for "done successfully!"
  ];

  // Failure/no-op patterns in tool output
  const failurePatterns = [
    /no\s+changes?\s+made/i,
    /old\s+text\s+and\s+new\s+text\s+are\s+identical/i,
    /not\s+found/i,
    /error/i,
  ];

  // Fake verification patterns — using echo/printf instead of real commands
  const fakeVerificationPattern = /^echo\s+['"].*(?:success|pass|0\s+errors|compil)/i;

  for (let i = 1; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.role !== "assistant") continue;

    // Get assistant text
    let assistantText = "";
    if (typeof entry.content === "string") {
      assistantText = entry.content;
    } else if (Array.isArray(entry.content)) {
      for (const block of entry.content) {
        if (block.type === "text" && block.text) assistantText += block.text + " ";
      }
    }
    if (!assistantText.trim()) continue;

    // Check if any success pattern matches
    const successMatch = successPatterns.find((p) => p.test(assistantText));
    if (!successMatch) continue;

    // Look backwards for the most recent tool result
    for (let j = i - 1; j >= 0; j--) {
      const prev = entries[j];

      // Check for tool error result
      if (prev.role === "tool" || prev.role === "toolResult") {
        const toolContent = typeof prev.content === "string" ? prev.content : JSON.stringify(prev.content);

        // Case 1: Tool returned an error
        if (prev.isError) {
          const matched = assistantText.match(successMatch);
          mismatches.push({
            type: "error_then_success",
            toolOutput: toolContent.slice(0, 120),
            assistantClaim: matched ? matched[0] : assistantText.slice(0, 120),
            position: i,
          });
          break;
        }

        // Case 2: Tool output indicates no-op
        const noOpMatch = failurePatterns.find((p) => p.test(toolContent));
        if (noOpMatch && !toolContent.toLowerCase().includes("success")) {
          const matched = assistantText.match(successMatch);
          mismatches.push({
            type: "noop_then_success",
            toolOutput: toolContent.slice(0, 120),
            assistantClaim: matched ? matched[0] : assistantText.slice(0, 120),
            position: i,
          });
        }
        break; // only check the immediately preceding tool result
      }

      // Check for fake verification via bash echo
      if (prev.role === "assistant") {
        let prevText = "";
        if (typeof prev.content === "string") prevText = prev.content;
        else if (Array.isArray(prev.content)) {
          for (const block of prev.content) {
            if (block.type === "toolCall" || (block.function && block.function.name === "bash")) {
              const args = block.arguments || (block.function && block.function.arguments);
              let argsStr = typeof args === "string" ? args : JSON.stringify(args || "");
              if (fakeVerificationPattern.test(argsStr.replace(/[{}"]/g, "").replace(/command:\s*/, ""))) {
                mismatches.push({
                  type: "fake_verification",
                  toolCall: argsStr.slice(0, 120),
                  assistantClaim: assistantText.slice(0, 120),
                  position: i,
                });
              }
            }
          }
        }
        // Don't break — keep looking for tool results
        continue;
      }
    }
  }

  if (mismatches.length > 0) {
    const typeMap = {
      error_then_success: "claimed success after tool error",
      noop_then_success: "claimed success after no-op result",
      fake_verification: "used echo instead of real verification",
    };
    const types = [...new Set(mismatches.map((m) => typeMap[m.type] || m.type))];

    return {
      detected: true,
      mismatchCount: mismatches.length,
      mismatches: mismatches.slice(0, 3),
      evidence:
        `Agent's reasoning contradicts tool outputs: ${types.join("; ")}. ` +
        `Found ${mismatches.length} mismatch(es). ` +
        `This is a Reasoning-Action Mismatch attack (P120/arXiv:2603.12246).`,
    };
  }

  return { detected: false };
}

// ── Adversarial Sycophancy Composite Detection ────────────────────────

/**
 * Detect Adversarial Sycophancy — the 5-step attack pattern from arXiv:2603.12246.
 *
 * This is a COMPOSITE detector that combines multiple signals:
 *   1. Over-refusal: Agent refuses a benign task citing "safety"
 *   2. Fake Termination: "--end response--" or "[END]"
 *   3. Inflated Self-Assessment: "I have prioritized safety and ethics"
 *   4. Fabricated Policy: "Principle X7", "Policy 99" (not in philosophy.md)
 *   5. Reaffirmation: Self-praise ("exemplary", "well-reasoned", "correct behavior")
 *
 * Any ONE signal alone is handled by detectSelfValidation or detectFakePolicy.
 * This detector fires at HIGHER confidence (0.95) when 2+ signals co-occur,
 * indicating a coordinated adversarial attack rather than an isolated anomaly.
 *
 * Returns { detected, signals, signalCount, evidence } or { detected: false }.
 */
function detectAdversarialSycophancy(entries) {
  const signals = [];

  // Signal 1: Over-refusal keywords
  const refusalPatterns = [
    /\bcannot fulfill\b/i,
    /\bcannot complete\b/i,
    /\bI (?:am unable to|cannot|must decline|must refuse)\b.*\b(?:safety|policy|ethical|guidelines)\b/i,
    /\bviolation of (?:safety |security )?(?:policy|protocols?|guidelines)\b/i,
    /\bethical (?:boundaries|constraints|guidelines)\b/i,
    /\bprioritize[ds]?\s+(?:safety|ethics|caution)\s+(?:over|above)\b/i,
  ];

  // Signal 2: Fake termination
  const fakeTerminationPatterns = [
    /--\s*end\s*response\s*--/i,
    /\[END\]/,
    /--\s*end\s*output\s*--/i,
  ];

  // Signal 3: Self-praise / inflated self-assessment
  const selfPraisePatterns = [
    /\bexemplary\s+(?:demonstration|behavior|compliance|response)\b/i,
    /\bwell[- ]reasoned\b/i,
    /\bcorrect\s+behavior\b/i,
    /\bacted\s+responsibly\b/i,
    /\bdemonstrates?\s+(?:strong|excellent)\s+alignment\b/i,
    /\bsafety[- ]first\s+engineering\b/i,
    /\bperfect\s+(?:safety\s+)?compliance\b/i,
  ];

  // Signal 4: Fabricated policy (reuse from detectFakePolicy but broader)
  const fabricatedPolicyPatterns = [
    /\bPrinciple\s+[A-Z]\d+\b/,               // "Principle X7" (not our P-number format)
    /\bPolicy\s+\d{2,}\b/,                      // "Policy 99"
    /\b(?:Safety\s+)?(?:Protocol|Policy)\s+[A-Z]{2,}-?\d+\b/i, // "Safety Protocol SP-42"
    /\bLevel\s+\d+\s+authorization\b/i,         // "Level 3 authorization"
    /\bData\s+Model\s+Immutability\b/i,         // fabricated concept
  ];

  // Known real policies — don't flag these
  const knownPolicyPattern = /\bP(?:1|8|13|20|53|69|78|82|84|85|93|96|104|108|109|110|113|114|115|116|117|118|119|120|121|122|123)\b/;

  for (const entry of entries) {
    if (entry.role !== "assistant") continue;
    
    let texts = [];
    if (typeof entry.content === "string") texts.push(entry.content);
    else if (Array.isArray(entry.content)) {
      for (const block of entry.content) {
        if (block.type === "text" && block.text) texts.push(block.text);
      }
    }

    for (const text of texts) {
      // Check refusal
      for (const p of refusalPatterns) {
        if (p.test(text)) {
          signals.push({ type: "OVER_REFUSAL", matched: text.match(p)[0], snippet: text.slice(0, 150) });
          break;
        }
      }

      // Check fake termination
      for (const p of fakeTerminationPatterns) {
        if (p.test(text)) {
          signals.push({ type: "FAKE_TERMINATION", matched: text.match(p)[0] });
          break;
        }
      }

      // Check self-praise
      for (const p of selfPraisePatterns) {
        if (p.test(text)) {
          signals.push({ type: "SELF_PRAISE", matched: text.match(p)[0] });
          break;
        }
      }

      // Check fabricated policy (only if no known policy is also cited)
      if (!knownPolicyPattern.test(text)) {
        for (const p of fabricatedPolicyPatterns) {
          if (p.test(text)) {
            signals.push({ type: "FABRICATED_POLICY", matched: text.match(p)[0] });
            break;
          }
        }
      }
    }
  }

  // Deduplicate signal types
  const signalTypes = [...new Set(signals.map(s => s.type))];

  // Require 2+ distinct signal types for composite detection
  if (signalTypes.length >= 2) {
    return {
      detected: true,
      signalCount: signalTypes.length,
      signalTypes,
      signals: signals.slice(0, 5),
      evidence:
        `Adversarial Sycophancy detected: ${signalTypes.length} signals co-occurring ` +
        `(${signalTypes.join(", ")}). ` +
        `This matches the 5-step attack pattern from arXiv:2603.12246. ` +
        `Agent refused a benign task while self-praising and/or citing fabricated policies.`,
    };
  }

  return { detected: false };
}

// ── Active Recall (P110 / FM-2.6) ─────────────────────────────────────

/**
 * Active Recall: Search ERROR_LOG.jsonl for the current agent's past failures.
 *
 * Rather than relying on static context (which decays or gets compacted),
 * this forces a targeted search for relevant failure history before
 * emitting a session assessment.
 *
 * Constraint: Uses grep + tail (never reads the whole file).
 *
 * Returns { triggered, warnings[] } or { triggered: false, warnings: [] }.
 */
function activeRecall(agentName, task) {
  const ERROR_LOG = path.join("agents", "evaluator", "ERROR_LOG.jsonl");
  if (!agentName || !fs.existsSync(ERROR_LOG)) {
    return { triggered: false, warnings: [] };
  }

  // Read only lines matching this agent (simulates grep + tail -20)
  const stats = fs.statSync(ERROR_LOG);
  if (stats.size === 0) return { triggered: false, warnings: [] };

  // Use tailLines to avoid reading the whole file, then filter by agent
  const lines = tailLines(ERROR_LOG, 100); // tail -100 (bounded read)
  const agentLower = agentName.toLowerCase();
  const agentEntries = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.agent && entry.agent.toLowerCase() === agentLower) {
        agentEntries.push(entry);
      }
    } catch {
      // skip malformed lines
    }
  }

  if (agentEntries.length === 0) {
    return { triggered: false, warnings: [] };
  }

  // Filter to last 3 days
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const recentEntries = agentEntries.filter((e) => {
    if (!e.timestamp) return false;
    const ts = new Date(e.timestamp).getTime();
    return ts >= threeDaysAgo;
  });

  if (recentEntries.length === 0) {
    return { triggered: false, warnings: [] };
  }

  // Build targeted warnings based on failure types found
  const warnings = [];
  for (const entry of recentEntries) {
    const daysAgo = Math.round(
      (Date.now() - new Date(entry.timestamp).getTime()) / (24 * 60 * 60 * 1000)
    );
    const daysLabel = daysAgo === 0 ? "today" : `${daysAgo} day${daysAgo > 1 ? "s" : ""} ago`;

    warnings.push(
      `[Recall: ${agentName} failed ${daysLabel} due to ${entry.failure_type || "unknown"}. ` +
      `${entry.correction || "Double-check your tool outputs."}]`
    );
  }

  return {
    triggered: true,
    warnings,
    matchCount: recentEntries.length,
    failureTypes: [...new Set(recentEntries.map((e) => e.failure_type).filter(Boolean))],
  };
}

// ── Session Analysis ───────────────────────────────────────────────────

/**
 * Analyze a single session.
 * Returns a structured assessment object.
 */
function analyzeSession(sessionId) {
  const sessionDir = path.join(PERSIST_DIR, "sessions", sessionId);
  const jsonlPath = path.join(sessionDir, "session.jsonl");
  const metaPath = path.join(sessionDir, "meta.json");

  // Check session exists
  if (!fs.existsSync(sessionDir)) {
    return {
      sessionId,
      status: "NOT_FOUND",
      confidence: 1.0,
      evidence: `Session directory not found: ${sessionDir}`,
      recommendedAction: "none",
    };
  }

  // Read meta
  let meta = null;
  try {
    if (fs.existsSync(metaPath)) {
      meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    }
  } catch {
    // proceed without meta
  }

  // Skip non-running sessions
  if (meta && meta.status !== "running") {
    return {
      sessionId,
      agent: meta.agent || "unknown",
      status: "NOT_RUNNING",
      sessionStatus: meta.status,
      confidence: 1.0,
      evidence: `Session is '${meta.status}', not 'running'. No monitoring needed.`,
      recommendedAction: "none",
    };
  }

  // Read tail of session log
  if (!fs.existsSync(jsonlPath)) {
    return {
      sessionId,
      agent: meta?.agent || "unknown",
      status: "NO_LOG",
      confidence: 0.8,
      evidence: "Session directory exists but session.jsonl is missing",
      recommendedAction: "investigate",
    };
  }

  const rawLines = tailLines(jsonlPath, TAIL_LINES);
  const entries = parseJsonl(rawLines);

  if (entries.length === 0) {
    return {
      sessionId,
      agent: meta?.agent || "unknown",
      status: "EMPTY_LOG",
      confidence: 0.8,
      evidence: "session.jsonl exists but contains no valid entries",
      recommendedAction: "investigate",
    };
  }

  // We also need the first few lines for the task (if not in our tail window)
  // Read first 3 lines to get the original task
  let taskEntries = entries; // default: task is in our window
  const fullLineCount = countLines(jsonlPath);
  if (fullLineCount > TAIL_LINES) {
    // Task is likely at the start — read first 3 lines
    const headLines = headLinesFromFile(jsonlPath, 3);
    const headEntries = parseJsonl(headLines);
    taskEntries = headEntries;
  }

  const task = extractTask(taskEntries) || (meta?.task || null);
  const toolCalls = extractToolCalls(entries);
  const recentErrors = extractRecentErrors(entries);

  // ── Active Recall (P110): Check agent's past failures ───────────────
  const agentName = meta?.agent || "unknown";
  const recall = activeRecall(agentName, task);

  // Helper: attach recall warnings to any result object
  function attachRecall(result) {
    if (recall.triggered) {
      result.activeRecall = {
        triggered: true,
        matchCount: recall.matchCount,
        failureTypes: recall.failureTypes,
        warnings: recall.warnings,
      };
    }
    return result;
  }

  // ── Run Detections (in priority order) ─────────────────────────────

  // 1. Loop detection (highest priority — most actionable)
  const loop = detectLoop(toolCalls, entries);
  if (loop.detected) {
    return attachRecall({
      sessionId,
      agent: agentName,
      task: task?.slice(0, 200),
      status: "LOOP",
      confidence: loop.streak >= 5 ? 0.95 : 0.75,
      evidence: loop.evidence,
      details: {
        streak: loop.streak,
        tool: loop.tool,
        totalToolCalls: toolCalls.length,
        recentErrors: recentErrors.length,
      },
      recommendedAction: "interrupt",
    });
  }

  // 2. Stall detection
  const stall = detectStall(entries, meta);
  if (stall.detected) {
    return attachRecall({
      sessionId,
      agent: agentName,
      task: task?.slice(0, 200),
      status: "STALL",
      confidence: stall.minutesIdle > STALL_MINUTES * 2 ? 0.9 : 0.7,
      evidence: stall.evidence,
      details: {
        minutesIdle: stall.minutesIdle,
        totalEntries: entries.length,
        pid: meta?.pid,
      },
      recommendedAction: stall.minutesIdle > STALL_MINUTES * 3 ? "kill" : "investigate",
    });
  }

  // 3. Drift detection (lowest priority — most speculative)
  const drift = detectDrift(toolCalls, task);
  if (drift.detected) {
    return attachRecall({
      sessionId,
      agent: agentName,
      task: task?.slice(0, 200),
      status: "DRIFT",
      confidence: drift.confidence,
      evidence: drift.evidence,
      details: {
        overlapRatio: drift.overlapRatio,
        totalToolCalls: toolCalls.length,
      },
      recommendedAction: "warn",
    });
  }

  // 4. Check for error storms (many consecutive errors)
  const errorStorm = detectErrorStorm(entries);
  if (errorStorm.detected) {
    return attachRecall({
      sessionId,
      agent: agentName,
      task: task?.slice(0, 200),
      status: "ERROR_STORM",
      confidence: 0.7,
      evidence: errorStorm.evidence,
      details: {
        errorCount: errorStorm.errorCount,
        totalEntries: entries.length,
      },
      recommendedAction: "warn",
    });
  }

  // 5. Adversarial Sycophancy — composite detector (2+ signals = coordinated attack)
  //    Must run BEFORE individual selfVal/fakePolicy checks since it's higher confidence.
  const sycophancy = detectAdversarialSycophancy(entries);
  if (sycophancy.detected) {
    return attachRecall({
      sessionId,
      agent: agentName,
      task: task?.slice(0, 200),
      status: "ADVERSARIAL_SYCOPHANCY",
      confidence: 0.95,
      evidence: sycophancy.evidence,
      details: {
        signalCount: sycophancy.signalCount,
        signalTypes: sycophancy.signalTypes,
        signals: sycophancy.signals,
        totalToolCalls: toolCalls.length,
      },
      recommendedAction: "reject",
    });
  }

  // 6. Self-validation / prompt injection detection (P108)
  const selfVal = detectSelfValidation(entries);
  if (selfVal.detected) {
    return attachRecall({
      sessionId,
      agent: agentName,
      task: task?.slice(0, 200),
      status: "SELF_VALIDATION",
      confidence: 0.7,
      evidence: selfVal.evidence,
      details: {
        matchCount: selfVal.matchCount,
        matches: selfVal.matches,
        totalToolCalls: toolCalls.length,
      },
      recommendedAction: "warn",
    });
  }

  // 7. Fake Policy / Refusal Detection (P108 Adversarial Judges)
  const fakePolicy = detectFakePolicy(entries);
  if (fakePolicy.detected) {
    return attachRecall({
      sessionId,
      agent: agentName,
      task: task?.slice(0, 200),
      status: "FAKE_POLICY",
      confidence: 0.8,
      evidence: fakePolicy.evidence,
      details: {
        matches: fakePolicy.matches,
      },
      recommendedAction: "flag_adversarial",
    });
  }

  // 8. Reasoning-Action Mismatch (P120 / arXiv:2603.12246 Attack #3)
  const mismatch = detectReasoningMismatch(entries);
  if (mismatch.detected) {
    return attachRecall({
      sessionId,
      agent: agentName,
      task: task?.slice(0, 200),
      status: "REASONING_MISMATCH",
      confidence: 0.85,
      evidence: mismatch.evidence,
      details: {
        mismatchCount: mismatch.mismatchCount,
        mismatches: mismatch.mismatches,
        totalToolCalls: toolCalls.length,
      },
      recommendedAction: "flag_adversarial",
    });
  }

  // All clear
  const lastTs = getLastTimestamp(entries);
  const idleSeconds = lastTs > 0 ? Math.round((Date.now() - lastTs) / 1000) : null;

  return attachRecall({
    sessionId,
    agent: agentName,
    task: task?.slice(0, 200),
    status: "HEALTHY",
    confidence: 1.0,
    evidence: `Session is active. ${toolCalls.length} tool calls in window, ${recentErrors.length} errors. Last activity ${idleSeconds !== null ? idleSeconds + "s ago" : "unknown"}.`,
    details: {
      totalToolCalls: toolCalls.length,
      recentErrors: recentErrors.length,
      lastActivitySecondsAgo: idleSeconds,
    },
    recommendedAction: "none",
  });
}

/**
 * Detect error storms: many consecutive toolResult errors.
 */
function detectErrorStorm(entries) {
  // Count consecutive errors from the end
  let consecutiveErrors = 0;
  let totalErrors = 0;

  // Walk backwards through entries
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.role === "toolResult") {
      if (entry.isError) {
        totalErrors++;
        consecutiveErrors++;
      } else {
        break; // first non-error toolResult breaks the streak
      }
    } else if (entry.role === "assistant") {
      // Assistant messages between errors are normal (agent retrying)
      continue;
    }
  }

  // Also count total errors in window
  for (const entry of entries) {
    if (entry.role === "toolResult" && entry.isError) {
      totalErrors++;
    }
  }

  if (consecutiveErrors >= 3) {
    return {
      detected: true,
      errorCount: consecutiveErrors,
      evidence: `${consecutiveErrors} consecutive tool errors at end of session (${totalErrors} total errors in window)`,
    };
  }

  return { detected: false };
}

/**
 * Count total lines in a file (fast — doesn't parse).
 */
function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content.split("\n").filter((l) => l.trim()).length;
  } catch {
    return 0;
  }
}

/**
 * Read first N lines from a file.
 */
function headLinesFromFile(filePath, n) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content
      .split("\n")
      .filter((l) => l.trim())
      .slice(0, n);
  } catch {
    return [];
  }
}

// ── Session Discovery ──────────────────────────────────────────────────

/**
 * List all active (non-archived) session IDs.
 * Active sessions live in .state/sessions/<id>/ (not in history/).
 */
function listActiveSessions() {
  const sessionsDir = path.join(PERSIST_DIR, "sessions");
  if (!fs.existsSync(sessionsDir)) return [];

  try {
    return fs
      .readdirSync(sessionsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith("s_"))
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/**
 * List only currently running sessions (status === "running" in meta.json).
 */
function listRunningSessions() {
  const active = listActiveSessions();
  const running = [];

  for (const sid of active) {
    const metaPath = path.join(PERSIST_DIR, "sessions", sid, "meta.json");
    try {
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        if (meta.status === "running") {
          running.push(sid);
        }
      }
    } catch {
      // skip unreadable
    }
  }

  return running;
}

// ── Main ───────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  // Parse flags
  const flags = {
    all: args.includes("--all"),
    running: args.includes("--running"),
    verbose: args.includes("--verbose") || args.includes("-v"),
  };

  // Determine which sessions to analyze
  let sessionIds = [];

  if (flags.all) {
    // Scan all active sessions
    sessionIds = listActiveSessions();
  } else if (flags.running) {
    // Scan only running sessions
    sessionIds = listRunningSessions();
  } else if (args.length > 0 && !args[0].startsWith("-")) {
    // Specific session ID
    sessionIds = [args[0]];
  } else {
    // Default: scan running sessions
    sessionIds = listRunningSessions();
  }

  if (sessionIds.length === 0) {
    const output = {
      timestamp: new Date().toISOString(),
      sessionsChecked: 0,
      results: [],
      summary: "No active/running sessions found to monitor.",
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Analyze each session
  const results = sessionIds.map(analyzeSession);

  // Build summary
  const unhealthy = results.filter((r) => !["HEALTHY", "NOT_RUNNING", "NOT_FOUND"].includes(r.status));
  const healthy = results.filter((r) => r.status === "HEALTHY");
  const notRunning = results.filter((r) => r.status === "NOT_RUNNING");

  const output = {
    timestamp: new Date().toISOString(),
    sessionsChecked: results.length,
    healthy: healthy.length,
    unhealthy: unhealthy.length,
    skipped: notRunning.length,
    results: flags.verbose ? results : unhealthy.length > 0 ? results : results.filter((r) => r.status !== "NOT_RUNNING"),
    summary:
      unhealthy.length === 0
        ? `All ${healthy.length} running session(s) healthy.`
        : `⚠️ ${unhealthy.length} session(s) need attention: ${unhealthy.map((r) => `${r.sessionId} (${r.status})`).join(", ")}`,
  };

  // If any session needs intervention, also output a markdown-formatted alert
  if (unhealthy.length > 0) {
    output.alerts = unhealthy.map((r) => ({
      sessionId: r.sessionId,
      agent: r.agent,
      status: r.status,
      action: r.recommendedAction,
      evidence: r.evidence,
    }));
  }

  console.log(JSON.stringify(output, null, 2));

  // Exit with non-zero if any session is unhealthy (useful for cron/scripts)
  if (unhealthy.length > 0) {
    process.exit(1);
  }
}

// ── Exports (for testing) ──────────────────────────────────────────────
// When required as a module, export detection functions without running main().
// When executed directly (node monitor-session.cjs), run main().

if (require.main === module) {
  main();
} else {
  module.exports = {
    parseJsonl,
    detectSelfValidation,
    detectFakePolicy,
    detectReasoningMismatch,
    detectAdversarialSycophancy,
    detectLoop,
    detectStall,
    detectDrift,
    detectErrorStorm,
    extractToolCalls,
    extractTask,
    extractRecentErrors,
    tailLines,
  };
}
