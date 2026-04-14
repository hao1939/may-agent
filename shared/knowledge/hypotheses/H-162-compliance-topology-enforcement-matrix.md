# H-162: Agent Compliance Follows a Behavioral Topology × Enforcement Mechanism Matrix

**Status**: Proposed  
**P(H)**: 0.80  
**Tier**: 1 (Empirically Grounded — 2 of 4 cells directly measured, remaining 2 have strong indirect evidence)  
**Created**: 2026-04-14  
**Author**: Bob  
**Derived from**: H-160 (Structural > Behavioral for Interruptive Steps), KE-176 (Selective Skill Compliance), KE-129 (Forced Externalization Only Reliable Channel), KE-174 (Governed Mutation / Alignment Tax), KE-091 (Alignment Tax), KE-106 (Guards Don't Train), KE-007 (Structural Enforcement Only Reliable Intervention), EXP-154, EXP-155

---

## Thesis

Agent compliance on any behavioral target is **predictable** from a 2×2 matrix of two orthogonal dimensions:

1. **Behavioral Topology**: Is the target behavior *additive* (rides the agent's existing action momentum) or *interruptive* (fights against it)?
2. **Enforcement Mechanism**: Is the behavior delivered via *behavioral signaling* (text instructions — Ch1/Ch3 skills, rules, examples) or *structural enforcement* (Ch2 gates, workflow phases, environmental state changes)?

The matrix produces four cells with distinct, predictable compliance regimes:

| | **Behavioral Signaling** (Ch1/Ch3) | **Structural Enforcement** (Ch2 gates/workflows) |
|---|---|---|
| **Additive Behavior** | **CELL A: HIGH (~80-100%)** — Text works because the instruction rides existing momentum. Low cost to comply, no interruption needed. | **CELL B: HIGH (≥95%) but unnecessary** — Structural enforcement succeeds trivially but imposes overhead (gate design, infrastructure cost) with marginal compliance gain over text. |
| **Interruptive Behavior** | **CELL C: VERY LOW (~0-15%)** — Text fails because the instruction fights the agent's dominant behavioral attractor. Action momentum overwhelms textual guidance. | **CELL D: HIGH (~85-100%)** — Structural enforcement succeeds because the architecture enforces sequencing. The agent never chooses whether to comply; the gate blocks progression until the interruptive action is complete. |

**The core predictive claim**: Knowing the behavioral topology and enforcement mechanism is sufficient to predict compliance within ±15pp. The critical insight is the **asymmetry**: enforcement mechanism matters enormously for interruptive behaviors (Cell C→D: +70-90pp) but barely for additive behaviors (Cell A→B: +0-20pp).

## Why This Matters

This matrix subsumes and generalizes H-160 (which covers only the C→D transition) into a complete predictive framework. It answers:

1. **When is structural enforcement worth the infrastructure cost?** Only for interruptive behaviors (Cell C→D). For additive behaviors (Cell A→B), text skills are sufficient and structural enforcement adds overhead without meaningful gain.
2. **Why do some skills work and others fail?** The skill type hierarchy (KE-021) is too coarse. The real predictor is behavioral topology — whether the skill's instructions require the agent to deviate from its natural workflow.
3. **Where should we invest engineering effort?** Identify which behaviors are interruptive (mandatory structural enforcement) vs. additive (text skill sufficient). This avoids both under-enforcement (Cell C: text on interruptive → failure) and over-enforcement (Cell B: gates on additive → wasted engineering).

## Mechanism

### Dimension 1: Behavioral Topology (Additive vs. Interruptive)

**Additive behaviors** are actions that ride the agent's existing action momentum. They extend the default workflow without requiring the agent to pause, redirect, or suppress its current trajectory.

Examples:
- "Run tests after editing" — extends the edit→verify cycle the agent naturally follows
- "Add a docstring when writing a function" — extends the write-code action
- "Grep for related files after reading the main file" — extends the investigation the agent is already doing

**Interruptive behaviors** are actions that fight the agent's dominant behavioral attractor. They require the agent to halt its current trajectory, perform a divergent action, and then resume.

Examples:
- "Write FINDINGS.md documenting all bugs BEFORE fixing any" — interrupts the "see bug → fix bug" attractor
- "Write a risk assessment BEFORE implementing the feature" — interrupts the "understand task → implement" attractor
- "Analyze contradictions in the requirements BEFORE coding" — interrupts the "read task → start coding" attractor

The topology is determined by the **deviation cost** — how much the instruction diverges from what the agent would do by default. This maps to KE-176's compliance gradient: deviation cost predicts compliance rate.

### Dimension 2: Enforcement Mechanism (Behavioral vs. Structural)

**Behavioral signaling** delivers instructions through text channels that the agent processes as input but is free to ignore. This includes:
- Ch1: System prompt skills, SOUL.md rules, injected context
- Ch3: Task message instructions, few-shot examples, worked examples

Behavioral signaling works by informing and requesting. The agent must allocate reasoning capacity to (a) recognize the instruction, (b) decide to comply, (c) override its default behavior. For additive behaviors, (b) is trivial — the instruction aligns with what the agent already wants to do. For interruptive behaviors, (b) fails — the "fix mode" attractor overwhelms the text instruction (KE-176).

**Structural enforcement** delivers requirements through environmental state changes that block progression unless the behavior occurs. This includes:
- Ch2: Workflow gates, phase transitions, required deliverables with existence checks
- Workflow architecture: Multi-phase workflows where Phase N+1 can't start until Phase N's deliverable exists
- Guard predicates: Automated checks that block `finish()` or tool calls unless conditions are met

Structural enforcement works by constraining the action space. The agent never faces a compliance "decision" — the architecture removes the non-compliant path. This is KE-174's structural verification regime: zero alignment tax because no reasoning capacity is consumed on the compliance decision itself.

### Why the Asymmetry Exists

The matrix's key prediction — enforcement mechanism matters for interruptive but not additive behaviors — follows from the mechanism:

- **Cell A (Additive + Behavioral)**: The text instruction asks the agent to do something it's already inclined to do. The instruction's content is enough — the agent sees "run tests after editing" and thinks "yes, that's sensible, I'll do that." No override is needed. Compliance is high.
- **Cell B (Additive + Structural)**: The gate enforces something the agent would already do. The gate triggers, the agent complies immediately (it was going to do it anyway), and the gate's overhead is pure infrastructure cost. Compliance is high but the gate added nothing behavioral.
- **Cell C (Interruptive + Behavioral)**: The text instruction asks the agent to stop its dominant trajectory. The agent reads "write FINDINGS.md before fixing" but is already in "fix mode." The instruction feels like generic advice vs. the concrete problem in front of it. The behavioral attractor wins. Compliance is very low.
- **Cell D (Interruptive + Structural)**: The gate physically blocks progression. The agent can't enter "fix mode" because Phase 2 hasn't started yet. The architecture enforces the sequencing that text couldn't. The agent writes FINDINGS.md because there's literally nothing else it can do in Phase 1. Compliance is high.

The asymmetry is mechanistic: structural enforcement adds value only when there's a compliance gap to close. Additive behaviors have no gap (text already works). Interruptive behaviors have a massive gap (text fails completely). Therefore structural enforcement's ROI is concentrated entirely in the interruptive column.

## Evidence Assessment

### Cell A (Additive + Behavioral): Measured — HIGH

| Evidence | Metric | Result |
|----------|--------|--------|
| EXP-154: "Run code after fixing" step in investigation skill | P4 (verify-after-fix) | **100% (10/10)** |
| EXP-154: Planning artifact (free-format, baseline) | P1 (planning-artifact-exists, baseline) | **~100% (20/20)** |
| KE-176: Additive process steps compliance | Predicted | **≥60%** |
| H-091/EXP-095: Few-shot behavioral delivery | Ch3 on behavior-escalation | **100% (6/6)** |

**Evidence quality**: Strong for one scenario (EXP-154 P4), moderate for second (EXP-095). The 100% figure from EXP-154 treatment arm is the cleanest measurement: agents adopted "run code after fixing" in all 10 runs despite ignoring the interruptive steps in the same skill.

### Cell B (Additive + Structural): Indirect — HIGH but unnecessary

No direct experiment exists where a structural gate was applied to an additive behavior. However:

| Evidence | Reasoning |
|----------|-----------|
| EXP-155: Phase 3 verify-after-fix (structural workflow) | 100% (10/10) — but this is also 100% in the Ch1 treatment arm (P4), so the gate adds 0pp |
| KE-134: Gate stacking hump curve | Related gates help, but adding more gates to already-compliant behaviors risks the ceiling overhead of KE-134 |
| KE-091: Alignment tax | Structural gates on additive behaviors would consume architecture design capacity without behavioral gain |

**Predicted**: ≥95% compliance, but with +0-5pp marginal gain over Cell A. The infrastructure cost exceeds the behavioral benefit.

### Cell C (Interruptive + Behavioral): Measured — VERY LOW

| Evidence | Metric | Result |
|----------|--------|--------|
| EXP-154: "Write FINDINGS.md before fixing" (Ch1 skill) | P1 (planning-artifact-exists) | **10% (1/10)** |
| EXP-155: Ch1 skill arm replication | Overall pass rate | **10% (1/10)** |
| EXP-127: Ch1 skill on contradictory-requirements judgment | Pass rate | **0% (0/18)** |
| KE-007: Text-based interventions across 56+ experiments | Promotion rate | **0/56** |
| KE-176: Interruptive process step compliance | Predicted | **~10%** |

**Evidence quality**: Very strong. EXP-154 (N=10), EXP-127 (N=18), and the meta-analysis of KE-007 (56+ experiments) all converge on the same finding: text instructions cannot override the agent's default trajectory for interruptive behaviors.

### Cell D (Interruptive + Structural): Measured — HIGH

| Evidence | Metric | Result |
|----------|--------|--------|
| EXP-155: Ch2 hard gate on FINDINGS.md (interruptive step) | Pass rate | **100% (10/10)** |
| EXP-127: Ch2 forced externalization on contradiction detection | Pass rate | **100% (10/10)** |
| EXP-043: Strict workflow on sycophancy elimination | Pass rate | **100% (9/9)** |
| EXP-110: FM-3.3 commit guard (interruptive: verify before commit) | Recovery rate | **73.5%** |
| EXP-115: FM-2.2 completeness guard | Improvement | **+100pp (0%→100%)** |

**Evidence quality**: Very strong. 29/29 (100%) across three independent experiments (EXP-155, EXP-127, EXP-043) on different task types. EXP-110 and EXP-115 provide production evidence on different agents and failure modes.

## The Complete Matrix with Data

| | **Behavioral Signaling** | **Structural Enforcement** | **C→D Effect Size** |
|---|---|---|---|
| **Additive** | **~100%** (EXP-154 P4: 10/10) | **~100%** (predicted; EXP-155 P4: 10/10) | **~0pp** (no gap to close) |
| **Interruptive** | **~10%** (EXP-154 P1: 1/10; EXP-127: 0/18) | **~100%** (EXP-155: 10/10; EXP-127 Ch2: 10/10; EXP-043: 9/9) | **+85-100pp** |
| **A→C Effect Size** | **−90pp** (topology drives the failure) | **~0pp** (structural enforcement equalizes) | |

**Key reading**: The bottom-left cell (Interruptive + Behavioral) is the danger zone — ~10% compliance despite explicit instructions. The entire knowledge base of failed text-based interventions (KE-007: 0/56) maps to this cell. The entire knowledge base of successful structural interventions (KE-007: 5/5 promoted) maps to the bottom-right cell.

## Specific Predictions

### P-162a: Additive + Structural ≈ Additive + Behavioral (Cell B ≈ Cell A)
- **Operationalization**: Take an additive behavior (e.g., "run tests after editing") and compare Ch1 skill delivery vs. Ch2 workflow gate delivery on the same scenario.
- **Prediction**: ≤10pp difference between the two conditions. Both achieve ≥80%. The gate adds overhead without meaningful behavioral gain.
- **Falsification**: >25pp gap (gate substantially improves even additive behaviors) would invalidate the "asymmetry is the key insight" claim. It would suggest enforcement mechanism matters equally for both topologies.

### P-162b: Interruptive + Behavioral < 20% across new scenarios (Cell C generalizes)
- **Operationalization**: Test a different interruptive behavior (e.g., "write ASSUMPTIONS.md before implementing an architecture task") delivered as a Ch1 skill. Must be on a scenario where the agent can successfully complete the task without the interruptive step (to prove it's the interruptive nature, not task difficulty, causing failure).
- **Prediction**: ≤20% compliance on the interruptive step. Consistent with EXP-154's 10% and EXP-127's 0%.
- **Falsification**: >40% would suggest EXP-154's 10% was scenario-specific rather than topology-driven.

### P-162c: The diagonal predicts better than skill type alone
- **Operationalization**: Take a "process skill" (KE-021's middle tier) and decompose it into additive and interruptive components. Predict compliance for each component using the matrix, not the skill's type label.
- **Prediction**: Component-level predictions (topology × mechanism) explain >80% of variance in compliance. Skill type label alone explains <50%.
- **Falsification**: If skill type (process vs. judgment vs. knowledge) predicts equally well regardless of topology, then behavioral topology is not the dominant dimension.

### P-162d: The matrix predicts a new experiment's outcome
- **Operationalization**: Design an experiment testing Cell B directly — apply a Ch2 gate to a known-additive behavior. The matrix predicts ≥95% compliance but ≤10pp gain over text-only delivery.
- **Prediction**: ≥90% in both conditions, ≤10pp difference.
- **Falsification**: If the gate substantially improves compliance on an additive behavior (>20pp gain), Cell B is more valuable than predicted and the asymmetry claim weakens.

## Boundary Conditions

### Where the matrix should predict well:
- **Standard development tasks**: Bug-fixing, feature implementation, investigation — where agents have clear "default trajectories" that define additive/interruptive
- **Process behaviors**: Steps with observable compliance criteria (file exists, test runs, artifact produced)
- **Single-agent sessions**: Where the agent's behavioral attractor is the primary force

### Where the matrix may break down:

1. **Ambiguous topology**: Some behaviors are neither clearly additive nor interruptive. E.g., "write better commit messages" — this extends the existing commit action (additive) but requires stopping to think about message quality (interruptive). Prediction: intermediate compliance (~40-60%), harder to predict.

2. **Discovery/creative tasks**: H-099 established that discovery tasks resist ALL interventions. The matrix may correctly predict Cell D compliance (gate forces the action) but the forced action's quality may be low. Structural enforcement ensures the artifact exists, not that it's insightful. The matrix predicts compliance, not quality.

3. **Multi-step compound behaviors**: A behavior with 5 steps, some additive and some interruptive, will show partial compliance (KE-176's selective adoption). The matrix predicts each component separately; the overall compliance depends on which components are critical for the measured outcome.

4. **Very high task difficulty**: KE-091 showed alignment tax on high-complexity tasks. If the interruptive step itself is very costly (e.g., "write a 500-line analysis before proceeding"), even structural enforcement may succeed on compliance (Cell D) but degrade primary task performance. The matrix predicts compliance, not net task success.

5. **Gate relevance effects**: KE-135 showed that unrelated gates degrade performance by 36pp vs. related gates. If the interruptive behavior feels orthogonal to the task, the gate may force compliance but at a higher cost. The topology dimension may need a third category: "orthogonal" (neither additive nor interruptive but unrelated).

## Relationship to H-160

H-162 **subsumes** H-160. H-160's core claim — "structural enforcement outperforms behavioral signaling for interruptive steps by >60pp" — is exactly the Cell C → Cell D transition in the matrix. H-160 is the special case of H-162 restricted to interruptive behaviors.

H-162 adds:
- **The additive row**: H-160 doesn't address additive behaviors. H-162 predicts that the enforcement mechanism is irrelevant for additive behaviors (Cell A ≈ Cell B), which is the key insight for resource allocation.
- **The asymmetry claim**: The matrix's predictive power comes from the interaction effect, not the main effects. Neither "structural enforcement is always better" (Cell B says sometimes it's unnecessary) nor "interruptive behaviors always fail" (Cell D says structural enforcement rescues them).
- **A prescriptive decision framework**: Given a new behavioral target, classify its topology → if interruptive, invest in structural enforcement; if additive, use text skills and save engineering resources.

H-160 remains valid as a standalone hypothesis with its own empirical support (EXP-155). If H-162 is confirmed, H-160 becomes a corollary. If H-162 is disconfirmed (e.g., Cell B turns out to be much better than Cell A), H-160's narrower claim about the interruptive column still stands.

## Relationship to H-161

H-161 (Artifacts Serve Dual Functions: Memory Compression + Behavioral Forcing) provides the **mechanistic explanation** for why Cell D works. When a structural gate forces artifact production:
- **F2 (Behavioral Forcing)**: The act of writing interrupts the agent's momentum — this is WHY Cell D achieves high compliance on interruptive behaviors
- **F1 (Memory Compression)**: The artifact persists for downstream use — this is a bonus benefit of structural enforcement that behavioral signaling can't provide (no artifact is produced in Cell C because the agent skips the step)

H-162 is the predictive framework; H-161 is the mechanistic theory underlying the interruptive column.

## Relationship to the Guard-Workflow Architecture

The matrix directly informs the guard-workflow architecture design:

1. **Gate selection**: Only apply workflow gates to interruptive behaviors. Additive behaviors get text-based skills (cheaper, equally effective).
2. **Guard ROI estimation**: Before building a new guard, classify the target behavior as additive or interruptive. If additive, don't build the guard — write a skill file instead.
3. **System-level prediction**: For any proposed behavioral intervention, the matrix predicts whether it will work before spending the engineering effort to build and test it.

## Connection to KE-174 (Alignment Tax)

KE-174 distinguishes behavioral verification (alignment tax present) from structural verification (alignment tax absent). The matrix extends this:

- **Cell A**: Behavioral signaling, no alignment tax (additive behavior → low cognitive cost to comply)
- **Cell B**: Structural enforcement, no alignment tax (but unnecessary infrastructure cost)
- **Cell C**: Behavioral signaling, alignment tax is IRRELEVANT (compliance is so low the agent never even attempts the behavior, so the tax question doesn't arise)
- **Cell D**: Structural enforcement, no alignment tax (KE-174's structural verification regime — agent doesn't choose to comply, architecture enforces it)

The alignment tax is most relevant in borderline cases between additive and interruptive, where the agent sometimes complies (consuming capacity on the compliance decision) and sometimes doesn't.

## Prior Probability: P(H) = 0.80

### For (strong):
- **Cells C and D directly measured**: EXP-154 (Cell C: 10%), EXP-155 (Cell D: 100%), EXP-127 (Cell C: 0%, Cell D: 100%), EXP-043 (Cell D: 100%). The interruptive column has overwhelming evidence: 29/29 structural vs. 2/28 behavioral.
- **Cell A directly measured**: EXP-154's P4 result (100% compliance on additive verify-after-fix step via text skill) cleanly measures Cell A.
- **Meta-analysis convergence**: KE-007's 0/56 failed text interventions map to Cell C. 5/5 promoted structural interventions map to Cell D. The matrix explains the entire 56-experiment record.
- **Mechanistic grounding**: KE-176 (selective compliance gradient), KE-129 (Ch2 only reliable channel), KE-174 (structural ≠ behavioral verification), and H-161 (dual artifact functions) all converge on the same two-dimensional framework.
- **Practical utility**: The matrix has already correctly predicted every compliance result we've measured. If it's wrong, a LOT of convergent evidence is wrong.

### Against (honest uncertainty):
- **Cell B is untested**: No experiment has directly tested structural enforcement on an additive behavior. The prediction (high but unnecessary) is extrapolation, not measurement. If Cell B is substantially higher than Cell A (e.g., 100% vs. 60%), the asymmetry claim weakens.
- **Topology classification is subjective**: "Additive" vs. "interruptive" is defined by deviation from the agent's default trajectory, but different agents/tasks may have different default trajectories. What's interruptive for one agent may be additive for another. The topology dimension may not be as clean as the matrix implies.
- **Single scenario dominance**: Most interruptive-column evidence comes from one scenario family (hidden-dependency / contradictory-requirements). Cross-scenario replication is needed.
- **Compliance ≠ quality**: The matrix predicts compliance rates, not task outcomes. Cell D achieves high compliance, but H-099 suggests that on discovery tasks, forced compliance may not produce quality outputs. The matrix might overstate the practical value of structural enforcement if compliance-without-quality is common.
- **Two dimensions may be insufficient**: The matrix omits task difficulty (KE-091), gate relevance (KE-135), and behavior specificity. A 2×2 may be too simple for the full compliance landscape.

### Net: P(H) = 0.80
The two measured cells (C and D) have overwhelming evidence. Cell A has strong evidence. Cell B is reasonably extrapolated. The main risks are taxonomy clarity and quality-beyond-compliance. Tempered from a naive Bayesian posterior of ~0.90+ to 0.80 for the untested cell and boundary condition concerns.

## Proposed Experiments

### EXP-162a: Cell B Direct Test (Additive + Structural)
**Design**: Take the "verify-after-fix" behavior (additive, already 100% in Cell A via text) and implement it as a structural workflow gate. Compare:

| Arm | Condition | N | Expected |
|-----|-----------|---|----------|
| A | Text skill: "run tests after editing" | 10 | ~100% (Cell A baseline) |
| B | Workflow gate: Phase 3 blocks until test output exists | 10 | ~100% (Cell B prediction) |

**Primary metric**: Verify-after-fix compliance rate
**Secondary metrics**: Time to completion, primary task pass rate
**Expected result**: Both arms ≥90%, difference ≤10pp. Confirms Cell B = Cell A.
**If Cell B >> Cell A**: The asymmetry claim weakens; structural enforcement adds value even for additive behaviors.

### EXP-162b: Cross-Scenario Interruptive Replication
**Design**: Test a different interruptive behavior on a different scenario type:
- Behavior: "Write ASSUMPTIONS.md listing all design assumptions BEFORE implementing"
- Scenario: An architecture task (not a bug-fixing task)
- Delivery: Ch1 skill (Cell C prediction: ≤20%) vs. Ch2 gate (Cell D prediction: ≥80%)

| Arm | Condition | N | Expected |
|-----|-----------|---|----------|
| A | Ch1 skill with ASSUMPTIONS.md instruction | 10 | ≤20% |
| B | Ch2 gate requiring ASSUMPTIONS.md existence | 10 | ≥80% |

**Tests**: P-162b (Cell C generalizes) and cross-scenario replication for Cell D.

### EXP-162c: Topology Boundary Test
**Design**: Test a behavior at the additive/interruptive boundary (e.g., "write better commit messages" — partially additive, partially interruptive):

| Arm | Condition | N | Expected |
|-----|-----------|---|----------|
| A | Text skill: "write descriptive commit messages" | 10 | ~40-60% (boundary prediction) |
| B | Structural gate: commit message must match pattern | 10 | ≥80% |

**Tests**: Whether the matrix can predict compliance for ambiguous-topology behaviors.

## Next Steps

1. **Priority**: EXP-162a (Cell B test) — this is the cheapest experiment (~$1) and tests the matrix's weakest prediction
2. **Medium**: EXP-162b (cross-scenario replication) — validates generalizability of Cells C and D
3. **Later**: EXP-162c (boundary test) — refines the topology dimension

## Cross-References

| Entry | Relationship |
|---|---|
| **H-160** | Subsumed — H-160's claim is the Cell C→D transition in this matrix |
| **H-161** | Mechanistic complement — explains WHY Cell D works (dual artifact functions) |
| **KE-176** | Primary evidence — selective compliance gradient IS the topology dimension |
| **KE-129** | Primary evidence — Ch2 vs Ch1 hierarchy IS the enforcement dimension |
| **KE-174** | Theoretical framework — structural vs. behavioral verification maps to the enforcement dimension |
| **KE-091** | Boundary condition — alignment tax applies at the additive/interruptive boundary and on high-complexity tasks |
| **KE-106** | Supports — guards don't train (Cell D is permanent infrastructure, not temporary training) |
| **KE-007** | Meta-evidence — 56-experiment record maps perfectly onto the matrix |
| **KE-021** | Refined — skill type hierarchy is secondary to behavioral topology |
| **KE-135** | Boundary condition — gate relevance moderates Cell D effectiveness |
| **H-099** | Boundary condition — discovery tasks resist all enforcement; Cell D predicts compliance but not quality |
| **H-098** | Channel Theory — enforcement dimension maps to channel hierarchy |
| **EXP-154** | Cell A and Cell C measurements |
| **EXP-155** | Cell D measurement |
| **EXP-127** | Cell C and Cell D measurements |
| **EXP-043** | Cell D measurement |
| **EXP-110** | Cell D production evidence |
| **EXP-115** | Cell D production evidence |
| **guard-workflow-architecture.md** | Design implication — gates only for interruptive behaviors |

## Tags
`compliance-matrix` `behavioral-topology` `enforcement-mechanism` `additive-interruptive` `structural-behavioral` `predictive-framework` `selective-compliance` `KE-176` `KE-129` `KE-174` `H-160` `H-161`
