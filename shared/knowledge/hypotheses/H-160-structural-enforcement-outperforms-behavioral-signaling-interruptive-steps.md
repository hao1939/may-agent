# H-160: Structural Enforcement Outperforms Behavioral Signaling for Interruptive Steps

**Status**: RESOLVED / SUPPORTED  
**P(H)**: 0.94  
**Tier**: 1 (Empirically Supported — EXP-155 confirms core prediction with 100% vs 10-15%; KE-212 adds adversarial-regime external validation)  
**Created**: 2026-04-13  
**Updated**: 2026-04-18 (Resolution verdict formalized; KE-212 / DD-763 Parallax external validation; P(H) 0.92 → 0.94)  
**Prior updates**: 2026-04-14 (EXP-155 results: Proposed → Supported, P(H) 0.78 → 0.92)  
**Author**: Bob  

---

## Resolution Verdict

**Verdict**: SUPPORTED (RESOLVED)
**Date**: 2026-04-18
**P(H) at resolution**: 0.94

**Decisive evidence**:
- **EXP-155** — 3-arm gym experiment: structural workflow gate 100% compliance vs behavioral skill 10–15% vs baseline ~10% (p<0.001, effect size >85pp — exceeds the predicted >60pp threshold).
- **KE-176** — Independent measurement of the 10% behavioral-skill baseline on interruptive steps (N=10, EXP-154), confirming the failure-mode denominator.
- **KE-212 / DD-763 (Parallax)** — External adversarial-regime validation: structural gates hold under adversarial distribution; behavioral-only interventions degrade further. Extends H-160 beyond the original gym regime.
- **EXP-110** — Production evidence: FM-3.3 commit-guard (structural) +51.3pp vs behavioral baseline.
- **EXP-115** — Production evidence: FM-2.2 structural gate +100pp vs behavioral baseline.

**What would reopen this**: Any single +50pp behavioral-only intervention on a genuine interruptive step (no structural assist, no workflow DAG modification, measured on a task where the default "fix-mode" attractor applies). Absent such evidence, H-160 is resolved.

**Downstream hypotheses building on this resolved foundation**:
- **H-161** — Artifacts as dual-IT (information-theoretic) functions: structural gates produce artifacts that simultaneously verify compliance and carry downstream signal.
- **H-162** — Compliance topology matrix: mapping interruptive-vs-additive × structural-vs-behavioral regimes.
- **H-167** — Typed-contract discriminability: structural enforcement as a typed-composition boundary; behavioral signaling as untyped.

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

## Experimental Evidence: EXP-155

### EXP-155: Ch2 Hard Externalization Gate vs Selective Compliance (2026-04-14)

**Design**: 3-arm comparison on hidden-dependency scenario (exp155-hidden-dep-hard-gate)

| Arm | Condition | Channel | N | Overall Pass | P1 (artifact exists) |
|-----|-----------|---------|---|-------------|---------------------|
| A | Baseline (soft 3-phase) | None | 20 | 15.0% (3/20) | ~100% |
| B | Ch1 Skill (investigation-before-fix) | Ch1 | 10 | 10.0% (1/10) | **10%** |
| C | **Ch2 Hard Gate (FINDINGS.md required)** | **Ch2** | **10** | **100.0% (10/10)** | **100%** |

**Effect size**: +85pp over baseline, +90pp over Ch1 skill. Fisher's exact p < 0.0001 for both comparisons.

### Prediction Evaluation

| Prediction | H-160 Target | EXP-155 Result | Verdict |
|-----------|-------------|----------------|---------|
| P-160a: Gate compliance ≥80% | ≥80% | **100% (10/10)** | ✅ **EXCEEDED** |
| P-160b: Behavioral skill ≤20% | ≤20% | **10% (1/10)** | ✅ **CONFIRMED** |
| P-160c: Compliance quality matches rate | ≥70% substantive | **100% (P2+P3 both 100%)** | ✅ **EXCEEDED** |
| P-160d: No alignment tax | ≤5pp primary task reduction | **0pp (product checks 100%)** | ✅ **CONFIRMED** |

All four specific predictions confirmed or exceeded. The effect size (+85pp) substantially exceeds the predicted >60pp.

### Quality Beyond Compliance

The most remarkable finding: Ch2 gates didn't just force artifact creation — they forced **quality thinking**. All 10 agents documented BOTH hidden bugs (RULES_PAH typo + checksum mismatch) when required to write structured FINDINGS.md. P2 and P3 went from ~0% (Ch1) to 100% (Ch2). This exceeds P-160c's prediction of ≥70% substantive compliance.

### P(H) Update: 0.78 → 0.92

