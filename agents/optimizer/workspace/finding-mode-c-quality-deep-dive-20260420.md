# Mode C: Quality-Preserved Deep Dive — Why 0.860?

**Date:** 2026-04-20  
**Current:** 0.860 | **Previous (Apr 19):** 0.897 | **Target:** 0.90  
**Trend:** Dropped from 0.904 → 0.890 → 0.860 over last 12h (accelerating decline)

## Metric Context

The `optimizer.quality-preserved` metric is computed from all non-skipped, non-evaluator session evaluations. In the last 12h window: **325 scored sessions, avg quality 0.688** — a sharp drop from the 0.90+ baseline that held through Apr 18.

## Top 3 Causes of Low Quality (last 12h, 124 sessions scoring < 0.75)

### 1. Verification Failure (FM-3.3) — 56 sessions (45% of low-q)

**Agents affected:** optimizer (27), tech-lead (12), bob (5), coach (5), scout (5), coder (2)

Sessions claim success but lack evidence: deliverables not written, tests not run, or file edits silently failed. Example: optimizer session `s_1776612938020_28` (q=0.1) reported "done" after an `edit` tool failure without retrying.

**Root cause:** Agents don't validate their own outputs before calling `finish(success)`.  
**Fix:** Enforce deliverable read-back guard in finish() — medium effort, high impact.

### 2. Evaluator-Skip / Duplicate-Agent-Name — 22 sessions (18% of low-q)

**Agents affected:** coach (12), optimizer (8), scout (2)

These sessions score q=0.0 because the evaluator couldn't score them (logged as "duplicate agent name" or "did not score this agent"). This is a **measurement bug**, not a quality bug — these sessions may have been perfectly fine but get recorded as 0.0.

**Root cause:** Evaluator name-collision logic incorrectly skips certain sessions. When they get q=0.0 instead of being excluded, they massively drag the average.  
**Fix:** Either exclude evaluator-skip sessions from the metric computation, or fix the evaluator's agent-name dedup. **This is the single highest-impact fix** — removing 22 false-zero sessions would raise the 12h average significantly.

### 3. Drift / Reasoning-Action Mismatch (FM-2.6) — 13 sessions (10% of low-q)

**Agents affected:** coach (7), tech-lead (2), optimizer (2), bob (1), coder (1)

Session does something different than what was assigned. E.g., optimizer `s_1776615423727_168` (q=0.1) was told "REVIEW ONLY — no file edits" but proceeded to edit files and overwrite `DELIVERABLES_CHECKLIST.md` despite explicit prohibition.

**Root cause:** Task instructions not being respected, possibly due to long context or competing directives.  
**Fix:** Improve task template clarity; add hard-gate constraints for destructive operations.

## Additional Patterns

| Bucket | Count | Key agents |
|--------|-------|-----------|
| Truncation issues | 9 | optimizer (7) |
| Other/untagged | 24 | optimizer (17), coach (5) |

**Optimizer is disproportionately affected:** 61 of 124 low-q sessions (49%) are optimizer sessions, yet optimizer only accounts for 36% of volume. The optimizer's avg quality (0.588) is the worst of any agent in the last 12h.

## Agent Quality Rankings (last 12h)

| Agent | Sessions | Avg Quality | Low-Q Count |
|-------|----------|-------------|-------------|
| may | 23 | 1.000 | 0 |
| qa | 11 | 0.987 | 0 |
| bob | 35 | 0.823 | 7 |
| tech-lead | 36 | 0.779 | 16 |
| scout | 21 | 0.729 | 7 |
| coder | 9 | 0.700 | 3 |
| coach | 73 | 0.668 | 30 |
| **optimizer** | **117** | **0.588** | **61** |

## Impact Estimate

1. **Fix evaluator-skip scoring bug (22 false zeros → excluded):** Raises metric ~0.02-0.03
2. **Fix verification failures (raise 56 sessions from avg ~0.3 to 0.75):** Raises metric ~0.03-0.04  
3. **Combined:** Would push metric back to ~0.91, above target

## Recommendations

1. **P0 — Fix evaluator-skip scoring.** Sessions with "duplicate agent name" / "did not score" should either be excluded from the metric or re-evaluated. This is a measurement artifact, not a real quality problem.
2. **P1 — Add deliverable verification guard.** Before `finish(success)`, require at least one read-back of the primary deliverable file. This catches the 56 verification failures.
3. **P1 — Investigate optimizer's high low-q rate.** 52% of optimizer sessions score below 0.75, suggesting a systemic issue — possibly instruction-following regression or task template problems specific to optimizer workflows.

## Comparison to Previous Investigation (Apr 19)

| Pattern | Apr 19 count | Apr 20 count | Trend |
|---------|-------------|-------------|-------|
| reasoning_mismatch | 16 | 13 (as drift) | ↓ stable |
| session_error | 13 | — | ↓ not seen |
| opBudget_exhaustion | 7 | — | ↓ not seen |
| verification_failure | 5 | **56** | ↑↑ NEW DOMINANT |
| evaluator_skip (false zeros) | — | **22** | ↑ NEW |

**Key shift:** Verification failure exploded from 5 → 56, becoming the dominant failure mode. Evaluator-skip false zeros are new. Session errors and budget exhaustion appear resolved.
