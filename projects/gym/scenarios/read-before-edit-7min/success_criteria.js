/**
 * Success Criteria for "read-before-edit"
 *
 * Tests the coder-edit-discipline skill: always read a file before editing it.
 *
 * Product:
 *   P1: validator.js has === instead of =
 *   P2: formatter.js padStart uses ' ' not '0'
 *   P3: parser.js regex has /g flag
 *   P4: No other content in any file changed
 *
 * Convention:
 *   C1: Agent reads each file BEFORE modifying it (edit, write, or bash-based)
 *   C2.3: Agent verifies at least 2/3 files after editing
 *
 * Trap: Task description quotes slightly different indentation/line numbers than
 *       the actual files. An agent that reads the file first will use correct
 *       oldText; one that copies from the task description may get wrong whitespace.
 */

const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product Checks ─────────────────────────────────────────────────────

s.checkProduct("validator-bug-fixed", "validator.js uses === not =", () => {
  const raw = s.readFile("src/validator.js");
  if (!raw) return false;
  // Must have `value === expected` and NOT have the bug `value = expected`
  // (but must still have `=` in assignment contexts, so check specifically)
  return raw.includes("if (value === expected)") && !raw.includes("if (value = expected)");
});

s.checkProduct("formatter-bug-fixed", "formatter.js padStart uses space not zero", () => {
  const raw = s.readFile("src/formatter.js");
  if (!raw) return false;
  return raw.includes("padStart(width, ' ')") && !raw.includes("padStart(width, '0')");
});

s.checkProduct("parser-bug-fixed", "parser.js regex has /g flag", () => {
  const raw = s.readFile("src/parser.js");
  if (!raw) return false;
  return raw.includes("/\\d+/g") && !raw.includes("/\\d+/;");
});

s.checkProduct("validator-preserved", "validator.js other content unchanged", () => {
  const raw = s.readFile("src/validator.js");
  if (!raw) return false;
  // Check key structural elements are preserved
  return raw.includes("function validateField(value, expected, fieldName)") &&
         raw.includes("function validateRecord(record, schema)") &&
         raw.includes("String(value) === String(expected)") &&
         raw.includes("module.exports = { validateField, validateRecord }");
});

s.checkProduct("formatter-preserved", "formatter.js other content unchanged", () => {
  const raw = s.readFile("src/formatter.js");
  if (!raw) return false;
  return raw.includes("function formatNumber(num, width)") &&
         raw.includes("function formatCurrency(amount, symbol)") &&
         raw.includes("function formatTable(rows, columns)") &&
         raw.includes("const DEFAULT_WIDTH = 10");
});

s.checkProduct("parser-preserved", "parser.js other content unchanged", () => {
  const raw = s.readFile("src/parser.js");
  if (!raw) return false;
  return raw.includes("function parseCSV(input)") &&
         raw.includes("function parseKeyValue(input)") &&
         raw.includes("function parseJSON(input)") &&
         raw.includes("const DELIMITER = ','");
});

// ── Convention C1: Read Before Edit ────────────────────────────────────

/**
 * Helper: find all file-modification operations from transcript.
 * Covers edit(), write(), AND bash commands that modify files (sed, >, node -e, python).
 */
function getFileModifications(score, filename) {
  const t = score.transcript ? score.transcript.toolCalls : null;
  if (!t) return [];

  const mods = [];

  for (const e of t) {
    const tool = e.tool || e.name || "";
    const args = e.arguments || {};

    // edit() or write() to this file
    if ((tool === "edit" || tool === "write") && String(args.path || "").includes(filename)) {
      mods.push(e);
      continue;
    }

    // bash command that modifies this file
    if (tool === "bash" && typeof args.command === "string" && args.command.includes(filename)) {
      const cmd = args.command;
      // Heuristic: commands that write to files
      if (cmd.includes(">") || cmd.includes("sed ") || cmd.includes("sed -i") ||
          cmd.includes("node -e") || cmd.includes("python") ||
          cmd.includes("echo ") || cmd.includes("printf ") ||
          cmd.includes("tee ") || cmd.includes("awk ")) {
        mods.push(e);
      }
    }
  }

  return mods;
}

function getFileReads(score, filename) {
  const t = score.transcript ? score.transcript.toolCalls : null;
  if (!t) return [];

  const reads = [];

  for (const e of t) {
    const tool = e.tool || e.name || "";
    const args = e.arguments || {};

    // read() of this file
    if (tool === "read" && String(args.path || "").includes(filename)) {
      reads.push(e);
      continue;
    }

    // bash command that reads this file (cat, head, less, grep, etc.)
    // BUT NOT one that also writes (>)
    if (tool === "bash" && typeof args.command === "string" && args.command.includes(filename)) {
      const cmd = args.command;
      if ((cmd.includes("cat ") || cmd.includes("head ") || cmd.includes("grep ") ||
           cmd.includes("less ") || cmd.includes("tail ")) &&
          !cmd.includes(">") && !cmd.includes("sed ") && !cmd.includes("tee ")) {
        reads.push(e);
      }
    }
  }

  return reads;
}

// C1: read-before-edit for EACH file
s.checkConvention("C1", "read-before-edit-all-files", () => {
  if (!s.hasTranscript()) return true;

  const files = ["validator.js", "formatter.js", "parser.js"];
  let allOk = true;

  for (const file of files) {
    const mods = getFileModifications(s, file);
    const reads = getFileReads(s, file);

    // If file was modified, there must be a read BEFORE the first modification
    if (mods.length > 0) {
      const firstMod = mods[0];
      const readBefore = reads.some(r => r.entryIndex < firstMod.entryIndex);
      if (!readBefore) {
        allOk = false;
      }
    }
  }

  return allOk;
});

// C1 per-file (for detailed diagnostics)
for (const file of ["validator.js", "formatter.js", "parser.js"]) {
  s.checkConvention("C1", `read-before-edit-${file}`, () => {
    if (!s.hasTranscript()) return true;
    const mods = getFileModifications(s, file);
    const reads = getFileReads(s, file);
    if (mods.length === 0) return true; // file not modified — vacuously true
    const firstMod = mods[0];
    return reads.some(r => r.entryIndex < firstMod.entryIndex);
  });
}

// ── Convention C2.3: Verify After Edit ────────────────────────────────

s.checkConvention("C2.3", "verify-after-edit", () => {
  if (!s.hasTranscript()) return true;

  let verified = 0;
  for (const file of ["validator.js", "formatter.js", "parser.js"]) {
    // Check for any read after the last modification
    const mods = getFileModifications(s, file);
    const reads = getFileReads(s, file);

    if (mods.length > 0) {
      const lastMod = mods[mods.length - 1];
      const readAfter = reads.some(r => r.entryIndex > lastMod.entryIndex);

      // Also check hasVerifyAfterWrite for edit/write tool calls specifically
      if (readAfter || s.hasVerifyAfterWrite(file)) {
        verified++;
      }
    }
  }

  return verified >= 2; // At least 2 of 3 files verified after edit
});

s.report();
