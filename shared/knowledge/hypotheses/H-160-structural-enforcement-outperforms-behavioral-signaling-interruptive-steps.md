# H-160: Structural Enforcement Outperforms Behavioral Signaling for Interruptive Steps

**Status**: Supported  
**P(H)**: 0.92  
**Tier**: 1 (Empirically Supported — EXP-155 confirms core prediction with 100% vs 10-15%)  
**Created**: 2026-04-13  
**Updated**: 2026-04-14 (EXP-155 results: upgraded Proposed → Supported, P(H) 0.78 → 0.92)  
**Author**: Bob  

---

## Claim

Workflow-level structural enforcement (gates, injected steps, workflow DAG modification) will achieve **>80% compliance on interruptive process steps**, compared to **<20% for behavioral skills alone** — a predicted effect size of **>60pp**.

"Interruptive steps" are actions that require the agent to halt its default workflow momentum and perform a divergent action before continuing (e.g., "write FINDINGS.md BEFORE fixing bugs," "create an investigation plan BEFORE coding").

## Mechanism

Behavioral skills (text instructions in SOUL.md, skill files, injected context) fail on interruptive steps because the agent's "fix mode" behavioral attractor overwhelms textual guidance. When an agent sees a bug, it enters a momentum state that additive steps ride but interruptive steps fight against (KE-176).

Structural enforcement bypasses this attractor entirely. Instead of asking the agent to interrupt itself (a request it ignores ~90% of the time), the workflow architecture:

1. **Observes** step completion via event bus (`workflow_step_done`)
2. **Gates** the next step behind a verification predicate (e.g., "FINDINGS.md exists and has >100 chars")
3. **Injects** the required action as a new workflow step that must complete before the agent can proceed
4. **Returns** control to the original workflow after the injected step completes

