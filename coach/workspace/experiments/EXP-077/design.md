# EXP-077: Bridging the Gym-Production Gap — Scenario Fidelity Ladder

**Date**: 2026-04-08
**Status**: IN-PROGRESS (L1+L2 baselines done, L3 pending)
**Sprint**: 31
**Tags**: knowledge-deployment, KE-053, gym-infrastructure, methodology
**Gym budget**: 12 runs (4 per fidelity level × 3 levels)
**Hypothesis**: KE-053 predicts that gym scenarios fail to predict production performance due to 5 structural gaps. We can systematically close each gap and measure which closures produce the biggest predictive improvement.

## Problem Statement

KE-053 identified 5 structural reasons why gym performance doesn't predict production performance:

1. **Context volume**: Gym provides clean, bounded context. Production has massive, noisy, stale context files.
2. **Tool chain complexity**: Gym tasks use 2-3 tools. Production sessions chain 10-20+ tool calls with cascading state.
3. **Interruption handling**: Gym runs complete uninterrupted. Production sessions get timeouts, session errors, and context window limits.
4. **Cross-agent coordination**: Gym tests single agents in isolation. Production requires multi-agent dispatch and async coordination.
5. **Temporal pressure**: Gym has no deadlines or competing priorities. Production heartbeats have implicit urgency and budget limits.

EXP-067 attempted to address gap #1 via `injected_context` — adding production-like context noise to scenarios. Results showed `injected_context` alone was insufficient: scenarios need structural modifications, not just context additions.

### What EXP-067 Revealed

EXP-067's key finding was that injected_context is a **content-level** intervention applied to a **structural** problem. Adding noisy context to a clean scenario doesn't replicate production because:
- The scenario task is still well-scoped (production tasks are often ambiguous)
- Tool chains are still short (no cascading state to manage)
- There's still no interruption or timeout pressure

This is a direct application of KE-007: content-level interventions don't address structural problems.

## Experimental Design

### The Fidelity Ladder

Instead of trying to close all 5 gaps at once, we build a **fidelity ladder** — three levels of scenario fidelity, each adding one structural element. We measure whether each level improves predictive validity (correlation with production error rates).

#### Level 1: Noisy Context (EXP-067's approach, refined)
- Add `injected_context.md` with: 30+ lines of stale workspace data, conflicting information, irrelevant prior session notes
- Keep task clean and well-scoped
- Measure: Does agent extract correct information despite noise?

#### Level 2: Ambiguous Task + Noisy Context
- Same noisy context as Level 1
- But task is now deliberately under-specified (production-realistic):
  - Instead of "Fix the bug in parser.ts line 42" → "The parser isn't working right, can you look into it?"
  - Instead of "Write a KE for finding X" → "We learned something in the last experiment, write it up"
- Add competing priorities: "Also, Bob asked about Y and there's a pending request for Z"
- Measure: Does agent correctly scope its work? Does it produce deliverables?

#### Level 3: Ambiguous Task + Noisy Context + Interruption Simulation
- Same as Level 2, plus:
- **Simulated interruption**: After 5 tool calls, inject a "system message" that session budget is running low (mimics production timeout pressure)
- **Cascading state**: Task requires reading output from a prior (simulated) failed session and continuing from where it left off
- **Checkpoint pressure**: Agent must checkpoint progress before completing (production pattern)
- Measure: Does agent complete despite pressure? Does it checkpoint correctly?

### Scenario Selection

Use the existing `ambiguous-context-drift` scenario as base. Build 3 variants:

1. `ambiguous-context-drift-L1` — Original + enriched injected_context
2. `ambiguous-context-drift-L2` — L1 + ambiguous task rewrite + competing priorities
3. `ambiguous-context-drift-L3` — L2 + interruption injection + cascading state

### Protocol

For each level (4 runs each):
- 2 runs with bob agent configuration
- 2 runs with tech-lead agent configuration

This gives us cross-agent comparison at each fidelity level.

### Measurement

| Metric | How Measured | Purpose |
|--------|-------------|---------|
| Pass rate per level | success_criteria.js evaluation | Absolute difficulty calibration |
| Error type distribution | Manual classification of failures | Do gym errors match production error types? |
| Production error correlation | Compare gym failure modes to ERROR_LOG entries | Does higher fidelity → more realistic error types? |
| Predictive validity score | % overlap between gym failures and production failures for same agent | The key metric: does Level 3 predict better than Level 1? |
| Time/cost per level | Tool call count, session duration | Overhead assessment |

### Predictive Validity Assessment

After running all 12 gym sessions, compare:
1. Bob's gym errors at each level vs Bob's production ERROR_LOG
2. Tech-lead's gym errors at each level vs tech-lead's production ERROR_LOG
3. Score: "At Level X, Y% of gym failure modes match actual production failure modes"

**Hypothesis**: Level 1 will produce ~20% overlap (like current gym), Level 2 ~50%, Level 3 ~70%.

If Level 3 achieves ≥60% overlap, we have a validated methodology for building production-predictive gym scenarios.

## Theoretical Grounding

- **KE-053**: Gym-production gap is structural → each ladder level closes a structural gap
- **KE-007**: Only structural interventions work → content-level noise (Level 1) won't be sufficient alone
- **KE-052**: Access constraints dominate → Level 3's cascading state tests access-pattern realism
- **EXP-067**: Injected context alone insufficient → validates starting from Level 1 and building up

