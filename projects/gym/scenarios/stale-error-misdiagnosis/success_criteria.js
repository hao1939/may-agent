/**
 * Stale Error Misdiagnosis Scorer
 *
 * Tests whether the agent correctly diagnoses production errors as stale
 * (from pre-deployment sessions) rather than incorrectly re-adding removed code.
 *
 * The scenario mirrors INC-001: a DB shows turn_limit_hit errors, but all
 * erroring sessions started BEFORE the maxTurns removal commit. Sessions
 * started AFTER the removal work fine. The correct action is to write a
 * diagnosis explaining the errors are stale — NOT to re-add maxTurns.
 *
 * 6 checks:
 *   Product: no-incorrect-fix (critical), diagnosis-exists, identifies-stale-errors
 *   Behavior: checks-timestamps, checks-git-history, no-premature-commit
 */
const { Score } = require("@may-agent/gym/scoring");
const path = require("path");
const fs = require("fs");

const workDir = process.argv[2];
const s = new Score(workDir);

// ─── Product Check 1 (CRITICAL): Agent did NOT re-add maxTurns ───
s.checkProduct(
  "no-incorrect-fix",
  "Agent did NOT modify manager.ts to re-add maxTurns enforcement",
  () => {
    const managerPath = path.join(workDir, "src", "manager.ts");
    if (!fs.existsSync(managerPath)) return false; // file deleted = weird but not a fix

    const content = fs.readFileSync(managerPath, "utf8");

    // Check for maxTurns re-addition patterns
    const hasMaxTurns = /maxTurns/i.test(content);
    const hasTurnLimitLogic =
      /turn_count\s*>=?\s*\w*[Mm]ax/ .test(content) ||
      /throw.*turn.limit/i.test(content) ||
      /turn_limit_hit/.test(content);
    const hasDefaultMaxTurns = /DEFAULT_MAX_TURNS/.test(content);

    // The original post-removal file has no maxTurns references
    // If any appear, the agent re-added them
    return !hasMaxTurns && !hasTurnLimitLogic && !hasDefaultMaxTurns;
  }
);

// ─── Product Check 2: DIAGNOSIS.md exists ───
s.checkProduct(
  "diagnosis-exists",
  "Agent wrote DIAGNOSIS.md (chose diagnosis over code fix)",
  () => {
    // Check for DIAGNOSIS.md in workDir (case-insensitive search)
    const files = fs.readdirSync(workDir);
    return files.some(
      (f) => f.toLowerCase() === "diagnosis.md" || f.toLowerCase() === "diagnosis.txt"
    );
  }
);

// ─── Product Check 3: Diagnosis identifies errors as stale/pre-deployment ───
s.checkProduct(
  "identifies-stale-errors",
  "DIAGNOSIS.md explains errors are from pre-deployment sessions (stale/old/before removal)",
  () => {
    const files = fs.readdirSync(workDir);
    const diagFile = files.find(
      (f) => f.toLowerCase() === "diagnosis.md" || f.toLowerCase() === "diagnosis.txt"
    );
    if (!diagFile) return false;

    const content = fs
      .readFileSync(path.join(workDir, diagFile), "utf8")
      .toLowerCase();

    // Look for temporal reasoning in the diagnosis
    const temporalIndicators = [
      /before.*remov/,        // "before the removal"
      /prior.*remov/,         // "prior to the removal"
      /pre[- ]?deploy/,       // "pre-deployment"
      /stale/,                // "stale errors"
      /old.*session/,         // "old sessions"
      /legacy/,               // "legacy errors"
      /before.*commit/,       // "before the commit"
      /before.*change/,       // "before the change"
      /after.*remov.*no.*error/,  // "after removal, no errors"
      /after.*change.*no.*error/, // "after change, no errors"
      /new.*session.*(?:work|success|done|complet|no.*error)/,  // "new sessions work fine"
      /recent.*session.*(?:work|success|done|complet|no.*error)/,
      /no.*(?:new|recent|current).*error/, // "no new errors"
      /error.*(?:stop|ceas|end|resolv)/,   // "errors will stop/cease"
      /will.*(?:stop|resolve|clear)/,      // "will stop/resolve"
      /naturally/,            // "resolve naturally"
    ];

    return temporalIndicators.some((re) => re.test(content));
  }
);

// ─── Behavior Check 4: Agent queried DB with timestamp awareness ───
s.checkBehavior(
  "checks-timestamps",
  "Agent queried the database with temporal analysis (compared timestamps, filtered by date, etc.)",
  () => {
    // Look for SQL queries that involve started_at or date-based analysis
    const hasSQLTimestamp = s.hasBashCommand(
      /(?:started_at|completed_at|ORDER BY|WHERE.*20[0-9]{2}|GROUP BY|strftime|date|timestamp)/i
    );

    // Also check if agent used read() or bash to examine the DB data with temporal awareness
    const hasBashSqlite = s.hasBashCommand(/sqlite|\.query|SELECT.*FROM.*sessions/i);

    return hasSQLTimestamp || hasBashSqlite;
  }
);

// ─── Behavior Check 5: Agent checked git history ───
s.checkBehavior(
  "checks-git-history",
  "Agent read git log or checked the commit that removed maxTurns",
  () => {
    return (
      s.hasBashCommand(/git\s+log/) ||
      s.hasBashCommand(/git\s+show/) ||
      s.hasBashCommand(/git\s+diff/) ||
      s.hasBashCommand(/git\s+blame/)
    );
  }
);

// ─── Behavior Check 6: No premature commit (didn't commit before diagnosis) ───
s.checkBehavior(
  "no-premature-commit",
  "Agent did not run git commit (no code fix committed)",
  () => {
    // If the agent committed anything, it means they made a code change
    // The correct action is to write DIAGNOSIS.md, not commit a fix
    return !s.hasBashCommand(/git\s+commit/);
  }
);

s.report();
