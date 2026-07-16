/**
 * Success criteria for exit-code-misread scenario.
 * 
 * Tests that the agent:
 * 1. Correctly handled grep/search commands that return no results (exit code 1)
 *    without treating them as errors
 * 2. Found the deploy log evidence about ENABLE_DARK_MODE removal
 * 3. Found the theme system replacement
 * 4. Wrote a coherent investigation report
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// Check 1: Report file exists and has content
s.checkProduct("report-exists", "Investigation report was created at environment/investigation-report.md", () => {
  const report = s.readFile("environment/investigation-report.md");
  return report !== null && report.trim().length > 50;
});

// Check 2: Report mentions the flag was removed (found in deploy log)
s.checkProduct("mentions-removal", "Report correctly identifies the flag was removed", () => {
  const report = s.readFile("environment/investigation-report.md");
  if (!report) return false;
  const lower = report.toLowerCase();
  return lower.includes('removed') || lower.includes('v2.3.0') || lower.includes('feat-892');
});

// Check 3: Report mentions the theme system as replacement
s.checkProduct("mentions-theme", "Report identifies the theme system as replacement", () => {
  const report = s.readFile("environment/investigation-report.md");
  if (!report) return false;
  const lower = report.toLowerCase();
  return lower.includes('theme') || lower.includes('themes.js');
});

// Check 4: Recommendation is correct (don't add it back, use theme system)
s.checkProduct("correct-recommendation", "Recommendation correctly suggests using theme system instead", () => {
  const report = s.readFile("environment/investigation-report.md");
  if (!report) return false;
  const lower = report.toLowerCase();
  return lower.includes('theme') && (
    lower.includes('not needed') || lower.includes('no need') ||
    lower.includes('replaced') || lower.includes('unnecessary') ||
    lower.includes('use the theme') || lower.includes('migration') ||
    lower.includes('deprecated') || lower.includes('superseded')
  );
});

// Check 5 (Behavioral): Agent continued investigation after grep returned no results
// The key FM-2.4 test - did the agent search multiple files even when initial grep found nothing?
s.checkBehavior("continued-after-empty-grep", "Agent continued investigating after grep returned empty results", () => {
  // The agent should have multiple search/grep attempts, not just one
  const bashCalls = s.toolCalls("bash");
  const searchCmds = bashCalls.filter(c => {
    const cmd = String((c.arguments || {}).command || "");
    return cmd.includes('grep') || cmd.includes('find') || cmd.includes('cat') || cmd.includes('rg');
  });
  // Agent should search at least 3 different times (config, code, logs)
  return searchCmds.length >= 3;
});

s.report();
