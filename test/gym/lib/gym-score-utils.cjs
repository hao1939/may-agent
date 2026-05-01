/**
 * gym-score-utils.cjs — Shared scoring utilities for gym scenario success_criteria.js files.
 *
 * Provides the Score class that:
 * - Reads files from the agent's work directory
 * - Parses transcript.jsonl for behavioral analysis
 * - Collects check results (product, behavior, convention, efficiency)
 * - Outputs a JSON report to stdout
 *
 * Transcript format (JSONL): Each line is a JSON object with at least:
 *   { "role": "assistant"|"user"|"tool", "tool": "<name>", "arguments": {...}, "content": "..." }
 * Tool calls have "tool" and "arguments" fields.
 * The transcript may also include an "entryIndex" or the Score class assigns one based on line order.
 */

const fs = require("fs");
const path = require("path");

class Score {
  /**
   * @param {string} workDir - The agent's working directory (temp dir with environment + agent output)
   */
  constructor(workDir) {
    this._workDir = workDir;
    this._checks = [];
    this._transcript = null; // lazy-loaded
    this._transcriptLoaded = false;
  }

  // ── File helpers ───────────────────────────────────────────────────

  /**
   * Read a file from the work directory. Returns contents as string, or null if not found.
   * @param {string} relPath - Relative path within workDir
   * @returns {string|null}
   */
  readFile(relPath) {
    const full = path.join(this._workDir, relPath);
    try {
      return fs.readFileSync(full, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Check if a file exists in the work directory.
   * @param {string} relPath
   * @returns {boolean}
   */
  fileExists(relPath) {
    const full = path.join(this._workDir, relPath);
    return fs.existsSync(full);
  }

  // ── Transcript helpers ─────────────────────────────────────────────

  /**
   * Load and parse the transcript JSONL file. Called lazily on first transcript access.
   * @returns {Array<Object>} Array of transcript entries
   * @private
   */
  _loadTranscript() {
    if (this._transcriptLoaded) return this._transcript;
    this._transcriptLoaded = true;

    // Try both names: runner writes "transcript.jsonl", legacy used "_gym_transcript.jsonl"
    let transcriptPath = path.join(this._workDir, "transcript.jsonl");
    if (!fs.existsSync(transcriptPath)) {
      transcriptPath = path.join(this._workDir, "_gym_transcript.jsonl");
    }
    if (!fs.existsSync(transcriptPath)) {
      this._transcript = null;
      return null;
    }

    try {
      const raw = fs.readFileSync(transcriptPath, "utf-8");
      const lines = raw.split("\n").filter(l => l.trim());
      const entries = [];
      let entryIdx = 0;
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          // Flatten pi-agent message format: {role, content: [{type:"toolCall", name, arguments}]}
          if (Array.isArray(entry.content)) {
            for (const block of entry.content) {
              if (block.type === "toolCall" && block.name) {
                entries.push({ tool: block.name, name: block.name, arguments: block.arguments || {}, id: block.id, entryIndex: entryIdx++, _role: entry.role });
              } else if (block.type === "toolResult" && block.toolName) {
                entries.push({ tool: block.toolName, name: block.toolName, toolResult: true, content: block.content, toolCallId: block.toolCallId, entryIndex: entryIdx++, _role: entry.role });
              }
            }
            // Also keep the raw entry for text content access
            entry.entryIndex = entryIdx++;
            entries.push(entry);
          } else {
            // Flat format: {tool, arguments, ...}
            if (entry.entryIndex === undefined) entry.entryIndex = entryIdx++;
            entries.push(entry);
          }
        } catch {
          entries.push({ entryIndex: entryIdx++, raw: line });
        }
      }
      this._transcript = entries;
      return this._transcript;
    } catch {
      this._transcript = null;
      return null;
    }
  }

  /**
   * Whether a transcript file exists and was parseable.
   * @returns {boolean}
   */
  hasTranscript() {
    return this._loadTranscript() !== null && this._loadTranscript().length > 0;
  }

  /**
   * Return the full transcript as a single string (all JSONL lines concatenated).
   * Useful for regex searching across the entire session.
   * @returns {string}
   */
  rawTranscript() {
    const transcriptPath = path.join(this._workDir, "transcript.jsonl");
    const legacyPath = path.join(this._workDir, "_gym_transcript.jsonl");
    const p = fs.existsSync(transcriptPath) ? transcriptPath : (fs.existsSync(legacyPath) ? legacyPath : null);
    if (!p) return "";
    try { return fs.readFileSync(p, "utf-8"); } catch { return ""; }
  }

  /**
   * Lazy-initialized transcript accessor with .toolCalls and .toolResults arrays.
   * Used by success_criteria that access s.transcript.toolCalls / s.transcript.toolResults.
   * @returns {{ toolCalls: Array<Object>, toolResults: Array<Object> }|null}
   */
  get transcript() {
    const t = this._loadTranscript();
    if (!t) return null;
    return {
      toolCalls: t.filter(e => (e.tool || e.name) && !e.toolResult),
      toolResults: t.filter(e => e.toolResult),
    };
  }

  /**
   * Get all tool calls matching a specific tool name.
   * Each returned entry has: { tool, arguments, entryIndex, ... }
   * @param {string} toolName - e.g. "read", "edit", "write", "bash", "finish"
   * @returns {Array<Object>}
   */
  toolCalls(toolName) {
    const t = this._loadTranscript();
    if (!t) return [];
    return t.filter(e => e.tool === toolName || e.name === toolName);
  }

  /**
   * Total number of tool-call operations in the transcript.
   * @returns {number}
   */
  ops() {
    const t = this._loadTranscript();
    if (!t) return 0;
    return t.filter(e => e.tool || e.name).length;
  }

  /**
   * Get the finish() tool call, if any.
   * @returns {Object|null}
   */
  finishCall() {
    const calls = this.toolCalls("finish");
    return calls.length > 0 ? calls[calls.length - 1] : null;
  }

  /**
   * Get the status from the finish() call.
   * @returns {string|null} - "success", "failure", "blocked", "partial", or null
   */
  finishStatus() {
    const fc = this.finishCall();
    if (!fc) return null;
    const args = fc.arguments || fc.params || {};
    return args.status || null;
  }

  /**
   * Check if any assistant message matches a regex.
   * @param {RegExp} pattern
   * @returns {boolean}
   */
  anyMessageContains(pattern) {
    const t = this._loadTranscript();
    if (!t) return false;
    return t.some(e => {
      if (e.role === "assistant" || (!e.role && e.content)) {
        const text = typeof e.content === "string" ? e.content : JSON.stringify(e);
        return pattern.test(text);
      }
      // Also check tool call arguments as stringified text
      if (e.arguments) {
        return pattern.test(JSON.stringify(e.arguments));
      }
      return false;
    });
  }

  /**
   * Check if the first assistant message matches a regex.
   * @param {RegExp} pattern
   * @returns {boolean}
   */
  firstMessageContains(pattern) {
    const t = this._loadTranscript();
    if (!t) return false;
    const first = t.find(e => e.role === "assistant" && e.content);
    if (!first) return false;
    // Handle array content (pi-agent format: [{type:"text", text:"..."}, ...])
    let text = first.content;
    if (Array.isArray(text)) {
      text = text
        .filter(b => b.type === "text" && b.text)
        .map(b => b.text)
        .join("\n");
    }
    if (!text) return false;
    return pattern.test(text);
  }

  /**
   * Check if any bash tool call's command matches a regex.
   * @param {RegExp} pattern
   * @returns {boolean}
   */
  hasBashCommand(pattern) {
    const bashCalls = this.toolCalls("bash");
    return bashCalls.some(c => {
      const cmd = String((c.arguments || {}).command || "");
      return pattern.test(cmd);
    });
  }

  /**
   * Check if there is a read/verify operation after a write/edit to a specific file.
   * Used for C2.3 (verify after acting) convention checks.
   * @param {string} filename - Filename to check (partial match)
   * @returns {boolean}
   */
  hasVerifyAfterWrite(filename) {
    const t = this._loadTranscript();
    if (!t) return false;

    // Find last write/edit to this file
    const writes = t.filter(e => {
      const tool = e.tool || e.name || "";
      if (tool !== "edit" && tool !== "write") return false;
      const p = String((e.arguments || {}).path || "");
      return p.includes(filename);
    });

    if (writes.length === 0) return false;
    const lastWrite = writes[writes.length - 1];

    // edit() and write() return previews — counts as self-verification
    const lastTool = lastWrite.tool || lastWrite.name || "";
    if (lastTool === "edit" || lastTool === "write") return true;

    // Check for a read after the last write
    const readsAfter = t.filter(e => {
      const tool = e.tool || e.name || "";
      if (tool !== "read") return false;
      const p = String((e.arguments || {}).path || "");
      return p.includes(filename) && e.entryIndex > lastWrite.entryIndex;
    });

    // Also count bash commands that cat/head/less the file
    const bashVerifyAfter = t.filter(e => {
      const tool = e.tool || e.name || "";
      if (tool !== "bash") return false;
      const cmd = String((e.arguments || {}).command || "");
      return (cmd.includes("cat") || cmd.includes("head") || cmd.includes("grep")) &&
             cmd.includes(filename) &&
             e.entryIndex > lastWrite.entryIndex;
    });

    return readsAfter.length > 0 || bashVerifyAfter.length > 0;
  }

  /**
   * Check if a file was read before any write/edit operation.
   * Used for convention checks like "read data before writing report".
   * @param {string} filename - Filename to check (partial match)
   * @returns {boolean}
   */
  hasReadBeforeWrite(filename) {
    const t = this._loadTranscript();
    if (!t) return false;

    // Find first write/edit (any file)
    const firstWrite = t.find(e => {
      const tool = e.tool || e.name || "";
      return tool === "edit" || tool === "write";
    });

    if (!firstWrite) return true; // no writes = vacuously true

    // Find any read of the target file before the first write
    const readsBefore = t.filter(e => {
      const tool = e.tool || e.name || "";
      if (tool === "read") {
        const p = String((e.arguments || {}).path || "");
        return p.includes(filename) && e.entryIndex < firstWrite.entryIndex;
      }
      if (tool === "bash") {
        const cmd = String((e.arguments || {}).command || "");
        return (cmd.includes("cat") || cmd.includes("head") || cmd.includes("grep")) &&
               cmd.includes(filename) &&
               e.entryIndex < firstWrite.entryIndex;
      }
      return false;
    });

    return readsBefore.length > 0;
  }

  /**
   * Check if any entry in the transcript matches a regex (stringified).
   * @param {RegExp} pattern
   * @returns {boolean}
   */
  transcriptContains(pattern) {
    const t = this._loadTranscript();
    if (!t) return false;
    return t.some(e => pattern.test(JSON.stringify(e)));
  }

  /**
   * Find the index of the first transcript entry matching a regex (stringified).
   * Returns -1 if not found.
   * @param {RegExp} pattern
   * @returns {number}
   */
  transcriptIndexOf(pattern) {
    const t = this._loadTranscript();
    if (!t) return -1;
    return t.findIndex(e => pattern.test(JSON.stringify(e)));
  }

  // ── Check registration ─────────────────────────────────────────────

  /**
   * Register a product quality check.
   * @param {string} name - Unique check identifier
   * @param {string} detail - Human-readable description
   * @param {function} fn - Returns boolean (true = passed)
   */
  checkProduct(name, detail, fn) {
    this._addCheck("product", name, detail, fn);
  }

  /**
   * Register a behavioral check (how the agent approached the problem).
   * @param {string} name - Unique check identifier
   * @param {string} detail - Human-readable description
   * @param {function} fn - Returns boolean (true = passed)
   */
  checkBehavior(name, detail, fn) {
    this._addCheck("behavior", name, detail, fn);
  }

  /**
   * Register a convention compliance check.
   * @param {string} convention - Convention code (e.g. "C1", "C2.3", "C30")
   * @param {string} name - Unique check identifier
   * @param {function} fn - Returns boolean (true = passed)
   */
  checkConvention(convention, name, fn) {
    this._addCheck("convention", `${convention}:${name}`, `Convention ${convention}`, fn);
  }

  /**
   * Register an efficiency check.
   * @param {string} name - Unique check identifier
   * @param {string} detail - Human-readable description
   * @param {function} fn - Returns boolean (true = passed)
   */
  checkEfficiency(name, detail, fn) {
    this._addCheck("efficiency", name, detail, fn);
  }

  /**
   * @private
   */
  _addCheck(type, name, detail, fn) {
    try {
      const passed = !!fn();
      this._checks.push({ name, type, passed, detail });
    } catch (err) {
      this._checks.push({
        name,
        type,
        passed: false,
        detail: `Error in check: ${err && err.message ? err.message : String(err)}`,
      });
    }
  }

  // ── Report output ──────────────────────────────────────────────────

  /**
   * Output the final JSON report to stdout and exit.
   * Format: { passed: boolean, checks: [...], summary: string }
   */
  report() {
    const allPassed = this._checks.every(c => c.passed);
    const failed = this._checks.filter(c => !c.passed);
    const summary = allPassed
      ? `All ${this._checks.length} checks passed`
      : `${failed.length}/${this._checks.length} checks failed: ${failed.map(c => c.name).join(", ")}`;

    const output = {
      passed: allPassed,
      checks: this._checks.map(c => ({
        name: c.name,
        passed: c.passed,
        detail: c.detail,
        message: c.detail, // runner normalizes to "message"
      })),
      summary,
    };

    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    process.exit(allPassed ? 0 : 1);
  }
}

module.exports = { Score };
