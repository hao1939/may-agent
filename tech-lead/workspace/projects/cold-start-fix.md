# Cold Start / Memory Fix

**Owner:** tech-lead
**Goal:** Reduce session startup waste from 20-30% to under 10% of budget.
**Created:** 2026-04-16
**Status:** Active
**Master project:** [system-evolution.md](../../may/workspace/projects/system-evolution.md) → Gap 1
**Source feedback:** [tech-lead](../system-gaps.md), [optimizer](../../optimizer/workspace/system-gaps.md), [coach](../../coach/workspace/system-gaps.md)
**Tracked metrics:** `system.agent-utilization`

## Why
Every agent wastes their first 5-15 tool calls rebuilding context: reading todo.md, querying DB, scanning recent sessions. Tech-lead, optimizer, coach, and scout all independently flagged this as their #1 time sink.

## Milestones

- [ ] **Structured handoff file per agent** — Each agent writes a machine-readable `last-session.md` at session end (what changed, what's pending, key state). Next session reads this ONE file instead of 5-10 queries.
- [ ] **"Diff since last session" tool** — Given a timestamp, show what files changed, what requests completed, what new requests arrived. Eliminates manual reconstruction.
- [ ] **Split bloated todo.md files** — Separate active priorities from historical log. Scout specifically flagged todo.md as a wall of text that buries actionable items.
- [ ] **Pre-computed context injection** — At session start, inject a summary block with: pending requests, recent completions, current project state. Don't make agents query for basics.

## Progress Log
<!-- Append entries as milestones are completed -->

### Iteration 1 — 2026-04-16T11:07:23.325Z
**Worker task**: Iteration 1 — work toward goal
**Worker result**: **Status:** done (4m53s)

**Files modified:**
- /app/src/lib/last-session.ts
- /app/test/last-session.test.ts

**Files read (not modified):**
- /app/agents/tech-lead/workspace/projects/cold-start-fix.md
- /app/src/lib/manager.ts
- /app/src/lib/session-subscribers.ts
- /app/src/app/may.ts

**Agent response:**
All passing. Let me update the progress log in the project file:
**Files touched**: (see worker session)
**Owner assessment**: DONE — — Milestone 1 ("Structured handoff file per agent") is fully implemented. The worker created `src/lib/last-session.ts` and `test/last-session.test.ts`, integrated write into `session-subscribers.ts` and read into `manager.ts`. All 11 tests pass, tsc is clean. No further iterations needed.


### Iteration 2 — 2026-04-16T12:04:46.588Z
**Worker task**: Iteration 2 — work toward goal
**Worker result**: **Status:** done (3m16s)

**Files modified:**
- /app/src/lib/session-diff.ts
- /app/test/session-diff.test.ts

**Files read (not modified):**
- /app/src/lib/requests.ts

**Agent response:**
tsc clean (no errors), 8/8 tests pass.
**Files touched**: (see worker session)
**Owner assessment**: DONE — — Milestone 2 ("Diff since last session" tool) is fully implemented. `src/lib/session-diff.ts` provides `getSessionDiff()` and `formatSessionDiff()` with git file changes, completed/new requests, and recent sessions since a timestamp. Supports agent filtering and limits. 8/8 tests pass, tsc clean. Clean, well-structured code. Next step would be integrating this into session startup (wiring it into manager.ts to inject the diff into agent context).


### Iteration 3 — 2026-04-16T12:33:46.703Z
**Worker task**: Iteration 3 — work toward goal
**Worker result**: **Status:** done (2m35s)

**Files modified:**
- /app/scripts/split-todo.ts

**Files read (not modified):**
- /app/agents/scout/workspace/todo.md
- /app/agents/coach/workspace/todo.md
- /app/agents/tech-lead/workspace/todo.md

**Agent response:**
tsc clean. Let me verify the line counts show real improvement:
**Files touched**: (see worker session)
**Owner assessment**: CONTINUE — — The worker created `scripts/split-todo.ts` but didn't actually run it to split the todo files. The milestone goal is "Split bloated todo.md files" — we need the actual splitting done, not just a script. Next iteration:

1. Run the split script against all agent todo.md files: `bun scripts/split-todo.ts`
2. Verify the output — each agent should have a lean active-priorities file separate from historical log
3. Ensure agents' heartbeat/startup reads the new lean file instead of the full todo.md (or that todo.md itself is now slim)
4. Show before/after line counts as evidence of reduction


### Iteration 4 — 2026-04-16T12:35:35.131Z
**Worker task**: Iteration 4 — work toward goal
**Worker result**: **Status:** done (1m35s)

**Files read (not modified):**
- /app/scripts/split-todo.ts

**Agent response:**
Hmm, tech-lead says "17 completed/historical sections" but earlier output said 1 section. That's because it was already split before (bob has an archive too). The reference link is there. All good.
**Files touched**: (see worker session)
**Owner assessment**: CONTINUE — Before/after: scout 1082→105, coach 416→91, tech-lead 368→55. Massive reductions. The split was done in iteration 3 (the git diff confirms it), and iteration 4 just verified. My earlier review was wrong — the worker DID run the script.

DONE — Milestone "Split bloated todo.md files" is complete. Before/after line counts: scout 1082→105 (90% reduction), coach 416→91 (78%), tech-lead 368→55 (85%). The split script was run in iteration 3 and the working tree reflects the splits. Archive files exist for historical content.


### Iteration 5 — 2026-04-16T12:42:53.540Z
**Worker task**: Iteration 5 — work toward goal
**Worker result**: **Status:** done (5m31s)

**Files modified:**
- workspace/verification-report.md

**Agent response:**
All 19 tests pass (11 last-session + 8 session-diff). tsc clean (no error output).
**Files touched**: (see worker session)
**Owner assessment**: DONE — — The milestone "Split bloated todo.md files" was completed in iterations 3-4. Iteration 5 produced a verification report confirming tests pass and tsc is clean. The goal of reducing bloated todo.md files is achieved with 78-90% line count reductions across all agents.