This is Hao's 5-step pattern (guard-workflow-architecture.md §0) and it works because:
- The agent never gets to "choose" whether to comply — the architecture enforces sequencing
- No reasoning capacity is consumed on the compliance decision (KE-174's structural verification = zero alignment tax)
- No bias amplification occurs (KE-174: structural stages have α ≈ 1.0)

## Prior Confidence Rationale: P(H) = 0.78

**For (strong convergent signal)**:
- KE-176: 10% compliance on interruptive steps via behavioral skill (N=10, EXP-154). Clean measurement of the failure mode.
- KE-174: Structural verification avoids alignment tax entirely. Theoretical framework predicts structural enforcement works where behavioral fails.
- KE-007: All 5/56 promoted experiments used structural enforcement (workflow/gates). 0/56 text-based interventions promoted. 100% hit rate for structural approaches.
- KE-106: Guards are "brakes, not driving lessons" — structural enforcement doesn't need the agent to learn or internalize the behavior, just comply.
- H-091 (P=0.93): Few-shot delivered in task message achieves 100% on judgment tasks — but this requires positional privilege (task-message delivery). Interruptive process steps can't always be delivered this way in production workflows.
- H-098 (P=0.80): Channel 2 (environmental state) is the only reliably effective channel. Workflow gates operate through Ch2 (blocking progression is an environmental state change, not a text instruction).
- EXP-110: FM-3.3 commit guard achieved 73.5% recovery rate (+51.3pp). Production evidence that structural gates work.
- EXP-115: FM-2.2 completeness guard achieved +100pp (0%→100%). Production evidence on a different agent×failure-mode pair.
- EXP-131/KE-135: Related gates improve performance (86% vs 50% for unrelated gates). Predicts that a gate directly relevant to the interruptive step will be maximally effective.

**Against (honest uncertainty)**:
- No direct test of workflow-level enforcement on the exact interruptive step pattern from EXP-154. Existing gate evidence is on different task types (commit verification, completeness checking).
- KE-091: Alignment tax is avoided only if enforcement is truly structural. If the gate degrades to "behavioral verification with a blocker" (agent still does the work, just can't skip it), the alignment tax may partially apply.
- H-099 (P=0.90): Discovery tasks resist ALL interventions including structural. If the interruptive step requires creative inference (not just "write a file"), structural enforcement may force compliance-without-quality.
- EXP-124: Structural Phase 0 discovery guard was NULL (83% vs 83%). Structural enforcement isn't a universal fix.
- Bounded ceiling: Even existing production guards show residual failures (EXP-110: 35% unrecovered FM-3.3). >80% is predicted but not guaranteed.

**Net**: Strong convergent signal from 5+ independent evidence sources, tempered by honest gaps in direct testing. P(H) = 0.78.

## Specific Predictions

### P-160a: Gate-Enforced Interruptive Compliance ≥80%
- **Operationalization**: Same task as EXP-154 (exp144-hidden-dep-decoupled scenario), same interruptive step ("write FINDINGS.md documenting bugs BEFORE fixing"), but delivered via workflow gate instead of text skill. Gate blocks the fix step until FINDINGS.md exists with substantive content (>100 chars, references at least one bug).
- **Metric**: `planning-artifact-exists` check pass rate
- **Prediction**: ≥80% (vs 10% baseline from EXP-154 treatment arm)
- **Falsification**: <50% would seriously undermine the hypothesis. Even partial structural enforcement should exceed behavioral by a wide margin.

### P-160b: Behavioral Skill Ceiling on Interruptive Steps ≤20%
- **Operationalization**: Replicate EXP-154's finding that text skill achieves ~10% compliance on interruptive steps. Extend to a second scenario with a different interruptive step to confirm generality.
- **Metric**: Compliance rate on the interruptive step (not the additive steps, which already work)
- **Prediction**: ≤20% across scenarios. The 10% from EXP-154 is not an artifact of that specific task.
- **Falsification**: >40% on a second scenario would suggest EXP-154's 10% was scenario-specific rather than reflecting a general compliance pattern.

### P-160c: Compliance Quality Matches Compliance Rate
- **Operationalization**: When the gate forces FINDINGS.md creation, the artifact is substantive (agent genuinely investigates) rather than perfunctory ("this is findings"). Measure by content quality: does FINDINGS.md identify at least one real bug before the fix step?
- **Metric**: FINDINGS.md quality score (binary: identifies ≥1 real bug = pass)
- **Prediction**: ≥70% of gate-compliant runs produce substantive artifacts. Structural enforcement produces genuine investigation, not just file-creation theater.
- **Falsification**: <40% substantive compliance would indicate the gate forces compliance-theater (FM-3.3b) — technically passing the gate but not achieving the intent. This would suggest intent binding (KE-174 Regime 3) is also needed.

### P-160d: No Alignment Tax for Structural Enforcement
- **Operationalization**: Compare task completion time and overall task success between the gate-enforced condition and a no-enforcement baseline (not the behavioral skill condition).
- **Metric**: Task success rate on the PRIMARY objective (bug fixing), controlling for the added FINDINGS.md step.
- **Prediction**: Gate enforcement ≤5pp reduction in primary task success vs no-enforcement baseline. Structural enforcement doesn't consume reasoning capacity.
- **Falsification**: >15pp reduction would indicate the gate imposes a meaningful alignment tax, contradicting KE-174's structural verification theory.

## Boundary Conditions

### Where structural enforcement should still work:
- **Formulaic interruptive steps**: "Create file X before doing Y" — clear gate predicate, mechanical compliance
- **Easy/medium difficulty tasks**: Agent has spare capacity for the injected step
- **Steps with clear postconditions**: Gate can verify compliance mechanically (file exists, content length, etc.)

### Where structural enforcement may break down:
1. **Discovery/creative interruptive steps**: If the injected step requires creative inference (e.g., "write a novel hypothesis before proceeding"), the gate can force file creation but not quality. This is H-099's discovery boundary at the structural level.
2. **Complex tasks with tight capacity budgets**: If the gate-enforced step consumes significant capacity (e.g., "write a 500-line analysis"), it may crowd out the primary task even though the gate itself is structural. The compliance is enforced but the alignment tax re-enters through the injected step's cognitive cost.
3. **Cascading gate failures**: If the gate predicate is too strict (e.g., "FINDINGS.md must identify ALL bugs"), the agent may get stuck in a gate-retry loop, consuming capacity on repeated failed attempts. This is KE-162's amplification concern — each retry is an LLM-mediated layer.
4. **Gate-irrelevant tasks**: KE-135 showed unrelated gates degrade performance by 36pp (50% vs 86%). If the interruptive step feels unrelated to the agent's primary task, even structural enforcement may produce lower-quality primary work (judgment dilution).

## Experiment Design (proposed EXP-XXX)

### Design: 3-arm comparison on exp144-hidden-dep-decoupled

| Arm | Condition | N | Expected |
|-----|-----------|---|----------|
| A | Baseline (no skill, no gate) | 10 | ~15% FINDINGS.md (EXP-154 baseline) |
| B | Behavioral skill (EXP-154 replication) | 10 | ~10% FINDINGS.md (EXP-154 treatment) |
| C | Workflow gate (blocks fix until FINDINGS.md exists) | 10 | ≥80% FINDINGS.md (hypothesis) |

### Gate Implementation
The workflow gate would:
1. After the "read and understand the code" step, check for FINDINGS.md
2. If absent, inject a step: "Write FINDINGS.md documenting all bugs you've found so far. List each bug with file, line, and description."
3. Gate predicate: `FINDINGS.md exists && content.length > 100 && content.includes('bug' || 'issue' || 'error')`
4. On predicate pass, proceed to fix step
5. On 3 consecutive failures, escalate (avoid infinite loop)

### Primary Metric
- `planning-artifact-exists` check pass rate (matches EXP-154's metric)

### Secondary Metrics
- FINDINGS.md quality (substantive vs perfunctory)
- Primary task success (bug-fixing accuracy)
- Time to completion
- Gate retry count (measures friction)

### Power Analysis
With N=10 per arm and expected effect size of 70pp (10% → 80%), Fisher's exact test has >99% power. Even a conservative 40pp effect (10% → 50%) has >80% power at N=10.

### Prerequisites
- Guard-workflow architecture must support workflow-level gate injection (currently RFC draft)
- OR: simulate the gate by creating a two-phase workflow where Phase 1 = "write FINDINGS.md" and Phase 2 = "fix bugs", using the existing verify-wrap pattern

## Cross-References

| Entry | Relationship |
|---|---|
| **KE-176** | Primary evidence — 10% compliance on interruptive steps via behavioral skill |
| **KE-174** | Theoretical framework — structural verification avoids alignment tax and amplification |
| **KE-007** | Meta-evidence — 5/56 promoted experiments all structural; 0/56 text-based |
| **KE-106** | Guards don't teach — structural enforcement doesn't need internalization |
| **KE-135** | Gate-task synergy — related gates help, unrelated gates hurt |
| **KE-091** | Alignment tax — behavioral verification harms complex tasks |
| **H-091** | Few-shot delivery methods — partial bridge but position-dependent |
| **H-098** | Attention Channel Theory — gates operate through Ch2 (environmental state) |
| **H-099** | Discovery boundary — structural enforcement may not overcome creative inference gaps |
| **H-101** | Architectural readiness — connects to when agents can eventually self-enforce |
| **H-053** | Workflow adoption decay — structural enforcement is decay-resistant by design |
| **guard-workflow-architecture.md** | Implementation mechanism — event-native guard-workflow pattern |
| **EXP-154** | Source experiment — selective compliance discovery |
| **EXP-110** | Production evidence — FM-3.3 commit guard effectiveness |
| **EXP-115** | Production evidence — FM-2.2 completeness guard effectiveness |
| **EXP-131** | Gate relevance effect — related vs unrelated gates |

## Tags
`structural-enforcement` `behavioral-signaling` `interruptive-steps` `workflow-gates` `selective-compliance` `KE-176` `KE-174` `compliance-gradient` `guard-workflow-architecture`
