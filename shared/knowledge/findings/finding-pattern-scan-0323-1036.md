# Finding: Pattern Scan — 3 Candidate Skills for Lifecycle

**Date**: 2026-03-23T10:36
**Sessions scanned**: 20 (across 7 agents: qa, tech-lead, may, coach, bob, scout, optimizer)

## Candidate 1: Checkpoint Discipline (HIGH PRIORITY)
**Evidence**: Bob session s_1774256764786_11 used 32 checkpoints in a single debugging/investigation task. Each checkpoint costs a turn (tool call) and context (adding checkpoint result to conversation). Average checkpoint count in observed sessions:
- Bob: 32 checkpoints (1 session) — **egregious**
- Coach: 0-2 checkpoints (typical)
- Optimizer: 2 checkpoints (typical, appropriate)
- Tech-Lead: 0 checkpoints

**Anti-pattern**: Checkpointing after every read or bash call. Checkpoints should be used for:
1. After completing a logical sub-task (not each tool call)
2. Before risky operations (so rollback point exists)
3. At ~50% budget when significant progress has been made

**Proposed Skill**: "checkpoint-at-milestones" — checkpoint only at logical milestones (max 3-5 per session), not after every tool call. Protocol:
1. Define milestones at session start (plan 3-5 natural save points)
2. Checkpoint only when: completed a sub-task, about to pivot, at 50% budget
3. Anti-pattern: checkpointing after single reads, checkpointing defensively

**Waste**: Each unnecessary checkpoint = ~0.5 turn. 30 unnecessary = 15 wasted turns = significant context/cost.

## Candidate 2: Scope Discipline in Heartbeats (MEDIUM PRIORITY)
**Evidence**: Bob session started with "Audit Common Sense Infra" then pivoted to "Investigate Gym Identity Loading (Infra)" — a completely different investigation. The first task was abandoned incomplete.

**Anti-pattern**: Starting a heartbeat with one stated goal, encountering something interesting mid-session, and pivoting to investigate it instead. This leaves the original task incomplete and creates context waste from the abandoned investigation.

**Proposed Skill**: "single-task-heartbeat" — each heartbeat session commits to ONE primary task. If a new interesting finding emerges:
1. Record it in a finding file (2 sentences + file reference)
2. Stay on the original task
3. The finding will be picked up by the next heartbeat cycle

**Related**: Already partially addressed by budget-before-act (which plans budget), but doesn't specifically address mid-session scope drift.

## Candidate 3: Debug Escalation (LOW PRIORITY)
**Evidence**: Bob's session spent 37 reads + 15 bash calls investigating a gym runner issue incrementally. Could have been resolved faster with a broader approach (search for known issues, check if similar problems were already fixed).

**Anti-pattern**: Incremental debugging where each step reads one more file, rather than stepping back and framing the problem first.

**Related**: Overlaps with search-strategy-escalation (S9) which covers the search spiral. This is more about debugging strategy than search strategy, but similar enough that it may not warrant a separate skill.

## Recommendation
Run `workflow.run("skill-lifecycle", "Pattern: checkpoint-at-milestones — agents overuse checkpoints")` next session. Candidate 1 has the clearest evidence, most measurable waste, and is NOT covered by existing skills.
