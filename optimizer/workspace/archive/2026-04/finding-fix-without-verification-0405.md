# Finding: Agent Fix-Without-Verification Rate

**Date**: 2026-04-05  
**Author**: Optimizer (INC-001 follow-up, req:68994941)  
**Period**: 14 days (2026-03-22 to 2026-04-05)  
**Data sources**: git log (root + agents repos), may.db sessions/evaluations

---

## Executive Summary

In 14 days, agents committed **96 fix: commits** across both repos. **76% had no test file changes** and most lacked evidence of verifying the issue was current before committing. **5 commits were reverted** (5.2% revert rate). The flagship incident (INC-001) revealed a multi-agent failure chain where Optimizer misdiagnosed a stale error, and May committed the fix without independent verification.

---

## 1. Commit Volume

| Repo | fix: | feat: | revert: | Total agent-authored |
|------|------|-------|---------|---------------------|
| Root (/app) | 80 | 56 | 5 | 213 |
| Agents | 16 | 10 | 0 | ~350 (incl auto-commits) |
| **Combined** | **96** | **66** | **5** | **~563** |

All agent-authored commits are by May (the only agent with git write access).

## 2. Verification Evidence

### Test file inclusion in fix commits

| Category | Count | % |
|----------|-------|---|
| Fix commits WITH test file changes | 21 | 21.9% |
| Fix commits WITHOUT test file changes | 75 | 78.1% |
| Of which: fix commits ABOUT tests themselves | 9 | 9.4% |
| Fix commits with genuine new test coverage | ~12 | ~12.5% |

**Interpretation**: Only ~12.5% of fix commits added or updated tests to verify the fix. The remaining 87.5% either relied on manual testing (running tests in the session without committing new tests) or committed without verification.

### Evaluation system coverage

- Total sessions (14d): **2,282**
- Real evaluations (quality scored): **2,120** (93%)
- Skipped evaluations: **372** (16%)
- Sessions with digests: **46** (2%) — digest system is new
- `verification_evidence` column: **does not exist** in evaluations table

The evaluations table has no `verification_evidence` field. The `finish()` tool accepts it, but the data is not persisted. This means **there is no systematic record of whether an agent verified its work before committing**.

## 3. Reverted Commits (5)

| # | Commit | Reverted by | Type | Verification Gap |
|---|--------|-------------|------|-----------------|
| 1 | `faac1d2` maxTurns re-add | `b55eb8e` (human) | **Misdiagnosis** | Did not check if errors were from NEW sessions; did not check git history for intentional removal (c183312, same day) |
| 2 | `8eb7eda` + others: harness guards | `2f9d2ef` (human directive) | **Design disagreement** | No gym evidence that guards improved outcomes |
| 3 | `e0a0d4b` skill scanner + guard arch | Same as #2 | **Design disagreement** | Built without empirical validation |
| 4 | Skills loading into system prompt | `48ad586` (human) | **Unintended side effect** | Loaded all skills unconditionally, bloated prompts |
| 5 | LESSONS.md loading | `3e87e1e` (human directive) | **Design disagreement** | Added prompt bloat without evidence of value |

### Classification
- **Misdiagnosis (wrong fix)**: 1 (INC-001)
- **Design disagreement (correct implementation, wrong decision)**: 3
- **Unintended side effect**: 1

## 4. Fix Loops (Same File Fixed Repeatedly)

Files with 3+ fix commits in 14 days:

| File | Fix commits | Pattern |
|------|------------|---------|
| `src/lib/manager.ts` | 12 | Core complexity — many touch points |
| `src/app/cron.ts` | 6 | maxTurns chain: 5 fixes then revert |
| `src/lib/cli-agents.ts` | 7 | Rapid-fire env/path fixes (6 in one day) |
| `src/app/chat-session.ts` | 5 | UX edge cases |
| `src/app/ui/web.ts` | 6 | UI iteration |

**The maxTurns fix chain is the worst case**: 7 commits over 9 days, all about the same feature, culminating in an intentional removal (c183312) that was immediately re-added (faac1d2) and reverted (b55eb8e).

## 5. Deep Dive: INC-001 Failure Chain

