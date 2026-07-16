/**
 * Success Criteria: metric-reaction
 *
 * Tests the reading-metrics skill: agent receives a metric alert,
 * queries the data, diagnoses the cause, and acts/escalates with context.
 *
 * Pass requires ALL of:
 *   1. Agent queried the database (ran a bash command with SQL or read the DB)
 *   2. Agent identified the root cause (mentions ENOENT, cache, amy, or shared-cache)
 *   3. Agent acted or escalated with context (finish summary includes metric + diagnosis)
 */
const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

function str(v) {
  return typeof v === "string" ? v : (v == null ? "" : JSON.stringify(v));
}

// Check 1: Agent queried the database
s.checkBehavior(
  "queried-metric-data",
  "Agent ran a query against .state/may.db or read session data to investigate the alert",
  () => {
    if (!s.hasTranscript()) return false;
    for (const c of s.toolCalls("bash")) {
      const cmd = str(c.arguments && ((c.arguments || {}).command || (c.arguments || {}).cmd));
      if (/may\.db|sessions|SELECT.*FROM/i.test(cmd)) return true;
    }
    for (const c of s.toolCalls("read")) {
      const p = str(c.arguments && ((c.arguments || {}).path || (c.arguments || {}).file_path));
      if (/baseline-report|reading-metrics/i.test(p)) return true;
    }
    return false;
  }
);

// Check 2: Agent identified root cause
s.checkBehavior(
  "diagnosed-root-cause",
  "Agent identified the root cause (ENOENT / shared-cache / amy failures)",
  () => {
    if (!s.hasTranscript()) return false;
    const transcript = s.rawTranscript();
    // Look for diagnosis keywords in assistant messages or finish call
    const ROOT_CAUSE_RE = /ENOENT|shared.cache|embeddings\.bin|amy.*fail|unmounted|volume/i;
    if (ROOT_CAUSE_RE.test(transcript)) return true;
    return false;
  }
);

// Check 3: Agent escalated or acted with proper context
s.checkBehavior(
  "acted-with-context",
  "Agent escalated or acted, citing: metric name + current value + diagnosis",
  () => {
    if (!s.hasTranscript()) return false;
    const transcript = s.rawTranscript();
    // Must mention the metric AND a value AND a cause
    const hasMetric = /session.success.rate|success.rate|0\.52/i.test(transcript);
    const hasDiagnosis = /ENOENT|cache|amy|unmount/i.test(transcript);
    const hasAction = /escalat|fix|notify|restart|mount|remount|alert/i.test(transcript);
    return hasMetric && hasDiagnosis && hasAction;
  }
);

s.report();
