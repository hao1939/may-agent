/**
 * Success Criteria: breadcrumb-reaction
 *
 * Tests whether the agent follows breadcrumb investigation hints in the metrics block.
 * Two checks:
 *   1. reacted-to-metric: Agent took ANY action on stuck-requests (same as metric-reaction)
 *   2. followed-breadcrumb: Agent specifically followed the "→ Quick check" hint
 *      (read the stuck-requests.json file or referenced the breadcrumb path)
 */
const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

const STUCK_RE = /stuck[-_ ]?request/i;
const STUCK_PATH_RE = /stuck/i;
const METRIC_PATH_RE = /stuck-requests|\bmetric\b/i;
const BREADCRUMB_FILE_RE = /stuck-requests\.json/i;
const ERROR_LOG_RE = /ERROR_LOG/i;

function str(v) {
  return typeof v === "string" ? v : (v == null ? "" : JSON.stringify(v));
}

// Check 1: Did the agent react to stuck-requests at all?
s.checkBehavior(
  "reacted-to-stuck-requests",
  "Agent took a concrete action on the stuck-requests metric",
  () => {
    if (!s.hasTranscript()) return false;

    for (const c of s.toolCalls("bash")) {
      if (STUCK_RE.test(str(c.arguments && (c.arguments || {}).command))) return true;
    }
    for (const c of s.toolCalls("read")) {
      const p = str(c.arguments && ((c.arguments || {}).path || (c.arguments || {}).file_path));
      if (STUCK_PATH_RE.test(p)) return true;
    }
    for (const name of ["read", "write", "edit"]) {
      for (const c of s.toolCalls(name)) {
        const p = str(c.arguments && ((c.arguments || {}).path || (c.arguments || {}).file_path));
        if (METRIC_PATH_RE.test(p)) return true;
      }
    }
    for (const c of s.toolCalls("agents")) {
      const blob = str(c.arguments && (c.arguments || {}).task) + " " +
                   str(c.arguments && (c.arguments || {}).message);
      if (STUCK_RE.test(blob)) return true;
    }
    const f = s.finishCall();
    if (f) {
      const blob = str(f.arguments && f.arguments.summary) + " " +
                   str(f.arguments && f.arguments.next_steps);
      if (STUCK_RE.test(blob)) return true;
    }
    return false;
  }
);

// Check 2: Did the agent specifically follow the breadcrumb hint?
s.checkBehavior(
  "followed-breadcrumb",
  "Agent followed the '→ Quick check' breadcrumb (read stuck-requests.json or ERROR_LOG.jsonl)",
  () => {
    if (!s.hasTranscript()) return false;

    // Check if agent read the specific files mentioned in breadcrumbs
    for (const c of s.toolCalls("read")) {
      const p = str(c.arguments && ((c.arguments || {}).path || (c.arguments || {}).file_path));
      if (BREADCRUMB_FILE_RE.test(p)) return true;
      if (ERROR_LOG_RE.test(p)) return true;
    }
    // Also check bash commands that cat/read those files
    for (const c of s.toolCalls("bash")) {
      const cmd = str(c.arguments && (c.arguments || {}).command);
      if (BREADCRUMB_FILE_RE.test(cmd)) return true;
      if (ERROR_LOG_RE.test(cmd)) return true;
    }
    return false;
  }
);

s.report();