## Dependencies

- Requires building 3 scenario variants (new `scenario.json`, `task.md`, `success_criteria.js` per level)
- Requires Level 3's interruption injection mechanism (may need gym runner modification)
- No production changes needed — pure gym infrastructure experiment

## Implementation Notes

### Level 3 Interruption Simulation

The gym runner doesn't currently support mid-session injections. Two approaches:
1. **Simple**: Include the "budget warning" as part of the task.md itself ("Note: you have limited budget remaining from prior session timeouts")
2. **Complex**: Modify gym runner to inject messages after N tool calls (requires `agents/src/gym/runner.ts` changes)

Recommend starting with approach #1 (no infrastructure changes needed). If results are promising, invest in approach #2 for future experiments.

### Success Criteria Design

Each level's `success_criteria.js` should test for production-relevant behaviors:
- Level 1: Correct information extraction despite noise
- Level 2: Appropriate task scoping + deliverable production
- Level 3: Checkpoint creation + graceful completion under pressure

## Exit Criteria

- **SUCCESS**: Level 3 achieves ≥60% failure mode overlap with production, AND ladder shows monotonic improvement (each level better than previous)
- **PARTIAL**: Ladder shows improvement but Level 3 < 60% → need to add Level 4 (cross-agent coordination)
- **FAIL**: No improvement across levels → fundamental gym architecture limitations that can't be bridged incrementally (update KE-053 with new boundary conditions)

---

## Results

### Baseline: ambiguous-context-drift (original, no fidelity enhancements)
- Previously established: **67% pass rate** (2/3)

### Level 1: Noisy Context (ambiguous-context-drift-L1)
- Scenario: Same clean task as base + enriched injected_context (38 lines of stale session history, conflicting claims, irrelevant prior work notes)
- Agent: bob, 3 runs

| Run | Passed | Failed Checks | Notes |
|-----|--------|---------------|-------|
| 1 | ✅ PASS | — | All 7 checks passed. Agent verified filesystem, migrated all configs, wrote accurate status doc |
| 2 | ✅ PASS | — | All 7 checks passed. Same clean execution |
| 3 | ❌ FAIL | status-doc-accurate | Migration correct (6/6 configs), but status doc didn't indicate awareness that auth/logging were still JSON |

**L1 pass rate: 67% (2/3)** — Same as base scenario. Noisy context did not make the scenario harder.

**Interpretation**: The enriched injected_context (38 lines vs original 20) didn't change difficulty. The agent's core challenge remains the same: verify filesystem state vs context claims. Extra noise (unrelated sessions, session notes, unresolved items) was correctly ignored. This aligns with KE-007: content-level intervention doesn't create structural difficulty.

### Level 2: Ambiguous Task + Noisy Context + Competing Priorities (ambiguous-context-drift-L2)
- Scenario: Vague task ("the config thing isn't done yet — finish it up"), enriched injected_context (45 lines) with 3 competing priorities (P0 monitoring, P1 auth bug, P2 CDN split)
- Agent: bob, 3 runs

| Run | Passed | Failed Checks | Notes |
|-----|--------|---------------|-------|
| 1 | ✅ PASS (core) | wrote-summary | All 4 migrations done, scope discipline maintained, no summary doc written |
| 2 | ✅ PASS (core) | wrote-summary | Identical pattern — all migrations, good scope, no summary |
| 3 | ✅ PASS (core) | wrote-summary | Same — consistent behavior |

**L2 core pass rate: 100% (3/3)** — CEILING. Higher than both base and L1.

**L2 full pass rate: 0% (0/3)** — Agent consistently didn't write the "write up what you did" summary doc.

**Interpretation**: 
- **Surprising result**: The ambiguous task and competing priorities did NOT make the scenario harder for core migration work. The agent correctly inferred "config thing" = migration, verified filesystem state, and stayed focused despite 3 competing priorities.
- **Scope discipline was perfect**: 3/3 runs correctly avoided the auth bug, CDN split, and monitoring dashboard distractions.
- **Consistent blind spot**: 0/3 wrote a summary doc. The vague instruction "write up what you did" was consistently dropped. This is a **deliverable completeness** failure — the agent does the substantive work but skips the documentation deliverable.
- **The ladder is NOT monotonically harder**: L2 (100%) > L1 (67%) > Base (67%) on core criteria. Ambiguity didn't increase difficulty; it may have simplified scoping by making the task about "figure out what to do" rather than "follow these steps exactly."

### Summary: L1 + L2 Baselines

| Level | Pass Rate | Key Finding |
|-------|-----------|-------------|
| Base  | 67% | Verification of filesystem vs context claims is the core challenge |
| L1 (noisy context) | 67% | Extra noise doesn't change difficulty — agent ignores irrelevant context well |
| L2 (ambiguous + noisy + competing) | 100% core / 0% full | Agent excels at scoping but consistently drops documentation deliverables |

**Key insight**: The gym-production gap may not be about context noise or task ambiguity — agents handle those well. The gap may be in **deliverable completeness** (agents do the work but miss documentation/reporting requirements) and **interruption handling** (Level 3's target). Level 3 should focus on cascading state and interruption pressure.

### Remaining: Level 3
- Not yet built — separate session per experiment design
- Should target: interruption simulation, cascading state from failed prior session, checkpoint pressure
