# Brief: Tech-Lead C1.3 (Verify Writes) Regression

**Date**: 2026-04-06
**Triggered by**: [req:3d77f171] Convention regression: tech-lead C1.3 dropped from 66.7% to 60%
**Severity**: High — tech-lead is worst agent for C1.3 at 45.5% (last 48h)

## Data

### C1.3 pass rate for tech-lead by day:
| Day | Pass Rate | N |
|-----|-----------|---|
| Apr 2 | 87.5% | 8 |
| Apr 3 | 80.0% | 5 |
| Apr 4 | 37.5% | 8 |
| Apr 5 | 53.8% | 13 |
| Apr 6 | 0% | 1 (single session) |

### Comparison with other agents (last 48h):
| Agent | C1.3 Pass Rate | N |
|-------|---------------|---|
| qa | 100% | 34 |
| scout | 95.0% | 20 |
| may | 93.2% | 44 |
| bob | 91.3% | 46 |
| amy-kimi | 89.2% | 37 |
| coach | 80.0% | 50 |
| optimizer | 72.9% | 48 |
| **tech-lead** | **45.5%** | **22** |

### Violation pattern — files NOT read back after write():
- **Test files**: 10/27 violations (37%) — test/session-digest-context.test.ts, test/task-watchdog.test.ts, etc.
- **Source files**: 5/27 (19%) — src/lib/manager-retry.ts, src/lib/classify-error.ts
- **Workspace docs**: 3/27 (11%) — design docs, response briefs
- **Scripts**: 2/27 (7%)
- **Workflows**: 2/27 (7%)

## Root Cause Analysis

1. **Tech-lead already has verify-after-edit.md skill** — but it's not working
2. **Key issue**: The skill's "When to Skip" section said:
   - "If you just ran tests that exercise the file (tests are verification)"  
   - "If the write was to a new file you're about to test immediately"
3. **But the C1.3 checker doesn't count running tests as verification** — it looks for explicit `read()`/`cat`/`grep` of the specific file
4. **Result**: Tech-lead writes test files → runs tests → thinks that's verification → C1.3 flags it
5. **Also**: `write()` has no diff preview (unlike `edit()`) — so there's genuinely no verification

## Intervention Applied

### 1. Tightened skill (agents/tech-lead/skills/verify-after-edit.md)
Replaced misleading "When to Skip" section:
- **Removed**: "tests are verification" and "new file about to test" escape hatches
- **Added**: Explicit rule that `edit()` with diff preview = verified, `write()` always needs read-back
- **Added**: Clarification that running tests ≠ C1.3 verification

### 2. Context.md nudge (agents/tech-lead/context.md)
Added direct line: "C1.3 violation: After every write() call, you MUST read() the file back. write() has no diff preview — unlike edit(), there is no automatic verification. This is your #1 convention violation (45% pass rate). Test files, scripts, and workflow files all need read-back."

## Expected Outcome

Based on KE-023, text-based skills showed no production lift for C1.1. C1.3 may be similarly resistant. However:
- The skill was actively misleading (escape hatch contradicted the checker rules)
- Fixing that should at least remove false confidence
- Context.md nudges are always loaded (unlike skills which may be skipped)

**If no improvement in 48h**: Consider L5 workflow enforcement (e.g., require read-back step in tech-lead's task completion workflow).

## Monitoring

Check in 48h with:
```sql
SELECT date(checked_at/1000, 'unixepoch') as day, 
  ROUND(100.0*SUM(CASE WHEN passed=1 THEN 1 ELSE 0 END)/COUNT(*),1) as pct,
  COUNT(*) as n
FROM convention_checks 
WHERE convention='C1.3' AND agent='tech-lead'
GROUP BY day ORDER BY day DESC LIMIT 5
```

Target: ≥70% pass rate within 48h.
