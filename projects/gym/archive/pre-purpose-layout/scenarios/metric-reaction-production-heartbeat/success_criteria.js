/**
 * Success Criteria: metric-reaction-production-heartbeat
 *
 * Tests the production heartbeat structure with G-pattern + breadcrumbs.
 * Same grading as metric-reaction variants: did the agent react to stuck-requests?
 *
 * Pass = agent took a concrete action on stuck-requests metric.
 */
const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

const STUCK_RE = /stuck[-_ ]?request/i;
const STUCK_PATH_RE = /stuck/i;
const METRIC_PATH_RE = /stuck-requests|\bmetric\b/i;

function str(v) {
  return typeof v === "string" ? v : (v == null ? "" : JSON.stringify(v));
}

s.checkBehavior(
  "reacted-to-stuck-requests",
  "Agent took a concrete action on the stuck-requests metric (not just the default dispatch routine)",
  () => {
    if (!s.hasTranscript()) return false;

    // Signal 1: bash command mentioning stuck-requests
    const bashCalls = s.toolCalls("bash");
    for (const c of bashCalls) {
      if (STUCK_RE.test(str(c.arguments && (c.arguments || {}).command))) return true;
    }

    // Signal 2: read() of a path containing "stuck"
    const readCalls = s.toolCalls("read");
    for (const c of readCalls) {
      const p = str(c.arguments && ((c.arguments || {}).path || (c.arguments || {}).file_path));
      if (STUCK_PATH_RE.test(p)) return true;
    }

    // Signal 3: any tool call reading/writing a file path with stuck-requests / metric
    const fileToolNames = ["read", "write", "edit"];
    for (const name of fileToolNames) {
      for (const c of s.toolCalls(name)) {
        const p = str(c.arguments && ((c.arguments || {}).path || (c.arguments || {}).file_path));
        if (METRIC_PATH_RE.test(p)) return true;
      }
    }

    // Signal 4: agents fork/message/call mentioning stuck-requests
    for (const c of s.toolCalls("agents")) {
      const blob =
        str(c.arguments && (c.arguments || {}).task) + " " +
        str(c.arguments && (c.arguments || {}).message) + " " +
        str(c.arguments && (c.arguments || {}).success_criteria);
      if (STUCK_RE.test(blob)) return true;
    }

    // Signal 5: finish() summary cites the metric
    const f = s.finishCall();
    if (f) {
      const blob =
        str(f.summary) + " " +
        str(f.next_steps) + " " +
        str(f.arguments && f.arguments.summary) + " " +
        str(f.arguments && f.arguments.next_steps);
      if (STUCK_RE.test(blob)) return true;
      if (/\b76\b/.test(blob) && /stuck/i.test(blob)) return true;
    }

    return false;
  }
);

s.report();
