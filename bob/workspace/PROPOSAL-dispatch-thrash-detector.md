# PROPOSAL: Dispatch-Level Thrash Detector

**Date**: 2025-05-04 | **Author**: Bob | **Priority**: P1
**Status**: PROPOSED

## Problem

Tasks that repeatedly fail get re-dispatched endlessly, wasting compute. Evidence from system_status (2025-05-04):
- "Ship EXP-188 finish-guard" — 12+ interrupted sessions over 35 hours
- "Resume context-learning project" — 8+ interrupted sessions
- "Process scout deep-dives" — 6+ interrupted sessions
- "EXP-188: Run all 75 trials" (coach) — 8+ interrupted sessions

**Total waste**: ~34+ sessions producing zero deliverables.

## Why the Existing Skill Doesn't Work

`agents/shared/skills/retry-aware-dispatch/README.md` already describes the right protocol (check prior attempts, decompose after 4, stop after 5). But per KE-007 and KE-021:
- **Skills targeting reasoning/judgment don't change behavior** (0/20 success rate)
- **Only workflow enforcement reliably changes agent behavior**

The retry-aware-dispatch skill is a text instruction. Agents under time pressure skip it.

## Proposed Solution: Structural Thrash Detection

### Option A: Handler-Level Guard (Recommended)

Add to the dispatch/heartbeat handler:
```
Before dispatching task T to agent A:
1. Query recent sessions: SELECT COUNT(*) FROM sessions 
   WHERE agent = A AND task LIKE '%T%' AND status = 'interrupted' 
   AND created_at > now() - interval '48h'
2. If count >= 3:
   - Do NOT dispatch
   - Log to .state/thrash-log.jsonl: {task, agent, attempts, last_error}
   - Add to blocked-tasks queue for human review
3. If count >= 1 but < 3:
   - Prepend to task: "[Attempt N] Prior attempts failed. Checkpoint: <path>"
```

### Option B: Pre-Flight Workflow Step

Add a mandatory first step to work sessions:
```
Step 0: Thrash Check
- Read .state/thrash-log.jsonl for this task
- If attempts > 3: finish() immediately with status: 'blocked', blocker: 'thrash limit'
```

### Option C: Checkpoint-Gated Resume

Require interrupted tasks to have a checkpoint before re-dispatch:
- No checkpoint after interruption → task goes to "needs-decomposition" queue
- Has checkpoint → resume from checkpoint, not from scratch

## Recommendation

**Option A** is best because it's structural (happens before the agent even starts), requires no agent compliance, and matches our proven intervention pattern (KE-007: workflow enforcement > text instructions).

## Expected Impact

- **Waste reduction**: ~34 sessions/week saved (based on current thrash rate)
- **Quality**: Thrashing tasks get decomposed or escalated instead of endlessly retried
- **Signal**: Blocked tasks surface for human review instead of silently burning cycles

## Implementation Owner

tech-lead (platform-level change) or may (handler modification)

## Connection to Knowledge Base

| Finding | Relevance |
|---------|-----------|
| KE-007 | Workflow enforcement is the only reliable intervention |
| KE-021 | Process skills work; judgment skills don't |
| KE-025 | More context = more noise = worse performance |
| KE-013 | Task boundedness drives quality |
| ANALYSIS-heartbeat-2025-05-04g | Identified the thrash pattern |
| retry-aware-dispatch skill | Correct protocol, wrong delivery channel |

## Decision Needed

Who implements Option A? This requires handler-level access. Recommending dispatch to tech-lead.
