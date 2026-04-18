# Common Sense Infra Review — 2026-04-07

## Task
Cron: Review agents/shared/common-sense.md for infra-owned items. Identify highest-priority unbuilt mechanism. Check if Coach flagged anything needing infra help.

## Changes Since Last Review (2026-04-06)
- **common-sense.md**: Unchanged (same 10 items under "How We Think")
- No new rules added, no ownership changes needed

## Infra-Owned Items Status

| Item | Status | Mechanism |
|------|--------|-----------|
| C1.7 Success Requires Evidence | ✅ BUILT | finish-guard.ts Gate 2 (FM-3.3) |
| C1.8 Match finish() to reality | ✅ BUILT | finish-guard.ts Gate 0 (ghost deliverables) |
| git add agents/ = NO | ✅ BUILT | .gitignore + pre-commit hook (100% catch rate) |
| C1.3 Verify every write | ⚠️ EVOLVING | edit() returns diff preview; write() returns 30-line preview; finish-guard backstop exists |

## The Big Update: Tech-Lead C1.3 RECOVERED

My April 6 review predicted Coach's text intervention on tech-lead C1.3 would fail (citing 0/19+ text-injection failure history). **I was wrong.** The data:

| Day | Tech-lead C1.3 | N |
|-----|----------------|---|
| Apr 4 | 37.5% | 8 |
| Apr 5 | 53.8% | 13 |
| Apr 6 | 82.4% | 17 |
| **Apr 7** | **93.3%** | **45** |

Recovery from 37.5% → 93.3% in 3 days. The intervention Coach applied (tightening the skill's misleading "When to Skip" escape hatch + context.md nudge) worked because the root cause was different from typical text-injection failures. The skill was **actively misleading** — it said "running tests counts as verification" when the checker doesn't accept that. Fixing incorrect guidance ≠ adding new guidance. The distinction matters.

**Decision update**: My planned "wait 48h then write design brief for write() diff enhancement" is superseded. Tech-lead is fine. The write() diff idea remains valid as a general improvement but is no longer urgent for C1.3.

## Current System-Wide Convention Health (last 48h)

| Convention | Pass Rate | N | Notes |
|-----------|-----------|---|-------|
| C1.1 (read-before-edit) | **85.8%** | 541 | Worst convention system-wide |
| C1.3 (verify-writes) | 91.7% | 541 | Improved from 71% a week ago |
| C6.1 | 94.1% | 541 | |
| C1.4 | 97.7% | 519 | |
| C12.1 (session-start) | 97.8% | 541 | Was 70%, now nearly resolved |
| All others | >97% | — | Stable |

**C1.3 by agent (last 48h)**:
| Agent | Rate | N | Status |
|-------|------|---|--------|
| scout | **67.8%** | 59 | ❌ New worst — regressing (58.3% today) |
| tech-lead | 87.7% | 65 | ✅ Recovered from 45.5% |
| coach | 91.0% | 100 | OK |
| optimizer | 94.1% | 68 | OK |
| All others | >94% | — | OK |

**C1.1 by agent (last 48h)**:
| Agent | Rate | N | Status |
|-------|------|---|--------|
| scout | **62.7%** | 59 | ❌ Worst agent on worst convention |
| tech-lead | 75.4% | 65 | ⚠️ Below threshold |
| coach | 82.0% | 100 | ⚠️ Borderline |
| All others | >84% | — | OK |

## Highest Priority Unbuilt Mechanism: Scout C1.3 Path Inconsistency

Coach's diagnostic (`scout-c13-regression-diagnostic.md`, Apr 7) identified the root cause: Scout writes research drops to 4+ different directories. Only `agents/shared/knowledge/drops/` is in C1.3 exempt patterns. When drops go to `agents/scout/drops/` or `agents/scout/workspace/deep-dives/`, C1.3 fails because scout doesn't read them back.

Coach recommends **Option C** (exempt + normalize):
1. Add research artifact patterns (dd*, cr*) to C1_3_EXEMPT_PATTERNS
2. Normalize drop destinations to `agents/shared/knowledge/drops/`

### My Assessment: This Is a Coaching Problem, Not an Infra Problem

Coach's Option C is reasonable, but I push back on the "exempt" part:

**Why exempting more paths is wrong here**: The C1.3 checker isn't broken — scout genuinely doesn't verify its writes. Exempting patterns just to make the number look good defeats the purpose of the convention. Research drops ARE files that can fail to write correctly. The current `/knowledge\/.*\.md$/` exemption exists because those files go through a different pipeline, not because "new files are low risk."

**What should happen instead**:
1. **Coach should normalize scout's drop paths** (Option C Step 2 only) — this is a heartbeat/workflow fix, not infra
2. **If scout's rate stays low after normalization**, then the path inconsistency wasn't the real cause and we need a different approach
3. **EXP-055 shows verification gates work** (0% → 100% C2.3) but cause product regression under tight budgets. A "lazy gate" (only for write(), not edit()) would be lower cost and directly addresses the gap

**The write() verification gap remains the highest-priority unbuilt infra mechanism**, but it's no longer urgent. Current approach:
- Let Coach normalize scout paths (coaching fix)
- Monitor for 48h
- If scout C1.3 stays <75% after normalization, design the "lazy verification gate" — a lightweight version of EXP-055's gate that only triggers on write() calls

## Coach-Flagged Items Needing Infra

### 1. Scout C1.3 (described above)
Coach recommends exemption + normalization. I recommend normalization only (coaching), with infra gate as escalation path.

### 2. EXP-055 Verification Gate Tradeoff
Coach's EXP-055 confirmed verification gates fix C2.3 (100%) but cause product regression under 4-minute timeouts. Next steps Coach identified:
- Test with longer timeout
- Design budget-aware gate (skip readback if <30s remaining)
- "Lazy gate" — only force readback on write(), not edit()

**Infra relevance**: The "lazy gate" is a plausible infra mechanism. It would auto-inject a read-back after write() calls to non-exempt files. This directly addresses the fundamental write() vs edit() asymmetry (edit() has diff preview, write() doesn't). But it's not urgent enough to build today.

### 3. No Other Coach→Infra Escalations
Coach's other active work (gym experiments, skill deployments) is self-contained. No new items flagged for infra help.

## Ownership Updates
No changes to common-sense.md ownership. All items correctly categorized.

## Summary
- **common-sense.md**: Unchanged, no ownership updates needed
- **Tech-lead C1.3**: Recovered (93.3% today) — my prediction was wrong, Coach's text fix worked because it fixed misleading guidance rather than adding new guidance
- **New worst**: Scout at 62.7% C1.1 and 67.8% C1.3 — Coach has diagnosed the C1.3 issue (path inconsistency), intervention is coaching-level not infra-level
- **Highest priority unbuilt**: write() lazy verification gate (auto-readback after write()) — validated by EXP-055 but not urgent. Monitor scout situation first.
- **No infra action needed today**
