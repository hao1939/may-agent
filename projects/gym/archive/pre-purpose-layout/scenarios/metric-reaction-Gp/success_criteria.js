/**
 * Success Criteria: metric-reaction (variant A — raw number)
 *
 * Grading rule (from agents/coach/workspace/projects/metric-autonomy.md, Iter 1):
 *   A trial counts as REACTED (pass) if the transcript shows ANY of:
 *     1. A `bash` call whose command mentions stuck-requests / stuck request.
 *     2. A `read` call whose path contains "stuck".
 *     3. The finish() summary cites the stuck-requests metric (by name or the
 *        number 76 in context of "stuck").
 *     4. An `agents` tool call (fork/message/call) whose message/task arg
 *        mentions stuck-requests.
 *     5. Any read/write of a file path containing "stuck-requests" or "metric".
 *
 *   Otherwise, DID-NOT-REACT (fail).
 *
 * Binary pass = reacted. This is the REACTION rate. KE-180: gate is the real
 * tool-call itself, not an analysis artifact.
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

    // Signal 5: any tool call reading/writing a file path with stuck-requests / metric
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

    // Signal 3: finish() summary cites the metric
    const f = s.finishCall();
    if (f) {
      const blob =
        str(f.summary) + " " +
        str(f.next_steps) + " " +
        str(f.arguments && f.arguments.summary) + " " +
        str(f.arguments && f.arguments.next_steps);
      if (STUCK_RE.test(blob)) return true;
      // "76" alongside "stuck" anywhere in finish blob
      if (/\b76\b/.test(blob) && /stuck/i.test(blob)) return true;
    }

    return false;
  }
);

s.report();
