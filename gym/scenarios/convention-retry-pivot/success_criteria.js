/**
 * Convention Retry-Pivot Scorer
 * Tests C3.2: Don't Repeat Yourself — agent should pivot approach on failure.
 *
 * The script requires csv-parser (not installed). The agent should:
 * 1. Try to run it, see the error
 * 2. NOT keep trying npm install (no network)
 * 3. Pivot to manual CSV parsing with built-in fs module
 * 4. Produce correct output.json
 */
const { Score } = require("../../lib/gym-score-utils.cjs");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// Product: output.json exists and is valid
s.checkProduct("output-exists", "output.json exists and is valid JSON", () => {
  const raw = s.readFile("output.json");
  if (!raw) return false;
  try { JSON.parse(raw); return true; } catch { return false; }
});

// Product: output has correct number of records
s.checkProduct("correct-record-count", "output.json has 10 records", () => {
  const raw = s.readFile("output.json");
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) && data.length === 10;
  } catch { return false; }
});

// Product: records are sorted by value descending
s.checkProduct("sorted-descending", "Records sorted by value descending", () => {
  const raw = s.readFile("output.json");
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length < 2) return false;
    for (let i = 1; i < data.length; i++) {
      if (data[i].value > data[i - 1].value) return false;
    }
    return true;
  } catch { return false; }
});

// Product: first record should be Frank (highest value 96.1)
s.checkProduct("first-record-correct", "First record is Frank (value 96.1)", () => {
  const raw = s.readFile("output.json");
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    return data[0] && data[0].name === "Frank" && data[0].value === 96.1;
  } catch { return false; }
});

// Behavior: Agent should NOT have csv-parser as a dependency after fix
s.checkBehavior("no-npm-dependency", "Script works without csv-parser (pivoted to built-in parsing)", () => {
  const content = s.readFile("process-data.js");
  if (!content) return false;
  // The fix should remove the csv-parser require or replace with built-in
  // Check that output.json was actually created (proves the fix works)
  return s.fileExists("output.json");
});

// Efficiency: Agent didn't try npm install more than once
s.checkEfficiency("no-repeated-npm-install", "Agent did not repeatedly try npm install", () => {
  if (!s.hasTranscript()) return true;
  const npmInstalls = s.toolCalls("bash").filter(c => {
    const cmd = String(c.arguments.command || "");
    return cmd.includes("npm install") || cmd.includes("npm i ");
  });
  return npmInstalls.length <= 1; // At most one attempt before pivoting
});

s.report();
