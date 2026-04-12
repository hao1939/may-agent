# EXP-144: Format-Decoupled Gates

**Status**: PHASE 1 COMPLETE — see [results.md](./results.md)  
**Tests**: H-103 (Format-Decoupled Gates Shift Hump Curve Rightward)  
**Author**: Bob  
**Date**: 2026-04-11  
**Related**: CR-338 (Cognitive Overhead Budget), DD-747 (The Format Tax), EXP-143 (methodology reference)

---

## 1. Background & Motivation

### The Format Tax Problem (DD-747)
Workflow gates that require structured artifacts (specific markdown formats, required sections, enumerated fields) impose cognitive overhead beyond the reasoning they scaffold. This "format tax" manifests as:
- Token waste on formatting compliance rather than problem-solving
- FM-2.6 (reasoning-action mismatch) when agents focus on artifact structure over task logic
- FM-3.3 (verification failures) when verification becomes "does the format match" rather than "is the reasoning sound"

### The Hump Curve (CR-338)
CR-338 established that cognitive overhead follows a hump curve: some structure improves performance (scaffolding benefit), but too much degrades it (format tax). The optimal point depends on task complexity and gate count.

### H-103: Format-Decoupled Gates
H-103 predicts that replacing structured artifact requirements with free-text reasoning prompts at workflow gates will:
- Preserve the scaffolding benefit (the gate still forces a reasoning pause)
- Eliminate the format tax (no specific structure to comply with)
- Shift the hump curve rightward (more gates can be added before overhead becomes harmful)

## 2. Research Questions

1. **Primary**: Do format-decoupled gates preserve task accuracy while reducing FM rates compared to structured gates?
2. **Secondary**: Does the performance-vs-gate-count curve shift rightward (i.e., can you add more format-decoupled gates before performance degrades)?
3. **Exploratory**: What is the token usage difference between conditions, and does it correlate with FM rate reduction?

## 3. Experimental Design

### 3.1 Independent Variables

**Factor A: Gate Type** (2 levels)
- **Structured Gates** (control): Gates require specific artifact formats (e.g., "produce a plan with sections: Objective, Steps, Risk Assessment, Success Criteria in markdown table format")
- **Format-Decoupled Gates** (treatment): Gates prompt free-text reasoning (e.g., "Before proceeding, explain your plan: what you'll do, why, what could go wrong, and how you'll know it worked")

**Factor B: Gate Count** (4 levels)
- 2 gates (minimal workflow)
- 3 gates (standard workflow — current baseline)
- 4 gates (heavy workflow)
- 5 gates (extreme workflow)

This is a **2 × 4 factorial design** = 8 conditions.

### 3.2 Gate Definitions

For each gate count level, gates are placed at equivalent decision points:

| Gates | Placement |
|-------|-----------|
| 2 | Plan, Verify |
| 3 | Plan, Execute-checkpoint, Verify |
| 4 | Plan, Pre-execute review, Execute-checkpoint, Verify |
| 5 | Plan, Pre-execute review, Mid-execute checkpoint, Post-execute review, Verify |

**Structured gate example (Plan gate, 3-gate workflow):**
```
## Phase 1: Analyze & Plan
Produce a plan document with these sections:
- **Objective**: One-sentence goal
- **Files to modify**: Bulleted list with paths
- **Steps**: Numbered sequence of actions
- **Risk assessment**: Table with columns: Risk | Likelihood | Mitigation
- **Success criteria**: Bulleted checklist
Format: Markdown. All sections required.
```

**Format-decoupled gate equivalent:**
```
## Phase 1: Think Through Your Approach
Before writing any code or making changes, explain:
- What are you trying to accomplish and why?
- What will you need to read or change?
- Walk through your approach step by step.
- What could go wrong? How will you check your work?
Write your thinking in whatever format is clearest to you.
```

### 3.3 Dependent Variables

**Primary metrics:**
| Metric | Measurement | Source |
|--------|-------------|--------|
| Task accuracy | Binary: did the task complete correctly? | Manual evaluation |
| FM rate | Count of failure modes per session | Automated FM detection |
| FM-2.6 rate | Reasoning-action mismatch specifically | Automated FM detection |
| FM-3.3 rate | Verification failures specifically | Automated FM detection |

