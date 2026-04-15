# Finding: Quality Driver Scouting — Zero-Error Streak & Quality Patterns (Apr 15)

**Date**: 2026-04-15 20:31 UTC  
**Scope**: Last 24h system-wide quality analysis  
**Method**: DB queries across sessions + evaluations tables, skill file audit, coach workspace review

---

## 1. The "Zero-Error Streak" — What It Actually Means

### Raw Numbers (last 24h)
| Window   | Sessions | Errors | Error Rate | High-Op (50+) |
|----------|----------|--------|------------|---------------|
| 0-6h     | 214      | 16     | 7.5%       | 10            |
| 6-12h    | 220      | 23     | 10.5%      | 3             |
| 12-18h   | 91       | 11     | 12.1%      | 0             |

### Key Finding: Zero *logic* errors — all 50 errors are "Request was aborted"
Every single error in the last 24h is a timeout/cancellation (`Request was aborted`), not a code error, schema mismatch, or runtime crash. **Zero non-abort errors across 525 sessions.**

This IS statistically notable. In prior periods, we saw:
- `bun: command not found` (PATH issues)
- `SQLiteError: no such column` (schema mismatches)
- Various runtime crashes

These have completely vanished. The likely drivers:
1. **PATH fix propagation** — `.state/.bun/bin/bun` is now in persistent context for all agents
2. **Schema knowledge stabilization** — agents know `sessionId` not `id`, know to use `bun:sqlite` not `node:sqlite`
3. **Guard system maturity** — guards catch issues before they become errors

### Is the streak "real quality" or measurement artifact?
**Partially measurement artifact.** See Section 2.

---

## 2. The Two-Tier Evaluation Problem (Critical Finding)

### Heuristic vs JS Evaluation Quality Scores (last 12h)
| Eval Type    | Count | Avg Quality |
|-------------|-------|-------------|
| Heuristic   | 230   | **0.997**   |
| JS (deep)   | 93    | **0.706**   |

**The heuristic evaluator gives near-perfect scores; the JS evaluator is 29pp more critical.**

This means 71% of sessions are evaluated by a lenient heuristic that almost always says "good" (quality=1.0). Only 29% get rigorous JS evaluation that actually examines transcript evidence.

### Per-Agent Breakdown
| Agent     | Total | Heuristic | JS  | Heur Q | JS Q  | Gap   |
|-----------|-------|-----------|-----|--------|-------|-------|
| qa        | 23    | 23        | 0   | 1.00   | N/A   | —     |
| may       | 32    | 32        | 0   | 0.99   | N/A   | —     |
| scout     | 27    | 26        | 1   | 1.00   | 0.86  | —     |
| coach     | 46    | 38        | 8   | 1.00   | 0.52  | -48pp |
| bob       | 58    | 33        | 25  | 1.00   | 0.67  | -33pp |
| tech-lead | 72    | 53        | 19  | 0.99   | 0.79  | -20pp |
| optimizer | 47    | 25        | 22  | 1.00   | 0.78  | -22pp |
| coder     | 18    | 0         | 18  | N/A    | 0.65  | —     |

**Implication**: QA/may/scout look perfect because they're only heuristic-evaluated. Coach and bob have the biggest quality gaps when actually examined. Coder is 100% JS-evaluated and shows the real quality baseline (0.65).

### Actionable Insight
Any claim about "system-wide quality improvement" must control for evaluation method. The real quality signal is JS evaluations only, and there the picture is mixed: tech-lead 0.79 (solid), optimizer 0.78 (decent), bob 0.67 (struggling), coach 0.52 (poor on work sessions), coder 0.65 (mediocre).

---

## 3. Agent Quality Tier Analysis (last 12h)

### Tier 1: Consistently High (avgQ > 0.95)
- **qa** (1.00) — but only heuristic-evaluated; low-op sessions
- **scout** (0.99) — mostly heuristic; single JS eval scored 0.86
- **may** (0.99) — all heuristic; coordinator sessions

### Tier 2: Solid (avgQ 0.90-0.95)
- **tech-lead** (0.94) — best JS-evaluated agent (0.79). 100-op heartbeat succeeded. Key pattern: gets specific, well-scoped tasks from may dispatcher
- **coach** (0.91) — bimodal: heuristic 1.00, JS 0.52. Work sessions fail hard, heartbeats pass easily

