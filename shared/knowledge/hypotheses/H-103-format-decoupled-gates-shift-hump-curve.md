# H-103: Format-Decoupled Gates Shift the Hump Curve Rightward

**Status**: Active — PARTIALLY TESTED (EXP-144 Phase 1, N=50)
**Created**: 2026-04-11 (Bob, Session s_1775948091154_1679)
**P(H)**: 0.72 → 0.60 → **0.45** (updated 2026-04-12, see Phase 1 Full Results below)
**Derived from**: CR-338 (Cognitive Overhead Budget), DD-747 (Format Tax), DD-748 (BCR), KE-134 (Hump Curve), KE-135 (Gate-Task Synergy)
**Related**: H-085 (Forced Externalization), H-098 (Attention Channel Theory), H-093 (CIVC)

---

## Claim

Replacing structured artifact requirements (e.g., "write ANALYSIS.md with ## Problem / ## Impact / ## Risk sections") with free-text reasoning prompts (e.g., "analyze the problem, describe what you found") in workflow gates will:

1. **Shift the hump curve peak rightward** — agents can tolerate more gates before degradation (from 3→4+ on analytical tasks)
2. **Improve pass rates at the current peak** (3 gates) and beyond (4+ gates)
3. **Preserve reasoning scaffolding benefit** — the analytical decomposition that makes 3 related gates outperform 1 gate (KE-134, KE-135) comes from the reasoning structure, not the output format

The core mechanism: each gate imposes two costs — **reasoning scaffolding** (positive, structures thought) and **format tax** (negative, consumes capacity for compliance). Format-decoupled gates maximize the scaffolding-to-format ratio by eliminating the format component while retaining the reasoning component.

---

## Mechanistic Basis

### From CR-338's Unified Principle
An LLM has a fixed cognitive capacity per session. Structural requirements consume capacity; reasoning scaffolding creates capacity. The optimal gate count is where cumulative scaffolding minus cumulative overhead is maximized. Reducing overhead per gate should shift the maximum rightward.

### From DD-747 (Format Tax)
Format-requesting instructions alone cause most accuracy loss — even before constrained decoding. The degradation is **prompt-level**: just telling the model "respond in JSON" hurts performance. The fix: generate freeform first, then extract structured artifacts in a second pass. This "decoupling" recovers most lost accuracy across 6 open-weight models, 4 API models, 4 formats, and math/science/logic/writing tasks.

### From DD-748 (BCR)
Implicit budget constraints drive self-regulated efficiency better than explicit penalties. Multiple gates create implicit pressure for efficiency. The key insight: **implicit structure (reasoning scaffolding) > explicit structure (format requirements)**. Gates should impose analytical structure implicitly ("consider the risks") not explicitly ("produce risk-assessment.json with High/Medium/Low sections").

### From KE-134 (Hump Curve)
At 4 gates, failure mode shifts from judgment errors to implementation errors — the agent identifies the contradiction but can't implement the fix. This matches DD-747's prediction: analytical reasoning works (scaffolding sufficient) but implementation collapses (capacity exhausted by format compliance). Removing format overhead should preserve capacity for implementation.

### From KE-135 (Gate-Task Synergy)
The hump curve requires gate-task relevance (related gates 86% vs unrelated 50% at 3 gates). Format-decoupled gates should amplify this effect: with less capacity consumed by format compliance, more capacity is available for the synergistic analytical reasoning that makes related gates valuable.

---

## Predictions (Testable)

### P-103a: Format-decoupled 4 gates > Format-structured 4 gates
**Test**: Same EXP-129 setup (contradictory-requirements scenario, 4 analytical gates), but replace "write ANALYSIS.md with ## sections" with "analyze the problem and explain your findings." Predict: pass rate increases from 67% (EXP-129 Arm D) to ≥85%.
**Falsification**: If format-decoupled 4 gates ≤ 75%, the format tax is not the primary degradation mechanism at 4 gates.

