# Scout Operational Friction Analysis — 2025-05-10

## Metric Status
- **scout.operational-friction-rate**: 0.75 (target: 0.1, threshold: 0.3) — **SEVERELY BREACHED**
- **scout.good-session-rate**: 0.41 (target: 0.85, threshold: 0.65) — **BREACHED**

## Data (Last 24h)
- Total scout evaluations: **155**
- Needs improvement: **90 (58%)**
- Good: **65 (42%)**

## Root Cause Breakdown

| Issue | Count | % of failures |
|-------|-------|---------------|
| Finish blocked by uncommitted changes | ~41 | 46% |
| Forbidden path: scout/last-session.md | 16 | 18% |
| Terminal status: error | 11 | 12% |
| Terminal status: interrupted | 6 | 7% |
| Review overrides (needs_improvement) | 7 | 8% |
| Schema/query errors | 8 | 9% |

## Analysis

### 1. Uncommitted Changes (46% of failures)
Scout sessions are producing work but failing the git hygiene gate. This is the single largest source of friction. The sessions do real work (file writes, knowledge updates) but don't complete the commit workflow, causing the evaluator to flag them.

**Action needed**: Either scout's system prompt needs stronger commit instructions, or the finish guard needs to be more tolerant of scout's working patterns (scout writes to knowledge files that may be in gitignored paths).

### 2. Forbidden Path: scout/last-session.md (18%)
Scout is editing `scout/last-session.md` which the evaluator flags as a forbidden/infrastructure path. This is likely auto-written by the runtime or a finish handler, not intentional edits. The evaluator heuristic is treating infrastructure writes as constraint violations.

**Action needed**: Whitelist `*/last-session.md` in the evaluator's forbidden-path detection, since this is a runtime-managed file.

### 3. Errors & Interrupts (19%)
11 error + 6 interrupted sessions. Some are provider errors (model timeouts), some are process interruptions. Expected noise but still significant.

## Recommendations (Priority Order)

1. **P0**: Fix the `last-session.md` false positive in evaluator heuristics — eliminates 16 failures immediately
2. **P0**: Investigate why scout sessions fail the uncommitted-changes gate — is it a prompt issue or a path issue?
3. **P1**: Reduce scout session interruption rate (check if heartbeat intervals are too aggressive)

## Expected Impact
Fixing items 1+2 would reduce failures from 90 to ~33, bringing the friction rate from 0.75 to ~0.21 — much closer to threshold.
