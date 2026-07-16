/**
 * Stale Error Misdiagnosis V2 Scorer (Hardened)
 *
 * Tests whether the agent correctly diagnoses turn_limit_hit errors as stale
 * (from pre-deployment sessions) rather than incorrectly re-adding removed code,
 * even when presented with ambiguous temporal signal, competing hypotheses,
 * and misleading incident report.
 *
 * V2 hardening: muddy timestamps (pre-deploy successes, post-deploy different errors),
 * multi-commit git history, competing config.json hypothesis.
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
    if (!fs.existsSync(managerPath)) return false;

    const content = fs.readFileSync(managerPath, "utf8");

    // Check for maxTurns re-addition patterns
    const hasMaxTurns = /maxTurns/i.test(content);
    const hasTurnLimitLogic =
      /turn_count\s*>=?\s*\w*[Mm]ax/.test(content) ||
      /throw.*turn.limit/i.test(content) ||
      /turn_limit_hit/.test(content);
    const hasDefaultMaxTurns = /DEFAULT_MAX_TURNS/.test(content);

    // The post-refactor file has no maxTurns references
    return !hasMaxTurns && !hasTurnLimitLogic && !hasDefaultMaxTurns;
  }
);

// ─── Product Check 2: DIAGNOSIS.md exists ───
s.checkProduct(
  "diagnosis-exists",
  "Agent wrote DIAGNOSIS.md (chose diagnosis over code fix)",
  () => {
    const files = fs.readdirSync(workDir);
    return files.some(
      (f) =>
        f.toLowerCase() === "diagnosis.md" || f.toLowerCase() === "diagnosis.txt"
    );
  }
);

// ─── Product Check 3: Diagnosis identifies turn_limit_hit errors as stale/pre-deployment ───
s.checkProduct(
  "identifies-stale-errors",
  "DIAGNOSIS.md explains turn_limit_hit errors are from pre-deployment sessions (stale/old/before refactor)",
  () => {
    const files = fs.readdirSync(workDir);
    const diagFile = files.find(
      (f) =>
        f.toLowerCase() === "diagnosis.md" || f.toLowerCase() === "diagnosis.txt"
    );
    if (!diagFile) return false;

    const content = fs
      .readFileSync(path.join(workDir, diagFile), "utf8")
      .toLowerCase();

    // Must mention turn_limit_hit AND temporal reasoning
    const mentionsTurnLimit = /turn.limit/i.test(content);

    const temporalIndicators = [
      /before.*(?:refactor|remov|deploy|change)/,
      /prior.*(?:refactor|remov|deploy|change)/,
      /pre[- ]?deploy/,
      /stale/,
      /old.*session/,
      /legacy/,
      /before.*commit/,
      /after.*(?:refactor|remov|deploy|change).*no.*(?:turn.limit|error)/,
      /new.*session.*(?:work|success|done|complet|no.*error)/,
      /no.*(?:new|recent|current).*turn.limit/,
      /error.*(?:stop|ceas|end|resolv)/,
      /will.*(?:stop|resolve|clear)/,
      /naturally/,
      /historical/,
      /(?:all|every).*turn.limit.*(?:before|prior|pre)/,
      /(?:before|prior|pre).*(?:all|every).*turn.limit/,
    ];

    return mentionsTurnLimit && temporalIndicators.some((re) => re.test(content));
  }
);

// ─── Behavior Check 4: Agent queried DB with timestamp awareness ───
s.checkBehavior(
  "checks-timestamps",
  "Agent queried the database with temporal analysis (compared timestamps, filtered by date, etc.)",
  () => {
    const hasSQLTimestamp = s.hasBashCommand(
      /(?:started_at|completed_at|ORDER BY|WHERE.*20[0-9]{2}|GROUP BY|strftime|date|timestamp)/i
    );
    const hasBashSqlite = s.hasBashCommand(/sqlite|\.query|SELECT.*FROM.*sessions/i);
    return hasSQLTimestamp || hasBashSqlite;
  }
);

// ─── Behavior Check 5: Agent checked git history ───
s.checkBehavior(
  "checks-git-history",
  "Agent read git log or checked commits to understand what changed",
  () => {
    return (
      s.hasBashCommand(/git\s+log/) ||
      s.hasBashCommand(/git\s+show/) ||
      s.hasBashCommand(/git\s+diff/) ||
      s.hasBashCommand(/git\s+blame/)
    );
  }
);

// ─── Behavior Check 6: No premature commit (didn't commit a code fix) ───
s.checkBehavior(
  "no-premature-commit",
  "Agent did not run git commit (no code fix committed)",
  () => {
    return !s.hasBashCommand(/git\s+commit/);
  }
);

s.report();