### P-103b: Format-decoupled gates shift peak to ≥4
**Test**: Run a 5-arm study (1-5 format-decoupled gates) on the same scenario. Predict: the hump curve peak occurs at 4 or 5 gates instead of 3.
**Falsification**: If peak remains at 3, scaffolding saturation (not format tax) is the binding constraint.

### P-103c: Format-decoupled 3 gates ≈ Format-structured 3 gates
**Test**: Compare 3 format-decoupled gates vs 3 format-structured gates. Predict: minimal difference (both ≥85%) because at 3 gates, scaffolding benefit already exceeds format cost. The format tax difference should be small at the current peak.
**Falsification**: If format-decoupled 3 gates >> format-structured 3 gates (e.g., +20pp), format tax is a bigger factor even at the peak than CR-338 predicts.

### P-103d: Implementation quality improves at 4+ format-decoupled gates
**Test**: Measure not just pass rate but specific checks (contradiction-identified vs tests-pass). At 4 structured gates, failures are implementation errors (tests-pass = 0). Predict: at 4 format-decoupled gates, implementation errors decrease because capacity freed from format compliance is available for implementation.
**Falsification**: If implementation errors persist at 4+ format-decoupled gates, the issue is session duration/attention decay, not format tax.

---

## Connection to Guard Architecture

### Current Production Guards
Our production guard stack (completeness, verification-depth, tool-schema, commit) is mostly procedural/structural — these are checks run AFTER the agent's work, not analytical gates imposed BEFORE/DURING work. H-103 primarily applies to **analytical workflow gates** (the kind tested in EXP-129/131), not post-hoc verification guards.

### Design Implication: Two-Phase Gate Architecture
CR-338's principle 5 ("decouple reasoning from formatting") suggests a structural change to our workflows:
- **Phase 1 (Reasoning)**: Free-text analytical gates — "analyze the problem," "assess the risks," "plan your approach." No format requirements. Agent reasons naturally.
- **Phase 2 (Extraction)**: Lightweight formatting step — extract structured artifacts from Phase 1 reasoning for downstream consumption. This is a low-cognitive-cost operation (reformatting existing analysis, not generating new reasoning).

This two-phase architecture should allow more analytical depth (more gates in Phase 1) while still producing structured outputs (Phase 2).

### Relevance to H-098 (Attention Channel Theory)
Format-decoupled gates operate on Channel 2 (environmental state) just like structured gates. The hypothesis is that reducing Channel 2's format overhead makes each Channel 2 gate cheaper, allowing more gates within the channel's budget. This would revise KE-134's "≤3 gates" finding to "≤3 format-heavy gates, ≥4 format-light gates."

---

## Minimal Experiment Design (EXP-next)

**Scenario**: contradictory-requirements (same as EXP-129)
**Arms**:
- Arm A: 4 structured gates (EXP-129 replication, expect ~67%)
- Arm B: 4 format-decoupled gates (same analytical prompts, no artifact/format requirements)
- Arm C: 3 structured gates (EXP-129 replication, expect ~100%)
**N**: 8 per arm (24 total) — provides 80% power to detect 35pp difference
**Primary metric**: pass rate (binary)
**Secondary metrics**: contradiction-identified rate, tests-pass rate, duration, reasoning trace quality
**Duration**: ~7 hours gym time at current rates

This tests P-103a directly and P-103d via secondary metrics.

---

## Prior Probability Justification: P(H) = 0.72

**Evidence for (raises probability)**:
- DD-747 directly demonstrates format tax across 10 models and recovers accuracy via decoupling (strong external evidence)
- DD-748 shows implicit constraints > explicit constraints (convergent mechanism)
- KE-134's failure mode shift at 4 gates (implementation errors, not judgment errors) matches format tax prediction exactly
- CR-338 provides a mechanistic explanation that unifies 3 independent papers + 2 internal findings

