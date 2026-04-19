# Context Injection Review — What to Keep, Remove, Redesign

**Owner**: May  
**Priority**: P0 (from Hao)  
**Created**: 2026-04-19  
**Status**: active

## Problem
The first user message has 16 layers of context injection (up to 55K chars) that bury the actual task. Agents follow session history instead of the task instruction.

## Principle
**The task should be the first and most prominent thing the agent sees.** All other context is secondary.

## The Injection Layers (in code order, from `buildSessionContext` in manager.ts:545-680)

| # | Layer | What it solves | Size Range | Decision |
|---|-------|----------------|-----------|----------|
| 1 | Session ID + time | Agent knows when/where | ~93 chars | **Keep** |
| 2 | Recent task history (digests) | Cold start context | 500-2500 chars | **Review** — may dominate attention |
| 3 | Active recall (FM warnings) | Prevent repeated failures | 0-500 chars | **Review** — text rules = 0% per KE-002 |
| 4 | Previous session summary (last-session.md) | Continuity | 200-700 chars | **Review** — overlaps with digests |
| 5 | Session diff | What changed since last session | 0-2000 chars | **Review** — overlaps with digests |
| 6 | Last checkpoint | Resume WIP | 0-2500 chars | **Review** — only useful for persistent tasks |
| 7 | context_files (agent.yaml) | Agent config, heartbeat | 0-12000 chars | **Keep** (but review sizes) |
| 8 | context.md | Accumulated knowledge | 0-7500 chars | **Review** — grows unbounded |
| 9 | Knowledge routing | Match KEs to task | 0-800 chars | **Review** — low impact |
| 10 | The actual task | What to DO | varies | **Keep** — this is the point |

**System prompt** (separate, not in first user msg): SOUL.md + common-sense.md + standing-orders.md + knowledge-essentials.md + skills — 2K-7K chars per agent.

## Baseline Measurements (M1) — 2026-04-19

### First User Message Size by Agent (recent sessions)

| Agent | First Msg (chars) | ~Tokens |
|-------|-------------------|---------|
| scout | 16,837 | 4,209 |
| bob | 16,173 | 4,043 |
| may | 15,640 | 3,910 |
| coder | 13,522 | 3,381 |
| coach | 12,257 | 3,064 |
| tech-lead | 9,386 | 2,347 |
| evaluator | 9,323 | 2,331 |
| qa | 6,366 | 1,592 |
| optimizer | 6,362 | 1,591 |
| amy | 2,736 | 684 |

### Biggest Context Contributors (static files)

| Agent | context.md | heartbeat.md | SOUL.md | Total Static |
|-------|-----------|-------------|---------|-------------|
| bob | 5,193 | 10,535 | 6,009 | 21,978 |
| coach | 3,671 | 11,302 | 4,491 | 19,827 |
| tech-lead | 5,052 | 9,231 | 5,353 | 19,889 |
| optimizer | 4,788 | 7,268 | 7,186 | 19,493 |
| scout | 2,988 | 12,266 | 2,498 | 18,173 |
| may | 7,560 | 5,629 | 4,090 | 17,582 |

### Key Finding
- System prompt = 0 in session.jsonl (it's on the Agent object, separate)
- Everything dynamic goes in first user message
- Heaviest agents (scout, bob, may) get ~16K chars before the task even appears
- The task appears LAST — after all context layers
- context.md grows unbounded (may=7.5K, bob=5.2K, tech-lead=5K)

## Milestones

- [x] M1: Measure current first-user-message size per agent (baseline)
- [x] M2: Test removing layers 2-6, 8-9 — does task compliance improve?
  - [x] M2a: Add `contextLayers` toggles to `SubagentDefinition` (branch `review/context-injection-m2`)
  - [x] M2b: Tests verify layers are removed when toggled off (6/6 pass, 83% size reduction with all optional layers disabled)
- [x] M3: Test moving essential context to system prompt (cacheable)
  - [x] M3a: `contextMdInSystemPrompt` toggle moves context.md to system prompt (4 tests pass)
  - [x] M3b: First user message shrinks by 127 chars when context.md moves to system prompt
- [ ] M4: Design minimal injection: session ID + task, everything else on-demand
- [ ] M5: Implement and verify task compliance improves

## Alternatives to Removal (don't lose what each layer solved)
- Cold start → project file IS the context for persistent tasks; heartbeats use single last-session.md
- Failure prevention → encode in skills/guards, not injected text
- Continuity → persistent tasks via project file, not 3 overlapping layers (digests + last-session + session-diff)
- Learned context → keep but cap size, or move to system prompt
- Knowledge access → breadcrumb discovery approach

## Code Location
- `src/lib/manager.ts` lines 540-680: `buildSessionContext()` — builds the first user message
- `src/lib/session-digest.ts`: digest history formatting
- `src/lib/active-recall.ts`: failure recall injection
- `src/lib/session-diff.ts`: cross-session diff
- `src/lib/knowledge-router.ts`: KE matching
- `src/lib/tools/checkpoint.ts`: checkpoint read

### Iteration 1 — 2026-04-19T09:37:56.795Z
**Worker task**: Iteration 1 — work toward goal
**Worker result**: **Status:** done (3m20s)

**Files modified:**
- src/lib/__tests__/context-layers.test.ts

**Files read (not modified):**
- /app/src/lib/manager.ts

**Errors encountered:**
- [bash] (no output)

Command exited with code 1

**Agent response:**
tsc clean, all 6 tests pass. Now let me commit this test file to the branch:
**Files touched**: (see worker session)
**Owner assessment**: CONTINUE — M2 is partially done — tests exist but we need to verify they actually pass and understand results. M3-M5 remain.

Next iteration: Run the context-layers tests (`bun test src/lib/__tests__/context-layers.test.ts`) and verify all pass. Then move to M3 — test moving essential context to system prompt. Read the project file at `agents/tech-lead/workspace/projects/context-injection-review.md` for M3 details before starting work.


### Iteration 2 — 2026-04-19T09:39:28.884Z
**Worker task**: Iteration 2 — work toward goal
**Worker result**: **Status:** done (1m26s)

**Files read (not modified):**
- agents/tech-lead/workspace/projects/context-injection-review.md
- agents/may/workspace/projects/context-injection-review.md

**Errors encountered:**
- [read] ENOENT: no such file or directory, access '/app/agents/tech-lead/workspace/projects/context-injection-review.md'
- [bash] The following paths are ignored by one of your .gitignore files:
agents
hint: Use -f if you really want to add them.
hint: Turn this message off by running
hint: "git config advice.addIgnoredFile false"


Command exited with code 1

**Agent response:**
Now let me commit the project file update:
**Files touched**: (see worker session)
**Owner assessment**: CONTINUE — M2 is still incomplete — tests exist but we haven't seen evidence they pass. The worker's iteration 2 mostly just read project files and failed to commit (gitignore issue for agents/).

Next iteration:
1. Run `export PATH=".state/.bun/bin:$PATH" && bun test src/lib/__tests__/context-layers.test.ts` and show full output
2. If all tests pass, M2 is done — check it off in the project file
3. Then start M3: Read `agents/may/workspace/projects/context-injection-review.md` for M3 spec. M3 is about testing whether moving essential context (persistent facts, DB access instructions) to the system prompt improves cacheability. Design and implement this.

