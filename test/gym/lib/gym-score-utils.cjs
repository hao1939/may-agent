"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// test/gym/lib/gym-score-utils.ts
var gym_score_utils_exports = {};
__export(gym_score_utils_exports, {
  Score: () => Score
});
module.exports = __toCommonJS(gym_score_utils_exports);
var import_node_fs2 = require("node:fs");
var import_node_path = require("node:path");

// test/gym/lib/transcript-utils.ts
var import_node_fs = require("node:fs");
function loadTranscript(transcriptPath) {
  if (!(0, import_node_fs.existsSync)(transcriptPath)) return null;
  const raw = (0, import_node_fs.readFileSync)(transcriptPath, "utf-8");
  const entries = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
    }
  }
  const toolCalls = [];
  const toolResults = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.role === "assistant" && Array.isArray(entry.content)) {
      for (const part of entry.content) {
        if (part.type === "toolCall" || part.type === "tool_use") {
          let args = {};
          if (typeof part.arguments === "string") {
            try {
              args = JSON.parse(part.arguments);
            } catch {
            }
          } else if (typeof part.arguments === "object" && part.arguments !== null) {
            args = part.arguments;
          } else if (typeof part.input === "object" && part.input !== null) {
            args = part.input;
          }
          toolCalls.push({
            id: part.id || part.toolCallId || "",
            name: part.name || part.toolName || "",
            arguments: args,
            entryIndex: i,
            timestamp: entry.timestamp
          });
        }
      }
    }
    if (entry.role === "toolResult" || entry.role === "tool") {
      let content = "";
      if (typeof entry.content === "string") {
        content = entry.content;
      } else if (Array.isArray(entry.content)) {
        content = entry.content.map((p) => p.text || "").join("\n");
      }
      toolResults.push({
        toolCallId: entry.toolCallId || "",
        toolName: entry.toolName || "",
        content,
        isError: entry.isError === true,
        entryIndex: i,
        timestamp: entry.timestamp
      });
    }
  }
  return { entries, toolCalls, toolResults };
}
function hasToolCall(transcript, toolName) {
  return transcript.toolCalls.some((tc) => tc.name === toolName);
}
function getToolCalls(transcript, toolName) {
  return transcript.toolCalls.filter((tc) => tc.name === toolName);
}
function countToolUsage(transcript, toolName) {
  return getToolCalls(transcript, toolName).length;
}
function hasToolCallWithArgs(transcript, toolName, argPatterns) {
  return transcript.toolCalls.some((tc) => {
    if (tc.name !== toolName) return false;
    for (const [key, pattern] of Object.entries(argPatterns)) {
      const actual = tc.arguments[key];
      if (pattern instanceof RegExp) {
        if (typeof actual !== "string" || !pattern.test(actual)) return false;
      } else {
        if (actual !== pattern) return false;
      }
    }
    return true;
  });
}
function hasVerificationAfterWrite(transcript, filePath) {
  const writes = transcript.toolCalls.filter(
    (tc) => (tc.name === "write" || tc.name === "edit") && typeof tc.arguments.path === "string" && tc.arguments.path.includes(filePath)
  );
  if (writes.length === 0) return false;
  for (const write of writes) {
    const readsAfter = transcript.toolCalls.filter(
      (tc) => tc.entryIndex > write.entryIndex && (tc.name === "read" && typeof tc.arguments.path === "string" && tc.arguments.path.includes(filePath) || tc.name === "bash" && typeof tc.arguments.command === "string" && (tc.arguments.command.includes(`cat `) || tc.arguments.command.includes(`head `)) && tc.arguments.command.includes(filePath))
    );
    if (readsAfter.length > 0) return true;
  }
  return false;
}
function getFinishCall(transcript) {
  const finishCalls = transcript.toolCalls.filter((tc) => tc.name === "finish");
  if (finishCalls.length === 0) return null;
  const last = finishCalls[finishCalls.length - 1];
  return {
    status: last.arguments.status || "unknown",
    summary: last.arguments.summary,
    deliverables: last.arguments.deliverables,
    blockers: last.arguments.blockers
  };
}
function countTurns(transcript) {
  return transcript.entries.filter((e) => e.role === "assistant").length;
}
function totalOps(transcript) {
  return transcript.toolCalls.length;
}