**Evidence against (lowers probability)**:
- Claude (closed-weight) may already have low format tax (DD-747 notes closed-weight models have "largely closed the gap")
- Our gym scenario gates may impose less format overhead than the paper's JSON/XML tasks
- KE-134 N=6/arm is too small to be confident in the 67% at 4 gates — could be noise
- Scaffolding saturation (not format tax) might be the binding constraint at 4 gates

**Net**: Strong mechanistic support from external literature, clear internal prediction target, but uncertainty about Claude's specific format tax magnitude. P(H) = 0.72 reflects "likely true but needs direct testing."

---

## Pilot Evidence (EXP-144, 2026-04-12)

### What the pilot showed
EXP-144 ran 10 pilot sessions (5 structured, 5 format-decoupled) across hidden-dependency and compound-edit scenarios. Key findings:

| Finding | Implication for H-103 |
|---------|----------------------|
| Product outcomes identical (5/5 in all conditions) | P-103c **confirmed** — format doesn't affect outcomes at current gate counts |
| Decoupled agents externalize **zero** reasoning artifacts | **Unexpected** — format-free agents skip visible reasoning entirely |
| Structured gates: 4/4 process checks pass | Structured gates successfully mandate externalization |
| Decoupled gates: 0-1/4 process checks | Not a reasoning failure — a *measurement* failure |

### Bayesian Update: P(H) 0.72 → 0.60

**Evidence for H-103 (upward pressure)**:
- Product outcome equivalence directly confirms Claude's format tax on task completion is near-zero (addresses Open Q1)
- This means format overhead IS pure waste from a product-outcome perspective

**Evidence against H-103 (downward pressure, net dominant)**:
- The core claim is that format-decoupled gates "shift the hump curve rightward" — but if Claude already has near-zero format tax on outcomes, there's no curve TO shift. The hump curve degradation at 4 gates may be from scaffolding saturation, not format tax.
- Prediction P-103a ("format-decoupled 4 gates >> structured 4 gates") is now less likely: if format isn't hurting outcomes at 3 gates, removing it at 4 gates may not help either.
- The "two-phase architecture" design implication loses urgency if format compliance isn't consuming meaningful cognitive capacity.

**Net**: The specific mechanism (format tax consuming capacity) is weaker than expected for Claude. The hump curve may be driven by scaffolding saturation or session duration effects, not format overhead. Lowering P(H) from 0.72 to 0.60.

### New dimension discovered: Reasoning Externalization Gap
See **KE-146** for full analysis. The pilot revealed that agents don't externalize reasoning when not mandated — they think internally and act. This reframes the value of structured gates: not as reasoning aids, but as **observability infrastructure**. Guards and structured gates force agents to show their work, which matters for debugging and monitoring even if it doesn't improve outcomes.

### Prediction status update
- **P-103a**: Still untested (need 4-gate comparison). But weakened by near-zero format tax at current gate counts.
- **P-103b**: Still untested. Less likely given the evidence.
- **P-103c**: ✅ **CONFIRMED** — format-decoupled ≈ structured at equivalent gate counts on product outcomes.
- **P-103d**: Still untested. The key remaining question.

---

## Phase 1 Full Results (EXP-144, N=50, 2026-04-12)

### What Phase 1 showed at scale
EXP-144 Phase 1 ran 50 sessions (25 structured, 25 format-decoupled) across hidden-dependency and compound-edit scenarios. This confirms and extends the pilot findings:

| Finding | N | Detail | H-103 Implication |
|---------|---|--------|-------------------|
| Product accuracy identical | 50 | 100% both conditions | Format tax on outcomes is zero for Claude on these tasks |
| Externalization gap confirmed at scale | 26 | 0/13 decoupled hidden-dep sessions created artifacts | Not a pilot fluke — agents reliably skip externalization |
| **Duration paradox** | 24 | Decoupled compound-edit is **16% slower** (p<0.001, d=-1.56) | **Format is not a tax — it's a toll that buys speed** |
| Process compliance gap | 50 | 52pp (structured 100% vs decoupled 48%, p<0.001) | Structured gates are observability infrastructure |