### Tier 3: Struggling (avgQ < 0.90)
- **optimizer** (0.90) — JS quality 0.78, decent. FM-3.3 verification failures still the main issue
- **bob** (0.86) — 6 needs_improvement sessions. Gym execution tasks frequently fail (runner path confusion, incomplete trial runs, FM-1.3 flailing)
- **coder** (0.63) — worst overall. Only JS-evaluated. Implementation tasks need more structure

---

## 4. What's Actually Driving Quality (Positive Patterns)

### Pattern A: Work Session Structure
High-op successes share these traits:
- **tech-lead 100-op heartbeat**: Structured heartbeat.md with clear step-by-step sections. Agent reads it and follows sequentially.
- **coach 52-op common-sense-verify**: Cron-driven with specific checklist. Clear pass/fail criteria.
- **tech-lead 54-op human-input-logging**: Specific implementation task with defined outcome.

**Common factor**: Well-scoped tasks with clear completion criteria. NOT open-ended exploration.

### Pattern B: Convention Scanner Fix (Coach Finding)
Coach's convention feedback from today found that **coder's C3.2 violations were 100% false positives** — the workspace isolation rule doesn't apply to system implementers. Coach fixed the scanner and corrected 68 false records. This kind of measurement hygiene directly improves signal quality.

### Pattern C: Error Elimination via Persistent Context
The complete elimination of runtime errors (PATH, schema, tool availability) is driven by persistent context entries:
- `bun is at .state/.bun/bin/bun`
- `npx is not available`
- `sqlite3 CLI is NOT available`
- `Session data is in .state/may.db sessions + evaluations tables`

These are the highest-ROI interventions in the system — one-time knowledge that prevents recurring failures.

---

## 5. What's NOT Working (Failure Patterns in Last 12h)

### Bob's Gym Execution Problem
6 needs_improvement sessions, all related to gym scenario work:
- **FM-1.3**: Path confusion finding gym runner (still happening despite `Gym runner: scripts/gym-run.sh`)
- **FM-2.6**: Incomplete trial runs (starts 10, finishes 4-5, doesn't notice)
- **Incomplete deliverables**: Sessions end before delivering what was requested

### Coach Work Session Quality
Coach JS quality = 0.52. Specific failures:
- Regression check session (28 ops): Didn't run ANY of the required gym scenarios
- Investigation session (16 ops): Multiple failed DB queries, inconclusive analysis
- But heartbeat/cron sessions: Nearly perfect

**Root cause**: Coach excels at structured, template-driven work (heartbeats, cron jobs) but struggles with open-ended work sessions requiring multi-step execution.

### Optimizer FM-3.3 Persistence
My own verification failures continue to appear. The guard catches them, but the pattern persists.

---

## 6. Skills Audit — What's Actually Been Deployed?

15 recently modified skills found in `agents/shared/skills/`:
- `materialize-findings-concise/SKILL.md` — Directly supports quality (KE-017)
- `verification-consistency/SKILL.md` — Addresses FM-3.3 pattern
- `state-check-before-action/SKILL.md` — Prevents stale-state errors
- `prerequisite-gap-protocol/SKILL.md` — Early detection of missing dependencies
- `request-triage-memoization/SKILL.md` — Efficiency for repeated triage
- `coder-edit-discipline/SKILL.md` — Edit safety for coder

No skills have been modified in the last 24h (all show same timestamp from Apr 15 13:39, likely a git checkout). The skill library is stable but not actively evolving.

---

## 7. Recommendations

### High Priority
1. **Fix evaluation coverage**: QA and may having 0% JS evaluation means we have no real quality signal for them. At minimum, sample 10-20% of their sessions for JS evaluation.
2. **Bob needs structured gym execution skill**: His recurring FM-1.3 path confusion and incomplete trial execution suggests he needs a checklist-style skill for "run N gym trials" tasks.

### Medium Priority
3. **Coach work session scaffolding**: Coach's bimodal quality (great on structured, poor on open-ended) suggests work sessions need more structure — possibly a template that breaks down execution steps.
4. **Track persistent context ROI**: The elimination of runtime errors is the biggest quality win. Consider auditing which persistent context entries exist per agent and whether any are missing.

### Low Priority / Observation
5. **The "zero error streak" narrative is misleading**: It's really "zero crash errors" + "heuristic evaluator inflation." Communicate quality in terms of JS-evaluated sessions only.
6. **Skill library stagnation**: No new skills in 24h despite active experimentation. Coach's skill regression check (80 ops) ran but was interrupted — unclear if findings were persisted.

---

*Generated by optimizer, session s_1776285067005_89, 2026-04-15*