**Bayesian update rationale**:
- Prior: P(H) = 0.78 based on convergent indirect evidence (KE-176, KE-174, KE-007, KE-106, production guards)
- Likelihood ratio: The 100% result (10/10) on the exact operationalized prediction is extremely strong evidence. P(data|H) ≈ 0.95 (expected ≥80%, got 100%). P(data|¬H) ≈ 0.02 (if structural enforcement doesn't reliably outperform, 10/10 at p<0.0001 is very unlikely).
- LR ≈ 47.5. Posterior: 0.78 × 47.5 / (0.78 × 47.5 + 0.22 × 1) ≈ 0.994
- **Tempered to 0.92** for honest uncertainty:
  - Single scenario (hidden-dependency). Generalizability to other interruptive step types unproven.
  - N=10 per arm (95% CI: 69-100% for Ch2 arm). True rate could be lower.
  - Partial confound: treatment changed both delivery channel AND instruction content (structured output + "MULTIPLE bugs" hint).
  - Gate-task synergy: this scenario has a natural 2-phase structure that maps cleanly to a gate. Tasks without clear decomposition may resist.

### External Validation: KE-212 / DD-763 (Parallax) — Adversarial-Regime Replication

DD-763 (Parallax: architecture for safe autonomous AI execution) reports, on 280 adversarial cases across 9 attack categories, **98.9% block rate under default config, 100% under max-security, 0 false positives — and exactly 0% protection from prompt-level guardrails when the reasoning system is compromised**. This is an independently-conducted, production-scale red-team evaluation (not our corpus, not our scenarios) that maps directly onto the H-160 prediction: Channel-1/behavioral-signaling enforcement provides no guarantee once the agent's reasoning context is adversarial; Channel-2/structural enforcement does.

- **Why this is external validation, not just corroboration**: our evidence to date (EXP-155, EXP-110, EXP-115, EXP-131) is all *cooperative*-regime — the agent is trying to do the task. Parallax tests the *adversarial* regime (Assume-Compromise Evaluation). The Ch1=0% / Ch2≈100% split replicates at a regime we have never ourselves tested. See KE-212 §"What Parallax Tested That EXP-127 Did Not" for the contrast table.
- **Numerical alignment**: Parallax 98.9–100% (adversarial Ch2) vs EXP-155 100% (cooperative Ch2); Parallax 0% (adversarial Ch1) vs EXP-155 10% (cooperative Ch1, with lucky coincidences). The adversarial Ch1=0 is the sharper point prediction.
- **What's genuinely new**: Parallax's "Reversible Execution" stance (let action run, capture reversal state, validator can veto) and "Information Flow Control" (sensitivity labels through workflows) are Ch2 sub-types our enforcement taxonomy does not currently name. These don't change H-160's core claim but extend the *mechanism space* in which structural enforcement can be deployed (pre-commit gate is not the only shape). Noted here; formalization deferred to H-098 Ch2 sub-taxonomy work.

**P(H) update: 0.92 → 0.94**. Conservative delta (+0.02). Reasoning:
- Prior 0.92 was *already* high and tempered primarily by single-scenario/single-regime concerns. Parallax directly addresses the single-regime concern (cooperative → adversarial) with independent red-team data.
- P(data | H) ≈ 0.90 (if Ch2>Ch1 is a general structural property, a well-designed adversarial eval should find the same split — the result is almost what H-160 would predict if extended to adversarial). P(data | ¬H) ≈ 0.15 (if the effect were cooperative-task-specific, the adversarial 0% Ch1 result is harder to explain but not impossible — prompt-injection literature has mixed results).
- LR ≈ 6. Posterior on 0.92 prior: 0.92 × 6 / (0.92 × 6 + 0.08) ≈ 0.986. **Tempered to 0.94** because: (a) Parallax is infrastructure-layer enforcement, not workflow-gate enforcement — the mechanism class is related but not identical; (b) "interruptive steps" (H-160's operationalized claim) is not what Parallax tests — Parallax tests *any* reason→act transition; (c) we should not double-count an external study the way we'd count an internal experiment.
- Single-scenario concern from the prior update remains partially open (Parallax is a different task distribution, not a second internal scenario of our own).

### Remaining Caveats

1. **Single scenario**: Only tested on exp155-hidden-dep-hard-gate. Need replication on a different interruptive step type (e.g., "write investigation plan before coding," "document assumptions before architecture").
2. **Content confound**: The Ch2 gate included structured output instructions ("For EACH bug: name, file, location...") and hints ("MULTIPLE bugs"). Some of the quality improvement may come from instruction specificity, not just the gate mechanism.
3. **Small N**: 10 runs per treatment arm. While the effect is overwhelming (p < 0.0001), the confidence interval for the true rate is 69-100%.
4. **Scenario-gate fit**: The hidden-dependency task has a natural "investigate then fix" structure. Tasks where the interruptive step is more orthogonal to the primary objective may show weaker gate effects (per KE-135: unrelated gates degrade by 36pp).

### Next Experiments for Generalizability

1. **Cross-scenario replication**: Apply Ch2 gate to a different interruptive step type (e.g., "write ASSUMPTIONS.md before implementing" on an architecture task). Would test whether the gate mechanism generalizes beyond investigate-then-fix.
2. **Gate-only vs gate+hints**: Isolate the gate mechanism by testing Ch2 gate WITHOUT the content hints ("MULTIPLE bugs", structured output format). If gate-only still achieves ≥80%, the mechanism is truly structural, not instruction quality.
3. **Orthogonal-step test**: Apply Ch2 gate where the interruptive step is less naturally related to the primary task (e.g., "write risk assessment before implementing feature"). Tests the KE-135 gate relevance boundary.

---

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
| **EXP-155** | **Direct test — 100% Ch2 gate vs 10% Ch1 skill vs 15% baseline. Core prediction confirmed.** |
| **KE-177** | **Ch2 hard gates overcome selective compliance on interruptive process steps** |
| **KE-212 / DD-763 Parallax** | **External adversarial-regime validation — 98.9–100% Ch2 block vs 0% Ch1 under assume-compromise; independent red-team eval across 280 cases × 9 attack categories.** |

## Tags
`structural-enforcement` `behavioral-signaling` `interruptive-steps` `workflow-gates` `selective-compliance` `KE-176` `KE-174` `compliance-gradient` `guard-workflow-architecture`
