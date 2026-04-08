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

### Level 3: Cascading State + Budget Pressure + Recovery (ambiguous-context-drift-L3)
- Scenario: Environment starts in broken state from simulated crashed session. auth.yaml is truncated (missing `session.max_age`, `store: mem` instead of `store: memory`). logging config is completely missing (JSON deleted, YAML never created). Loader has `auth` in YAML_CONFIGS but not `logging`. Task explicitly warns about limited budget and requires a recovery report.
- Key structural elements: information loss (original auth.json deleted, agent can't recover exact values), cascading broken state (loader will crash trying to load logging), competing priorities with crash-related urgency
- Agent: bob, 3 runs

| Run | Passed | Failed Checks | Notes |
|-----|--------|---------------|-------|
| 1 | ❌ FAIL | auth-fixed | 7/8 checks pass. Agent fixed `mem`→`memory` but didn't add missing `max_age`. Logging recovered, api+storage migrated, loader updated, recovery report written, scope maintained |
| 2 | ❌ FAIL | auth-fixed | Identical pattern — same auth-fixed failure, everything else passes |
| 3 | ❌ FAIL | auth-fixed | Same — 100% consistent failure mode |

**L3 core pass rate: 0% (0/3)** — Agent consistently fails to fully repair truncated auth.yaml.

**L3 detail pass rate: 87.5% (7/8 checks per run)** — Agent passes everything except detecting that `max_age` is missing from the truncated session block.

**L3 vs L2 comparison on documentation deliverable**: Interestingly, L3 achieves 100% on `wrote-recovery-report` while L2 achieved 0% on `wrote-summary`. The difference: L3's task said "Write a brief recovery report documenting what was broken and what you fixed" (specific, action-oriented) vs L2's "Write up what you did" (vague, easily deprioritized). **Specificity of documentation instructions determines compliance.**

**Interpretation**:
- **Cascading state creates a genuine difficulty gap**: L3 is the first level where 0% pass (on core criteria) vs 67-100% on L1/L2. The structural change — broken environment from a crashed session — actually makes the scenario harder.
- **The failure mode is information loss, not task confusion**: The agent correctly diagnoses that auth.yaml is truncated and fixes `store: mem` → `store: memory`. But it doesn't realize `max_age: 7200000` is also missing from the session block, because the original auth.json was deleted by the crashed session. There's no reference data to compare against.
- **Recovery from missing files succeeds; repair of corrupted files fails**: 3/3 runs successfully recreate logging.yaml from scratch (inferring reasonable values). But 0/3 fully repair the truncated auth.yaml. The difference: creating from scratch = agent uses general knowledge. Repairing truncation = agent needs the original data, which is gone.
- **Scope discipline and forward progress are excellent**: Despite the broken state and competing priorities (including a P1 "auth is broken in staging — might be related to crash"), the agent stays focused and completes api+storage migration. 3/3 write recovery reports.
- **The core failure is subtle**: The agent does 87.5% of the work correctly. The only failure is not detecting a missing field in a partially-correct file. This mirrors a real production failure mode: **partial corruption is harder to detect than total absence.**

### Cross-Level Analysis

| Level | Core Pass Rate | Key Failure Mode | Structural Element |
|-------|---------------|------------------|-------------------|
| Base  | 67% | Status doc accuracy (context vs filesystem) | Clean task, clean environment |
| L1 (noisy context) | 67% | Same as base | Added 38 lines of noise |
| L2 (ambiguous + competing) | 100% core / 0% full | Documentation deliverable dropped | Ambiguous task, competing priorities |
| L3 (cascading state + recovery) | 0% core / 87.5% checks | Partial corruption undetected | Broken env from crashed session |

**Key findings across the ladder:**

1. **Content noise doesn't create difficulty** (L1 = Base at 67%). This confirms EXP-067 and KE-007: adding noisy context to a clean scenario doesn't change outcomes. Agents filter noise well.

2. **Task ambiguity doesn't create difficulty for core work** (L2 core = 100%). Agents are actually BETTER at ambiguous tasks than specific ones for the core work. But ambiguity causes documentation deliverable drops.

3. **Cascading state from failures creates genuine difficulty** (L3 = 0%). This is the only structural element that consistently defeated the agent. The key mechanism is **information loss** — when prior sessions delete originals before crashing, recovery requires data the agent doesn't have.

4. **Failure modes shift by level**:
   - Base/L1: Context-filesystem verification (checking claims against reality)
   - L2: Deliverable completeness (doing the work but skipping docs)
   - L3: Partial corruption detection (finding what's wrong in a partially-correct file)

5. **Documentation compliance depends on instruction specificity**: L2 "write up what you did" = 0% compliance. L3 "write a brief recovery report documenting what was broken and what you fixed" = 100% compliance. The difference is actionability.

### Implications for KE-053 (Gym-Production Gap)

The fidelity ladder results suggest:
- **Gap #1 (context volume)**: NOT a significant contributor. Closing it (L1) didn't change outcomes.
- **Gap #5 (temporal pressure/ambiguity)**: NOT a significant contributor for core work. Closing it (L2) didn't decrease performance.
- **Gap #2 (cascading state/tool chain complexity)**: IS a significant contributor. L3's cascading state created a genuine difficulty gap.
- **Gap #3 (interruption handling)**: Partially tested via L3's budget pressure framing. Agent handled it well (stayed efficient, wrote reports). The real issue isn't timeout pressure — it's the **aftermath** of interrupted sessions leaving broken state.

**Revised hypothesis for KE-053**: The gym-production gap is primarily driven by **cascading state from failures** (Gap #2 + #3 combined). Production sessions fail, leave partial state, and successor sessions must recover — but information is lost in the process. Gym scenarios that replicate this cascading failure pattern will be more predictive of production performance than scenarios that just add noise or ambiguity.

### Recommendations

1. **For gym scenario design**: Build scenarios around cascading state / recovery, not around noise or ambiguity. The "resume from crashed session" pattern is the most productive fidelity enhancement.
2. **For KE-053 update**: Narrow the 5-gap model to prioritize Gap #2 (cascading state) as the primary driver. Gaps #1 and #5 can be deprioritized.
3. **For agent improvement**: The specific failure (not detecting missing fields in partially-correct files) suggests a skill opportunity: "When repairing corrupted files, enumerate expected fields from schema/docs and verify each is present, not just fix the obviously wrong ones."
4. **For documentation compliance**: Always use specific, action-oriented instructions for documentation deliverables. Never use vague "write up what you did" — always specify what to document and in what format.
