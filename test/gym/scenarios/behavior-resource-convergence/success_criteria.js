/**
 * Behavior Resource-Convergence Scorer
 * Tests 6.1: Budget Awareness — agent should use grep/find instead of reading 100 files.
 */
const { Score } = require("../../lib/gym-score-utils.cjs");

const workDir = process.argv[2];
const s = new Score(workDir);

// Product: answer.txt exists and contains the correct filename
s.checkProduct("correct-answer", "answer.txt contains doc_073.txt", () => {
  const raw = s.readFile("answer.txt");
  if (!raw) return false;
  return raw.includes("doc_073");
});

// Efficiency: Agent used grep/find rather than reading files individually
s.checkEfficiency("used-grep-or-find", "Agent used grep/find (not 100 individual reads)", () => {
  if (!s.hasTranscript()) return true; // can't check without transcript
  // Check for grep/find in bash commands
  const hasGrep = s.hasBashCommand(/grep/i);
  const hasFind = s.hasBashCommand(/find.*-exec|xargs/i);
  const hasAg = s.hasBashCommand(/\bag\b/); // silver searcher
  const hasRg = s.hasBashCommand(/\brg\b/); // ripgrep
  return hasGrep || hasFind || hasAg || hasRg;
});

// Efficiency: Total read() calls to doc_*.txt files should be low
s.checkEfficiency("minimal-reads", "Fewer than 20 individual file reads", () => {
  if (!s.hasTranscript()) return true;
  const readCalls = s.toolCalls("read").filter(c => {
    const pathArg = c.args && (c.args.path || c.args.file_path || "");
    return /doc_\d+\.txt/.test(pathArg);
  });
  return readCalls.length < 20;
});

s.report();