// test/gym/lib/gym-score-utils.ts
var Score = class {
  workDir;
  transcriptPath;
  transcript;
  checks = [];
  constructor(workDir) {
    this.workDir = workDir;
    this.transcriptPath = (0, import_node_path.join)(workDir, "transcript.jsonl");
    this.transcript = loadTranscript(this.transcriptPath);
  }
  // ── Check registration ───────────────────────────────────────────────
  /**
   * Check a product requirement (file exists, content correct, etc.).
   */
  checkProduct(name, description, fn) {
    try {
      const passed = fn();
      this.checks.push({
        name,
        passed,
        detail: passed ? description : `FAIL: ${description}`,
        category: "product"
      });
    } catch (err) {
      this.checks.push({
        name,
        passed: false,
        detail: `ERROR: ${err.message}`,
        category: "product"
      });
    }
    return this;
  }
  /**
   * Check a convention compliance requirement (references CONVENTIONS.md codes).
   */
  checkConvention(code, name, fn) {
    try {
      const passed = fn();
      this.checks.push({
        name: `${code}: ${name}`,
        passed,
        detail: passed ? `Convention ${code} satisfied` : `FAIL: Convention ${code} violated`,
        category: "convention",
        code
      });
    } catch (err) {
      this.checks.push({
        name: `${code}: ${name}`,
        passed: false,
        detail: `ERROR checking ${code}: ${err.message}`,
        category: "convention",
        code
      });
    }
    return this;
  }
  /**
   * Check a behavioral requirement (escalation, convergence, etc.).
   */
  checkBehavior(name, description, fn) {
    try {
      const passed = fn();
      this.checks.push({
        name,
        passed,
        detail: passed ? description : `FAIL: ${description}`,
        category: "behavior"
      });
    } catch (err) {
      this.checks.push({
        name,
        passed: false,
        detail: `ERROR: ${err.message}`,
        category: "behavior"
      });
    }
    return this;
  }
  /**
   * Check an efficiency requirement (minimal tool calls, fast convergence, etc.).
   */
  checkEfficiency(name, description, fn) {
    try {
      const passed = fn();
      this.checks.push({
        name,
        passed,
        detail: passed ? description : `FAIL: ${description}`,
        category: "efficiency"
      });
    } catch (err) {
      this.checks.push({
        name,
        passed: false,
        detail: `ERROR: ${err.message}`,
        category: "efficiency"
      });
    }
    return this;
  }
  // ── Convenience transcript queries ───────────────────────────────────
  /** Whether a transcript was loaded successfully. */
  hasTranscript() {
    return this.transcript !== null;
  }
  /** Check if a tool was ever called. */
  hasTool(toolName) {
    return this.transcript ? hasToolCall(this.transcript, toolName) : false;
  }
  /** Check if a tool was called with matching args. */
  hasToolWithArgs(toolName, argPatterns) {
    return this.transcript ? hasToolCallWithArgs(this.transcript, toolName, argPatterns) : false;
  }
  /** Count calls to a specific tool. */
  toolCount(toolName) {
    return this.transcript ? countToolUsage(this.transcript, toolName) : 0;
  }
  /** Get all calls to a tool. */
  toolCalls(toolName) {
    return this.transcript ? getToolCalls(this.transcript, toolName) : [];
  }
  /** Check if a read/verify happened after a write to the same file. */
  hasVerifyAfterWrite(filePath) {
    return this.transcript ? hasVerificationAfterWrite(this.transcript, filePath) : false;
  }
  /** Get the finish() call details. */
  finishCall() {
    return this.transcript ? getFinishCall(this.transcript) : null;
  }
  /** Get the finish status string (e.g., "success", "blocked", "partial"). */
  finishStatus() {
    const f = this.finishCall();
    return f ? f.status : null;
  }
  /** Count assistant turns. */
  turns() {
    return this.transcript ? countTurns(this.transcript) : 0;
  }
  /** Count total tool operations. */
  ops() {
    return this.transcript ? totalOps(this.transcript) : 0;
  }
  /** Count how many times a tool call errored. */
  errorCount(toolName) {
    if (!this.transcript) return 0;
    const results = this.transcript.toolResults.filter((r) => r.isError);
    if (toolName) return results.filter((r) => r.toolName === toolName).length;
    return results.length;
  }
  /** Check if the first assistant message contains a pattern (for promise checking). */
  firstMessageContains(pattern) {
    if (!this.transcript) return false;
    const firstAssistant = this.transcript.entries.find((e) => e.role === "assistant");
    if (!firstAssistant) return false;
    const text = extractText(firstAssistant.content);
    if (pattern instanceof RegExp) return pattern.test(text);
    return text.toLowerCase().includes(pattern.toLowerCase());
  }
  /** Check if any assistant message contains a pattern. */
  anyMessageContains(pattern) {
    if (!this.transcript) return false;
    return this.transcript.entries.filter((e) => e.role === "assistant").some((e) => {
      const text = extractText(e.content);
      if (pattern instanceof RegExp) return pattern.test(text);
      return text.toLowerCase().includes(pattern.toLowerCase());
    });
  }
  /** Check if a bash command matching a pattern was executed. */
  hasBashCommand(pattern) {
    return this.hasToolWithArgs("bash", { command: pattern });
  }
  /** Check if a file in workDir exists. */
  fileExists(relativePath) {
    return (0, import_node_fs2.existsSync)((0, import_node_path.join)(this.workDir, relativePath));
  }
  /** Read a file from workDir. Returns null if missing. */
  readFile(relativePath) {
    const p = (0, import_node_path.join)(this.workDir, relativePath);
    if (!(0, import_node_fs2.existsSync)(p)) return null;
    return (0, import_node_fs2.readFileSync)(p, "utf-8");
  }
  // ── Report ───────────────────────────────────────────────────────────
  /**
   * Print the score report as JSON to stdout (for gym-runner to parse)
   * and exit with code 0 (pass) or 1 (any check failed).
   */
  report() {
    const passed = this.checks.every((c) => c.passed);
    const summary = this.checks.map((c) => `${c.passed ? "\u2713" : "\u2717"} [${c.category}] ${c.name}`).join("\n");
    const result = {
      passed,
      checks: this.checks.map((c) => ({
        name: c.name,
        passed: c.passed,
        detail: c.detail,
        category: c.category,
        ...c.code ? { code: c.code } : {}
      })),
      summary
    };
    console.log(JSON.stringify(result));
    process.exit(0);
  }
};
function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter((p) => p.type === "text" && typeof p.text === "string").map((p) => p.text).join("\n");
  }
  return "";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Score
});