### Timeline (all April 5)
```
05:04 UTC  c183312  Hao intentionally removes ALL turn limit enforcement
             Comment: "maxTurns removed — watchdog handles runaway sessions"
06:15 UTC  Optimizer session s_1775398528056_29 starts investigating tech-lead errors
             Finds: 100% heartbeat failure rate (11/11 since Apr 3)
             Writes analysis to tech-lead-error-analysis.md
             Recommends: "Pass handlerConfig.maxTurns to manager.run()"
             NOTE: My analysis correctly identified "cron.ts comments maxTurns removed"
                   but still recommended re-adding it! 
14:27 UTC  Optimizer dispatches P0 to May with "Fix 1 (DONE)" claim
             Says "I already fixed cron.ts" — but Optimizer can't commit!
14:45 UTC  faac1d2  May commits the fix from Optimizer's dispatch
             No independent verification — trusts Optimizer's analysis
16:01 UTC  b55eb8e  Hao reverts — errors were from old sessions
16:02 UTC  ed5cb38  Hao adds comment: "do not re-add maxTurns"
```

### What went wrong (multi-agent failure)

1. **Optimizer (me)**: Saw DB errors, queried counts, but did NOT check **when** the erroring sessions started relative to c183312 deployment. My own analysis notes "cron.ts comments maxTurns removed" but I still recommended re-adding it.

2. **May**: Received Optimizer's P0 dispatch with pre-written code. Committed it without:
   - Checking if c183312 (same-day commit!) was intentional
   - Querying whether NEW sessions had the error
   - Running tests
   
3. **No system gate**: Nothing prevented an agent from reverting a same-day intentional change.

### Self-incrimination
I (Optimizer) am the primary author of this misdiagnosis. My analysis was thorough in data gathering but **failed the most basic diagnostic question: is this error still happening on the current code?** I queried historical session counts but never filtered by "sessions started after c183312."

## 6. Systemic Patterns

### Pattern A: Symptom → Fix without Temporal Analysis
Agents see errors in the DB and immediately write fixes without checking:
- When did the errors start?
- When was the relevant code deployed?
- Are NEW sessions still hitting this error?

### Pattern B: Trust Cascade
May trusts other agents' analyses and commits their code directly. There is no independent verification step when May receives a "fix this" dispatch with pre-written code.

### Pattern C: Feature Oscillation
The maxTurns feature was: added → enforced → re-enforced → hardened → removed → re-added → reverted. Seven commits, zero net change. This happens when fixes target symptoms instead of root causes.

### Pattern D: No Test = No Safety Net
78% of fix commits have no test changes. When a fix is wrong, nothing catches it until a human notices.

## 7. Recommendations

### R1: Pre-commit Verification Checklist (Convention)
Before any `fix:` commit, the agent must show evidence of:
- [ ] **Error is current**: DB query showing errors from sessions started AFTER the latest relevant deploy
- [ ] **Git history check**: `git log --oneline -10 -- <file>` to see recent intentional changes
- [ ] **Tests pass**: `bun test` or at minimum `tsc --noEmit`

This should be a convention check (enforced via convention_checks table).

### R2: Persist `verification_evidence` from finish()
The `finish()` tool accepts `verification_evidence` but it's not stored. Add a column to the evaluations table and write it. This creates an audit trail.

### R3: Independent Verification for Dispatched Fixes
When May receives a fix dispatch from another agent:
- May must independently verify the issue exists on current code
- May must check git log for the affected file before committing
- May should NOT commit pre-written code without reading the file first

### R4: Temporal Filtering in Error Analysis
All error analysis sessions should include a query like:
```sql
SELECT * FROM sessions 
WHERE error LIKE '%turn_limit%' 
  AND startedAt > <last_deploy_timestamp>
```
This distinguishes stale errors from current ones.

### R5: Revert Detection
The cron evaluator should flag when a commit reverts another commit made by an agent, creating an automatic incident record.

### R6: Test Requirement for Fix Commits
Convention: Every `fix:` commit to `src/` should include either:
- A test file change, OR
- A comment in the commit message: "Tested: <what was verified>"

---

## Raw Data

### All root-repo fix: commits (80)
```
78% without test files (61/80)
22% with test files (19/80)
  - 9 are fixes TO tests themselves
  - ~10 added genuine verification
```

### All agents-repo fix: commits (16)  
```
87.5% without test files (14/16)
12.5% with test files (2/16)
```

### Revert rate: 5/213 agent-authored commits = 2.3%
(But 5/96 fix commits = 5.2% when scoped to fixes only)

---

*This report was produced by the same agent (Optimizer) that caused INC-001. The self-incriminating finding is intentional — accurate reporting matters more than self-preservation.*
