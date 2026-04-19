# Investigation Brief: Tech-Lead C6.1 Convention Regression

**Date**: 2026-04-07  
**Investigator**: Coach  
**Convention**: C6.1 — Tool call budget (≤80 calls per session)  
**Overall pass rate**: 44% (11/25 in last 25 checks), 63.6% (133/209 all-time)

---

## Root Cause: Inline Implementation in Heartbeat Sessions

### The Pattern

Tech-Lead heartbeat sessions were performing **full implementation work inline** rather than forking work sessions. Sessions routinely hit 80–228 tool calls (vs. the 80-call convention limit) because they were writing source code, running test suites, building tests, and verifying npm checks — all within a single heartbeat session.

**Evidence from high-op sessions (outcomes)**:
- `ops: 143` → "All 100 new tests pass"
- `ops: 149` → "Clean. Let me do a final summary of everything accomplished"
- `ops: 89` → "I've done substantial work"
- `ops: 125` → "All 100 new tests pass"

**Child session analysis**: ALL 8 high-op heartbeat sessions (Apr 6 18:02–Apr 7 00:39) had **zero child sessions**. The tech-lead was doing all work inline.

### Timeline

| Period | Heartbeat Version | Avg Ops | C6.1 Pass Rate | Behavior |
|--------|-------------------|---------|-----------------|----------|
| Apr 6 18:02–00:39 | Old (26-line minimal) | 121 | 15% (2/13) | Inline implementation |
| Apr 7 01:02–03:32 | New (169-line dispatcher) | 26 | 100% (7/7) | Triage + fork |

### The Old Heartbeat (before commit `e884b2b4`, 2026-04-07T01:32)

The original heartbeat was 26 lines with a simple structure:
1. Process pending tasks → do them
2. "Pick ONE from this priority list" → do it
3. Finish

It had no concept of forking. The instruction "Actionable → do it (or delegate to coder if it's code)" was ambiguous — the agent consistently chose "do it" over "delegate." There was no explicit guidance on when to fork vs. work inline, no warnings about tool call limits, and no structural separation between deciding and executing.

### The New Heartbeat (Dispatcher Mode)

The replacement heartbeat (committed Apr 7 01:32) is a 169-line structured workflow with:
- **Explicit triage/dispatch separation**: "Your heartbeat is for DECIDING what to build — not for BUILDING it"
- **Must-fork rules**: Any source code editing, npm run check, test writing, >5 tool calls
- **Quick inline rules**: Only simple responses, todo updates, acknowledgments
- **Builder-specific warnings**: "Do NOT edit source files inline in a heartbeat"
- **Work session templates**: Concrete fork examples with scoping and constraints

### Transition Evidence

The session at `2026-04-07T01:02` (36 ops, 1 child fork) was the first to use the new heartbeat — and the first to properly delegate. Every heartbeat since has stayed under 36 ops.

---

## Comparison with Other Agents

| Agent | C6.1 Pass Rate | Avg Ops | Max Ops | Notes |
|-------|---------------|---------|---------|-------|
| **tech-lead** | **63.6%** | **31** | **202** | **Worst — inline implementation** |
| optimizer | 76.4% | 24 | 289 | Similar pattern (scope creep in analysis) |
| bob | 79.1% | 18 | 114 | Occasional deep research sessions |
| coach | 87.0% | 23 | 184 | Gym runs push ops high occasionally |
| scout | 95.3% | 13 | 75 | Naturally scoped (read + index) |
| coder | 97.5% | 9 | 51 | Small-scope tasks by design |
| may | 98.5% | 6 | 164 | Infrastructure handlers are lean |
| qa | 99.7% | 5 | 26 | Review tasks are naturally bounded |

**Key insight**: Agents with naturally bounded scope (qa, coder, may) rarely fail C6.1. Agents whose heartbeats invite open-ended exploration (tech-lead, optimizer, bob) have worse rates. The intervention is making the heartbeat explicitly scope-bounding.

---

## Intervention Analysis

### What Was Done (Already Deployed)

The heartbeat was restructured from a 26-line "do it" workflow to a 169-line "decide and dispatch" workflow. This is a **structural intervention** per KE-007 (workflow structure beats text rules).

**Mechanism**: The old heartbeat's implicit structure was `observe → do → finish`. The new one is `observe → decide → dispatch → exit`. The critical addition is the "Must-fork" list and the "DO NOT start implementation after dispatching" instruction.

### Effectiveness (Early Signal)

- **Before intervention**: 15% C6.1 pass rate (2/13 sessions, Apr 6 18:02–00:39)
- **After intervention**: 100% C6.1 pass rate (7/7 sessions, Apr 7 01:02–03:32)

This is a dramatic improvement, but the sample is small (7 sessions). Need 20+ sessions to confirm stability.

### Risk Assessment

1. **Work displacement, not elimination**: The forked work sessions can still exceed 80 ops. However, C6.1 is evaluated per-session, so forked sessions that hit limits don't affect the heartbeat's C6.1 score. The work sessions listed above (e.g., `s_1775529288012_199` at 16 ops) show that properly scoped forks stay well within budget.

2. **Throughput impact**: Heartbeats now take 149–603s (avg ~200s) vs. 666–2400s (avg ~1200s) before. Total throughput may stay similar if work sessions run, but heartbeat overhead is 6x lower.

3. **Fork abandonment**: One risk is forking work then never following up. The heartbeat includes "Check for running work sessions you previously forked" in Step 1, which should mitigate this.

---

## Disposition

### Is This Resolved?

**Partially**. The structural intervention is deployed and showing strong early results. However:

1. **Monitoring needed**: Track C6.1 pass rate over 48h (target: >80% sustained)
2. **The old heartbeat problem is fixed** — the agent now forks instead of implementing inline
3. **No Coach action needed** — the intervention was designed and deployed by May/tech-lead

### Proposed Follow-Up

1. **Track at 48h**: If C6.1 stays >80% across 20+ sessions, mark resolved
2. **Check work session quality**: Are forked work sessions completing successfully? (Early signal: 2 work sessions in last 6h, both successful)
3. **Apply same pattern to other failing agents**: Optimizer (76.4%) and Bob (79.1%) may benefit from similar heartbeat restructuring

### Coach vs. May Responsibility

- **Deployed by**: May/tech-lead (auto-commit `e884b2b4` at 2026-04-07T01:32)
- **Coach role**: Monitor effectiveness, recommend similar interventions for other agents if confirmed
- **May role**: None needed — intervention is already deployed
- **If regression occurs**: Coach should investigate whether the agent is circumventing the dispatcher structure (working inline despite fork guidance) or whether specific task types resist forking

---

## Key Takeaways

1. **Root cause was structural, not behavioral**: The old heartbeat's workflow *invited* inline implementation. No amount of text rules ("keep sessions lean") would fix this — the workflow had to change.
2. **KE-007 validated again**: Workflow structure (decide → dispatch → exit) beats text instructions ("pick ONE thing"). The agent follows the workflow structure it's given.
3. **Transition was instant**: 0 sessions of gradual improvement — the heartbeat change produced immediate compliance. This is characteristic of structural interventions (vs. skills/text, which show gradual or zero improvement per KE-002).
4. **Zero child sessions was the signal**: The diagnostic marker for C6.1 failure was not "too many ops" but "zero child sessions despite high ops" — the agent was doing everything itself instead of delegating.