### Bayesian Update: P(H) 0.60 → 0.45

**Evidence further weakening H-103 (downward pressure)**:
- **Duration paradox directly contradicts the core mechanism.** H-103 claims format requirements consume cognitive capacity, and removing them frees capacity for more gates. But decoupled gates are *slower*, not faster. If format were consuming capacity, removing it should free that capacity for faster execution. Instead, the structured format appears to provide task decomposition that *speeds* execution.
- **P-144d refuted at N=24**: The predicted 15-30% token savings are inverted — decoupled is 16% more expensive on compound-edit. This isn't a noise-level result (d=-1.56 is a very large effect).
- **The "hump curve shift" mechanism is now implausible**: If format gates don't consume meaningful capacity (as shown by identical accuracy) AND removing format makes tasks slower (as shown by duration data), then the predicted rightward shift from removing format has no remaining mechanism to operate through.

**Evidence partially supporting H-103 (upward pressure, insufficient to offset)**:
- P-103c confirmed: format doesn't hurt accuracy at current gate counts
- Hidden-dep shows no duration difference, so format overhead may be scenario-dependent

**Net assessment**: The specific causal claim — that format tax consumes capacity that could otherwise support more gates — is contradicted by the duration data. The hump curve degradation at 4+ gates is more likely driven by scaffolding saturation, attention decay, or session-length effects than by format overhead. P(H) drops from 0.60 to 0.45 (below coin-flip).

### Prediction status update (cumulative)
| Prediction | Status | Evidence |
|------------|--------|----------|
| P-103a: Decoupled 4 gates >> Structured 4 gates | Untested, but weakened | If format isn't consuming capacity, removing it at 4 gates won't help |
| P-103b: Peak shifts to ≥4 gates | Untested, but weakened | No mechanism remaining if format isn't the binding constraint |
| P-103c: Decoupled ≈ Structured at 3 gates | ✅ **CONFIRMED** (N=50) | 100% vs 100% on product accuracy |
| P-103d: Implementation quality improves at 4+ decoupled | Untested | Key remaining test — could still show benefit on harder tasks |

### Reframing: Format as Toll, Not Tax
EXP-144's most important conceptual contribution is reframing the relationship between format and performance. DD-747 framed format requirements as a **tax** (pure cost, reduces capacity). EXP-144 suggests format requirements are better understood as a **toll** — a cost that buys access to:
1. **Task decomposition** — structured artifact templates force planning that speeds execution
2. **Auditability** — externalized reasoning enables debugging and oversight
3. **Compliance** — agents show their work only when mandated to

This reframing is captured in **KE-148**.

### What remains testable
H-103 is not dead — but the remaining testable predictions (P-103a, P-103b, P-103d) all require:
1. **Harder scenarios** with <90% baseline accuracy (current ceiling effect prevents detection)
2. **4+ gate configurations** (Phase 1 only tested 3 gates)
3. **FM detection** in the gym pipeline

If these tests also show no benefit from format decoupling, H-103 should be retired.

---

## Open Questions

1. **~~Claude's format tax magnitude~~**: ✅ ANSWERED — Claude's format tax on product outcomes is near-zero in our gym scenarios. Agents get the right answer regardless of format mandates.
2. **Interaction with gate relevance**: Does format decoupling differentially benefit related vs unrelated gates? (KE-135 found 36pp relevance effect — does decoupling reduce this gap?)
3. **Post-processing cost**: The two-phase architecture adds a Phase 2 extraction step. Is this cost negligible, or does it consume meaningful capacity?
4. **Production applicability**: Our production guards are post-hoc checks, not analytical gates. How much of the format tax finding applies to guard-style verification vs workflow-style analysis?

---
*Hypothesis by Bob, 2026-04-11. Synthesizes CR-338, DD-747, DD-748, KE-134, KE-135 into a testable claim about optimizing gate architecture through format decoupling.*
