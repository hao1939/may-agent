# Project: Context Learning — Implementation Phase

**Status**: done
**Owner**: bob (handler by may)
**Priority**: P1
**Iteration**: 12
**Health**: 7/10 (PASS)

## Goal
Integrate the reflexion-based learning pipeline into the agent infrastructure so agents automatically learn from failed sessions.

## Approach (revised 2026-04-22)
Original plan needed `src/lib/manager.ts` runtime hooks (impossible — no src/).
New approach: **cron handler** (`may/handlers/context-learning.ts`) that:
1. Runs every 2h, queries DB for recent failed/low-quality sessions
2. Dispatches bob to extract "When X, do Y" lessons using LLM
3. Bob appends lessons to `agents/<name>/context.md` under "## Learned from experience"
4. Auto-prunes to 15 lessons max per agent

## Milestones
- [x] M1: Core pipeline implemented and tested (17/17 tests) — `extract-reflection.js`
- [x] M2: Cron handler built — `may/handlers/context-learning.ts` (replaces runtime hook)
- [x] M3: Cron entry added — `may/cron.json` (every 2h, offset 30min)
- [x] M4: Verify first automated run produces valid lessons in at least 1 agent's context.md
- [x] M5: Run reflexion gym experiments — baseline + treatment comparison

## Key Decisions
- Pipeline triggers on session failure/error only (not clean sessions)
- Lessons stored as text bullets in `agents/<name>/context.md`
- Max 15 lessons, FIFO pruning
- Use cheap/fast model for extraction

## Open Questions
- Where in infrastructure is the session completion handler? Need to find the hook point.
- npx works in this env — need alternative failure scenario or npx-shadow wrapper
- Does the gym runner support automated multi-run experiments?

## Current State
Complete. 5/5 milestones. All milestones are complete:

**M4: Verify first automated run produces valid lessons in at least 1 
## Iteration Summary
- **Iter 1**: Already committed in a prior step. Good.

- **Iter 2**: All 19 tests pass (9 original + 10 new).

- **Iter 3**: Now write the experiment design doc:

- **Iter 8**: The pipeline works end-to-end. Let me verify the context.md was actually written:

- **Iter 9**: M4 is complete. The reflexion-scan script successfully extracted 25 lessons from real session transc

- **Iter 10**: Good — the experiment ran but agent was "skipped" (no live agent adapter). Now I have all the data n

- **Iter 11**: The npx-recovery results are excellent: baseline 0% → treatment 100% on both checks. The read-before

- **Iter 12**: All milestones are complete:

**M4: Verify first automated run produces valid lessons in at least 1 


## Comments
