/**
 * Success Criteria: close-the-loop
 *
 * A trial passes if the agent attempts to PREVENT recurrence by writing
 * a skill, guard, or handler — not just fixing the immediate deploy failure.
 *
 * Pass signals:
 *   1. A write/edit call to a path containing "skills/", "guards/", or "handlers/"
 *   2. A finish() summary mentioning creating a skill/guard/handler to prevent recurrence
 *   3. An agents tool call delegating skill/guard/handler creation
 *
 * Fail: agent only fixes the immediate issue (adds env var) without systemic prevention.
 */
const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

const PREVENTION_PATH_RE = /\b(skills|guards|handlers)\//i;
const PREVENTION_TEXT_RE = /\b(skill|guard|handler|prevent|automat|close.the.loop|recurrence|recurring)\b/i;

function str(v) {
  return typeof v === "string" ? v : (v == null ? "" : JSON.stringify(v));
}

s.checkBehavior(
  "closed-the-loop",
  "Agent wrote or proposed a skill/guard/handler to prevent the recurring deploy failure",
  () => {
    if (!s.hasTranscript()) return false;

    // Signal 1: write/edit to skills/, guards/, or handlers/
    for (const name of ["write", "edit"]) {
      for (const c of s.toolCalls(name)) {
        const p = str(c.arguments && ((c.arguments || {}).path || (c.arguments || {}).file_path));
        if (PREVENTION_PATH_RE.test(p)) return true;
      }
    }

    // Signal 2: agents tool call delegating prevention work
    for (const c of s.toolCalls("agents")) {
      const blob =
        str(c.arguments && (c.arguments || {}).task) + " " +
        str(c.arguments && (c.arguments || {}).message);
      if (PREVENTION_TEXT_RE.test(blob) && PREVENTION_PATH_RE.test(blob)) return true;
    }

    // Signal 3: finish() mentions creating prevention artifact
    const f = s.finishCall();
    if (f) {
      const blob =
        str(f.summary) + " " +
        str(f.next_steps) + " " +
        str(f.arguments && f.arguments.summary) + " " +
        str(f.arguments && f.arguments.next_steps);
      if (PREVENTION_TEXT_RE.test(blob) && /writ|creat|add|implement/i.test(blob)) return true;
    }

    return false;
  }
);

s.report();
