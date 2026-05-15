# Assessment: Bob C6.1 Regression (96.4% → 91%)

**Date**: 2026-04-11  
**Investigator**: Coach  
**Triggered by**: Convention regression alert (C6.1 dropped from 96.4% → 91%)

---

## Finding: Read-Heavy Knowledge Work Trips a Write-Tuned Threshold

### The Numbers

| Period | C6.1 Pass Rate | Context |
|--------|---------------|---------|
| Mar 29-30 | 25-42% | Old threshold (45 tool calls) |
| Apr 1-3 | 93-96% | Threshold raised to 80, stable |
| Apr 5-6 | 100% | Low-volume days (23-28 sessions) |
| **Apr 7-11** | **91-92%** | **Phase 1/2 task splitting introduced** |

The regression correlates with the introduction of **Phase 1/Phase 2 task splitting** (knowledge integration pattern), not with any guard deployment or behavioral change.

### Root Cause: Bob's Read-to-Write Ratio

C6.1 counts **all tool calls** (reads, writes, bash, etc.) against a threshold of **80**. Bob's knowledge integration work is inherently read-heavy:

- Average `toolCalls/opCount` ratio for failing sessions: **1.59x**
- A session with 55 state-changing ops can trigger 88+ total tool calls
- Phase 1 ("Analyze & Plan") sessions are the worst offenders: **84.6% pass rate** (vs 95.9% for heartbeats)
- Phase 1 reads many KB files to plan but writes nothing — purely inflating the read count

### Breakdown by Session Type (Last 3 Days)

| Session Type | Sessions | C6.1 Failures | Pass Rate | Avg Ops |
|-------------|----------|---------------|-----------|---------|
| Phase 1 (plan) | 39 | 6 | 84.6% | 28.8 |
| Regular work | 85 | 9 | 89.4% | 26.8 |
| Phase 2 (write) | 32 | 2 | 93.8% | 19.3 |
| Heartbeat | 121 | 5 | 95.9% | 15.7 |

### What the 22 Failures Look Like

Tool call counts in violations: 80–150 range (avg 107)  
Task types: Knowledge integration (16), experiment analysis (6), heartbeat inline work (5), research (1)

All are **legitimate complex tasks** — integrating experiment results, cross-referencing knowledge base files, indexing scout drops. None show spinning, retrying, or wasteful patterns.

---

## Assessment: NOT Worth a Gym Exercise or Skill Intervention

### Why This Isn't a Behavioral Problem

1. **No waste pattern**: The failing sessions are doing real work efficiently. An avg ratio of 1.59 (tool calls per op) means ~60% of calls are reads, which is normal for KB integration.

2. **Phase 1/2 is a structural intervention already**: Splitting work into plan-then-write phases is the *right* pattern for reliability. It just happens to push some planning sessions over the 80-call threshold because planning requires reading many files.

3. **The 91% rate is stable, not declining**: The 12h windows show 88-97% oscillation, not a trend. The "drop from 96.4%" was comparing a quiet period (Apr 5-6, 100% with low volume) to the new normal.

### What Would Actually Help (Infrastructure, Not Coaching)

**Option A: Raise the C6.1 threshold** (recommended)
- Current: 80 tool calls
- Proposed: 100 tool calls
- This would catch only truly bloated sessions (the 107+ range) while accommodating legitimate KB work
- Expected impact: ~96% pass rate for bob

**Option B: Exclude read-only calls from the count**
- Count only state-changing tool calls (writes, edits, bash with side effects)
- More accurate signal for "budget hitting" but harder to implement
- The convention checker would need to classify tool calls by type

**Option C: Accept the ~91% rate**
- If the convention's purpose is "flag sessions that might be too long," then 91% is a reasonable rate
- 8-9% of bob's sessions being flagged as "possibly too long" is an accurate signal — those sessions *are* long
- The question is whether the flag is useful feedback or just noise

### Recommendation

**No coach intervention needed.** This is an infrastructure/convention-tuning question, not a behavioral one.

Escalate to tech-lead with recommendation: **Raise C6.1 threshold to 100** or **count only state-changing calls**. The current threshold was set at the 97th percentile of *all agents* (2026-03-31), but bob's knowledge work has a legitimately higher read ratio than other agents.

If the threshold isn't changed, the ~91% rate should be accepted as the new baseline for bob, not treated as a regression requiring intervention.

---

## Data Sources

- `.state/may.db` → `convention_checks` table (790 bob C6.1 records)
- `.state/may.db` → `sessions` table (session metadata)
- `agents/may/handlers/convention-check.ts` lines 705-726 (C6.1 implementation, threshold = 80)
