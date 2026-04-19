# C1.1 Tech-Lead Convention Regression Analysis

**Date**: 2026-04-14
**Convention**: C1.1 (Read before edit)
**Agent**: tech-lead
**Claimed regression**: 98.3% → 93.1%

## Executive Summary

The regression claim is **partially accurate but misleading**. Tech-lead's C1.1 rate dropped from a peak of 100% (Apr 8, Apr 10) to ~92% (Apr 13-14), but the **overall 7-day rate is 94.9%** — actually the best it's been since tracking started. The "regression" is relative to a brief peak, not a sustained baseline. The real issue is a persistent ~5-8% failure rate on **test files and workspace docs edited without prior read**.

## Data Summary

### Daily Pass Rates (last 10 days)
| Day | Checks | Pass Rate | Note |
|-----|--------|-----------|------|
| Apr 14 (today) | 127 | 92.1% | 10 violations |
| Apr 13 | 97 | 92.8% | 7 violations |
| Apr 12 | 68 | 95.6% | 3 violations |
| Apr 11 | 40 | 92.5% | 3 violations |
| **Apr 10** | **60** | **100%** | **Peak — 0 violations** |
| Apr 9 | 47 | 95.7% | 2 violations |
| **Apr 8** | **52** | **100%** | **Peak — 0 violations** |
| Apr 7 | 50 | 80.0% | 10 violations |
| Apr 6 | 9 | 33.3% | Bad day |
| Apr 5 | 16 | 81.3% | Bad day |

The 98.3% likely comes from the Apr 8-10 window. The 93.1% from the Apr 11-14 window.

### Comparison to Other Agents (last 7 days)
tech-lead at 94.9% is **#6 out of 10 agents** — not great, not terrible.
- may: 98.0% (best)
- coder: 96.3%
- tech-lead: 94.9%
- qa: 84.8% (worst)

### Overall C1.1 Stats
- All-time: 89.2% (661/741)
- Last 7 days: 94.9% (466/491) — **improving trend**
- Last 48h: 92.4% (207/224) — slight dip from 7-day average

## Root Cause Analysis

### Violation Breakdown (last 3 days, 28 violations)

| Category | Count | % | Specific Files |
|----------|-------|---|----------------|
| **Test files** | 11 | 39% | workflow-guards.test.ts (3), cron.test.ts (3), request-status.test.ts (2), workflow-guards-integration.test.ts (2), task-watchdog.test.ts (1) |
| **workspace/todo.md** | 8 | 29% | Various agents' todo.md files |
| **Source code** | 4 | 14% | event-bus.ts, pivot-detector.ts, workflow-guards*.ts |
| **Other workspace** | 3 | 11% | audit-*.md files |
| **Shared config** | 2 | 7% | standing-orders.md, context.md |

### Key Patterns

**Pattern 1: Test files during active development (39% of violations)**
When tech-lead is iterating on test suites (especially workflow-guards tests), they skip reading the test file before editing it. This happens when they're making multiple sequential edits to the same test file — they read it once, then make 2-3 edits without re-reading between iterations. The convention checker flags each edit without a *preceding* read.

Sessions: Guards Phase 1/2 work (s_1776159865122, s_1776160529269, s_1776171153688, s_1776172958751), evaluator work (s_1776126397964), cron debugging (s_1775951649843).

**Pattern 2: workspace/todo.md updates (29% of violations)**
Tech-lead routinely updates todo.md at session end without reading it first. This is a "bookkeeping" edit — they know what they want to append. But the convention checker correctly flags that they don't know what's *currently* in the file (another session may have modified it).

Sessions: Heartbeat sessions and end-of-work-session cleanup.

**Pattern 3: Multi-file edit sprints (14% — source code)**
During complex implementation sessions, tech-lead edits source files without reading when they're "already familiar" with the content from earlier in the session but haven't re-read recently.

### Why the Existing Skill Isn't Preventing This

Tech-lead already has `agents/tech-lead/skills/read-before-edit.md` with clear rules. The skill text is good. The problem is:

1. **Awareness gap during iteration**: When making rapid test edits (edit → run test → edit again), the "re-read before next edit" step gets skipped because it feels redundant. The agent remembers the content from 2 turns ago.

2. **Bookkeeping exceptions**: todo.md updates feel like "append-only" operations where reading first seems wasteful. But edit() still needs exact oldText.

3. **The skill already covers these cases** — the anti-patterns section explicitly calls out "I remember what's in that file" and "I'm editing multiple files quickly." The skill is being **selectively ignored** rather than unknown.

## Intervention Assessment

### What Won't Work
- **More text rules** (KE-002): The skill text already covers these exact cases. Adding more text won't change behavior when the existing text is being ignored.
- **Knowledge skills** (KE-021): Tech-lead already *knows* to read before edit. This isn't a knowledge gap.
- **Stacking interventions** (KE-123): Tech-lead already has the read-before-edit skill. Adding another would violate the no-stacking rule.

### What Might Work

**Option A: context.md reinforcement for the specific failure pattern**
Add a line to tech-lead's context.md specifically calling out the two failure patterns:
```
- C1.1 reminder: ALWAYS read() before edit(), even for todo.md updates and even for test files you just edited 2 turns ago. Your #1 C1.1 failure mode is skipping re-read during test iteration.
```
Likelihood: Low (text rule, KE-002 says 0% success for judgment failures)

**Option B: Process skill — "checkpoint-read" pattern**
A new process skill that adds a structural gate: before any edit(), insert a mandatory read() call, with a specific self-check question. Difference from existing skill: this would be more specific about the *when* — "after running a test, before the next edit" and "before any todo.md update."

But this is essentially the same content as the existing skill, repackaged. Unlikely to help.

**Option C: Workflow enforcement (structural gate)**
If tech-lead uses a workflow for test iteration or session cleanup, we could add a structural gate that requires reading before editing. This is the mechanism KE-002/KE-007 says actually works. However, this requires engineering effort to build the guard, and it's unclear if tech-lead's test iteration happens within a workflow.

**Option D: Accept the current rate and monitor**
The 7-day trend is actually **up** (94.9% vs 79.2% prior week). The "regression" is from a 2-day perfect streak, which is noise. The current rate may be near the natural ceiling for this convention given the agent's work patterns. The 5% failure rate costs maybe 1-2 wasted tool calls per session — minor.

## Recommendation

**Option D: Accept and monitor. Do NOT intervene.**

Rationale:
1. The "regression" is from 100% (2 days) to 92% (2 days) — this is **normal variance**, not a sustained decline.
2. The 7-day trend is **improving** (94.9% vs 79.2% the prior week).
3. Tech-lead already has the read-before-edit skill loaded. Text interventions have 0% success rate for this type of behavioral issue (KE-002).
4. The only intervention with evidence of working (workflow enforcement / structural gates) would require engineering effort disproportionate to the ~5% improvement ceiling.
5. The violation count is small enough (1-2 per session) that it doesn't materially impact task completion.

### Monitoring Plan
- If the 7-day rolling rate drops below **90%** → revisit with a structural gate intervention
- If a specific failure pattern (e.g., todo.md) becomes dominant (>50% of violations) → consider a targeted workflow change
- Check again in 1 week

### Growth Cycle Experiment: NOT RECOMMENDED
The existing skill is already well-designed and loaded. Running an experiment would likely show no improvement since the problem is behavioral (selective non-compliance) not knowledge-based. A growth cycle experiment would need to test a structural gate, which is an engineering project, not a skill/prompt change.