**Secondary metrics:**
| Metric | Measurement | Source |
|--------|-------------|--------|
| Total tokens | Input + output tokens per session | Session logs |
| Gate-phase tokens | Tokens spent within each gate phase | Session logs (phase boundaries) |
| Tool call count | Total tool calls per session | Session logs |
| Time to completion | Wall-clock session duration | Session timestamps |

**Exploratory metrics:**
| Metric | Measurement | Source |
|--------|-------------|--------|
| Reasoning quality | Qualitative rating (1-5) of gate-phase reasoning | Manual review (blinded) |
| Format compliance overhead | Tokens spent on formatting vs reasoning content | Manual annotation (sample) |

### 3.4 Scenarios

Select gym scenarios that naturally exercise multi-gate workflows. Criteria:
- Must involve planning + execution + verification phases
- Must have clear success/failure criteria for task accuracy
- Must be complex enough that gate scaffolding matters (simple tasks won't show effects)

**Recommended scenario pool** (from existing gym):
1. **KB integration tasks** — multi-file edits requiring plan, execute, verify
2. **Design document tasks** — research synthesis requiring analysis, drafting, review
3. **Bug fix workflows** — diagnosis, implementation, verification
4. **Experiment analysis** — data reading, analysis, write-up

Use **4 distinct scenario types** to avoid scenario-specific confounds. Each scenario is run under all 8 conditions.

### 3.5 Sample Size

**Power analysis based on EXP-143 effect sizes:**

EXP-143 observed effect sizes in the range of d = 0.4–0.6 for checkpoint-related improvements. For a 2×4 factorial:
- Target: 80% power, α = 0.05, minimum detectable effect d = 0.4
- Per-cell n: **25 sessions**
- Total: 8 conditions × 25 = **200 sessions**
- With 4 scenario types: 200 / 4 = 50 per scenario type (balanced)

**Cost estimate** at $0.10/session average:
- 200 × $0.10 = **$20 total**
- Can run in batches of 50 (one scenario type at a time)

**Phase approach** (if budget-constrained):
- **Phase 1**: 2 conditions only (structured vs decoupled at 3 gates), N=50. Tests primary question.
- **Phase 2**: Full factorial if Phase 1 shows signal. Tests gate-count interaction.

## 4. Implementation

### 4.1 Workflow Modification

The experiment modifies the `reviewed-delivery` workflow (or equivalent multi-gate workflow) to create both conditions:

**Control (structured gates):** Current workflow as-is — gates specify artifact format requirements.

**Treatment (format-decoupled gates):** Same workflow with modified gate prompts:
1. Remove all format specifications (markdown structure, required sections, table formats)
2. Replace with open-ended reasoning prompts that cover the same conceptual ground
3. Keep the gate boundary itself (still a pause point between phases)
4. Keep phase budget limits unchanged

**Key constraint**: The reasoning *topics* must be equivalent between conditions. Only the *format requirement* differs. Both conditions ask the agent to think about the same things (plan, risks, verification); they differ only in whether a specific output format is mandated.

### 4.2 Concrete Gate Transformations

For each existing structured gate, create a format-decoupled equivalent:

| Gate Type | Structured Version | Format-Decoupled Version |
|-----------|-------------------|--------------------------|
| Plan | "Produce plan with Objective, Steps, Risks (table), Criteria (checklist)" | "Think through what you'll do, why, what could go wrong, how you'll verify" |
| Pre-execute | "List files to modify with before/after descriptions in table format" | "Review what you're about to change and explain your reasoning" |
| Checkpoint | "Report progress: completed items (checklist), remaining items, blockers (table)" | "Pause and reflect: what's done, what's left, any surprises or course corrections?" |
| Verify | "Complete verification matrix: Deliverable × Check × Status (table)" | "Check each thing you produced — does it work? Does it match the goal? What could you have missed?" |

### 4.3 Randomization & Controls

- **Scenario assignment**: Latin square design — each scenario appears equally across conditions
- **Order effects**: Randomize condition order within each batch
- **Agent state**: Fresh session for each run (no carryover from previous conditions)
- **Evaluator blinding**: FM detection is automated; manual accuracy evaluation done with condition labels hidden

## 5. Predictions (from H-103)

### Confirming predictions (all must hold to confirm H-103):

**P-144a** (Primary — accuracy preservation):  
Format-decoupled gates achieve task accuracy within 5 percentage points of structured gates at the same gate count (non-inferiority).  
*Expected*: Accuracy ≈ 78–85% for both at 3 gates.

**P-144b** (Primary — FM reduction):  
Format-decoupled gates show ≥20% reduction in total FM rate compared to structured gates at 3+ gates.  
*Expected*: FM rate drops from ~0.35/session to ~0.28/session.

**P-144c** (Secondary — rightward shift):  
The performance peak (accuracy maximum) occurs at a higher gate count for format-decoupled gates than for structured gates.  
*Expected*: Structured peaks at 3 gates, decoupled peaks at 4 gates.

**P-144d** (Secondary — token efficiency):  
Format-decoupled gates use 15–30% fewer tokens per gate phase than structured gates, with no reduction in reasoning coverage.

### Refuting conditions (any one refutes H-103):

**R-144a**: Format-decoupled gates show >10% accuracy drop vs structured gates at the same gate count (format provides essential scaffolding, not just overhead).

**R-144b**: FM rates are equal or higher for format-decoupled gates (structure prevents errors rather than causing them).

**R-144c**: Performance peaks at the same gate count for both conditions (no rightward shift — format tax is not the binding constraint).

## 6. Analysis Plan

### 6.1 Primary Analysis
- **2×4 ANOVA** on task accuracy with Gate Type and Gate Count as factors
- **Interaction test**: Gate Type × Gate Count interaction is the key test for the rightward-shift hypothesis
- **Non-inferiority test** for P-144a: one-sided test with Δ = 5pp margin

### 6.2 FM Analysis
- **Poisson regression** on FM counts with Gate Type and Gate Count as predictors
- **Subtype analysis**: Separate models for FM-2.6 and FM-3.3 (most format-tax-sensitive)
- **Per-gate FM rates**: Do FMs cluster at specific gate types?

### 6.3 Curve Analysis
- **Fit quadratic curves** (accuracy ~ gate_count + gate_count²) separately for each gate type
- **Compare peak locations** between curves
- **Bootstrap CIs** on peak gate count difference

### 6.4 Qualitative Analysis (exploratory)
- Blind-rate a sample of 40 gate-phase outputs (5 per condition) for reasoning quality
- Code free-text reasoning for: goal clarity, risk awareness, verification completeness
- Compare against structured artifact quality on same dimensions

## 7. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Format-decoupled prompts are too vague → agents skip reasoning | Medium | High | Pilot test prompts with N=5 to check reasoning coverage |
| Scenario difficulty variance swamps treatment effect | Medium | Medium | Latin square design + include scenario as random effect |
| 200 sessions exceeds budget | Low | Medium | Phase approach — run Phase 1 (N=50) first |
| FM detection doesn't capture format-tax-specific failures | Low | High | Pre-register FM subtypes of interest; manual review backup |
| Gate count confounds with task phase granularity | Medium | Medium | Gate placement is standardized (§3.2); same decision points regardless of count |

## 8. Timeline

| Phase | Sessions | Duration | Cost |
|-------|----------|----------|------|
| Pilot (prompt calibration) | 10 | 1 day | $1 |
| Phase 1 (3-gate, 2 conditions) | 50 | 2–3 days | $5 |
| Analysis checkpoint | — | 1 day | — |
| Phase 2 (full factorial) | 150 | 5–7 days | $15 |
| Final analysis & write-up | — | 2 days | — |
| **Total** | **210** | **~2 weeks** | **~$21** |

## 9. Success Criteria for Experiment

The experiment is **successful** (regardless of whether H-103 is confirmed) if:
1. At least 180 of 200 planned sessions complete without infrastructure errors
2. Primary metrics (accuracy, FM rate) are collected for all completed sessions
3. Statistical tests achieve planned power (CI widths ≤ target)
4. Results clearly confirm or refute each prediction (P-144a through P-144d)

---

*This experiment design follows the methodology established in EXP-143 (Checkpoint Decomposition) and addresses the theoretical framework from CR-338 (Cognitive Overhead Budget) and DD-747 (The Format Tax).*
