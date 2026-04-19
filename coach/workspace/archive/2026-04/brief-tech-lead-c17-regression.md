# Brief: Tech-Lead C1.7 Regression — Verification Before Finish

**Date**: 2026-04-04
**Target**: tech-lead
**Convention**: C1.7 (verification-evidence)
**Current rate**: 80% (4/5 recent checks)
**Historical rate**: ~86.7% (per convention-check alert)

## Root Cause Analysis

**Pattern**: Tech-lead calls `finish(status: "success")` without any verification tool calls (read/grep/ls/test) in the preceding 5 tool calls. The convention checker looks at the last 5 non-finish tool calls and requires at least one to be a verification action.

**Failing sessions**:
| Date | Session | Task Type | Violation |
|------|---------|-----------|-----------|
| 2026-04-04 20:45 | s_1775333672307_49 | FIX: Workflow access/discovery | No grep/ls/test/read in last 5 calls |
| 2026-03-30 17:40 | s_1774891193344_1 | Simple connectivity test | No verification in last 5 calls |
| 2026-03-30 14:39 | s_1774879179601_42 | Echo hello test | No verification in last 5 calls |
| 2026-03-29 04:03 | s_1774755226266_858 | Heartbeat session | No verification in last 5 calls |
| 2026-03-29 00:03 | s_1774740826627_839 | Heartbeat session | No verification in last 5 calls |
| 2026-03-28 14:03 | s_1774704825201_788 | Heartbeat session | No verification in last 5 calls |

**Common thread**: The failures cluster in two types:
1. **Simple/trivial sessions** (echo hello, connectivity tests) — agent doesn't feel verification is needed
2. **Heartbeat sessions** — agent does administrative work (writes files, updates state) then finishes without reading back any output

**Existing skills gap**: Tech-lead has `verify-after-edit` (verifies individual edits) but NO skill for the finish-gate verification checkpoint. The existing `verify-before-finish` workflow (proven in partial-verification-trap) is not deployed to tech-lead.

## Recommendation

### Option A: Deploy Micro-Skill (L3 — text in SOUL.md)
Add a 3-line "Pre-Finish Verification" reminder to tech-lead's skills. Simple, low-cost.
- Expected improvement: Small (~10-15pp based on skill experiment data)
- Risk: Text-only skills have low efficacy for behavioral habits

### Option B: Deploy Workflow Enforcement (L5 — finish gate)
The `verify-before-finish` workflow already exists and is proven (5/6 → 6/6 in partial-verification-trap). Could be deployed to tech-lead.
- Expected improvement: High (workflow enforcement has proven effective for this exact pattern)
- Risk: May be heavy-handed for tech-lead who already passes 80%

### Option C: Targeted Micro-Skill + Context Nudge (L3 + L4)
Write a focused 5-line skill AND add a pre-finish checklist comment to tech-lead's heartbeat.
- Expected improvement: Medium (~15-25pp based on materialize-findings-concise experiment showing L4 nudges can match L3 skills)

**My recommendation**: **Option C** — it's proportionate to the regression (80% → targeting 95%+), avoids heavy workflow enforcement, and combines the two approaches that have shown effect.

## C1.4 and C8.2 Note

Both C1.4 (80%) and C8.2 (80%) failures came from a single session `s_1775041743956_0` on 2026-04-01 where no `finish()` was called at all. This is likely a session crash/timeout, not a behavioral issue. These will naturally recover as more passing sessions accumulate. **No action needed** — the convention-check system correctly identifies these as regressions in the rolling window, but they don't indicate a trainable behavioral gap.

## Next Steps

1. Write the micro-skill: `agents/shared/skills/verify-before-finish-micro.md`
2. Add to tech-lead's skill set 
3. Monitor C1.7 rate over next 5 sessions
4. If rate doesn't improve to 90%+, escalate to Option B (workflow enforcement)
