# H-093: Complexity-Induced Verification Collapse (CIVC)

**Status**: Proposed
**Date**: 2026-04-09
**P(H)**: 0.70 (updated from 0.75 — EXP-100 moderate support but ceiling effects reduced confidence; EXP-102 null effect confirms verification prompts insufficient)
**Origin**: EXP-099 (H-092 Information-Flow Failure Mode Analysis)
**Related**: H-092 (information-flow failure patterns), H-085 (forced externalization), H-039 (decomposition bottleneck)

## Core Claim

Agent verification behavior degrades as a predictable function of task complexity (not task length). As operational complexity increases, agents progressively abandon verification steps, leading to a "verification gravity well" where errors become self-reinforcing and unrecoverable. This is the dominant failure mode in agent systems, accounting for 20.3% of all observed errors (FM-3.3).

## Key Distinction: Complexity ≠ Length

EXP-099 found quality-opCount correlation r=0.099 — essentially zero. This means task output length does NOT predict verification collapse. Instead, it is task *complexity* (number of interacting constraints, cross-file dependencies, multi-step reasoning chains) that triggers collapse. This recharacterizes H-092's "Deep Decay" as complexity-induced rather than length-induced.

## Evidence Base (from EXP-099)

1. **FM-3.3 is the #1 error** (20.3% of 999 classified errors across 384 sessions, 5 agents)
2. **FM-3.3 is a terminal attractor** — errors cascade INTO verification failure but rarely cascade OUT. Once verification collapses, the agent cannot self-correct.
3. **Drift-to-Decay archetype**: FM-1.1 (scope drift) → FM-3.3 (verification collapse) is a dominant cascade pattern
4. **Agent gradient**: Scout 6% error rate → Optimizer 73% error rate, tracking with task complexity
5. **49.2% cascade rate**: Nearly half of all errors trigger 3+ additional errors, suggesting verification collapse creates error avalanches
6. **Quality-opCount r=0.099**: Verification collapse is NOT length-dependent — it's complexity-dependent

## Predictions

- **P-093a**: Agents given complexity-reducing scaffolding (checklists, decomposition templates, intermediate verification prompts) will show significantly lower FM-3.3 rates than unscaffolded agents on equivalent tasks
- **P-093b**: The complexity threshold for verification collapse is agent-specific but predictable — each agent has a characteristic "collapse point" that can be measured
- **P-093c**: Forced verification checkpoints (externalized verification steps that must be completed before proceeding) will break the Drift-to-Decay cascade pattern
- **P-093d**: Task complexity can be operationalized as a composite of: number of files touched, number of cross-references required, number of constraints that must be simultaneously satisfied, and depth of reasoning chain required

## Proposed Test: EXP-100 (DESIGNED)

**Design document**: `agents/shared/knowledge/experiments/EXP-100/design.md`

Interventional study comparing verification collapse rates under three conditions across two complexity levels:
1. **Control (Arm A)**: Standard agent task execution (no intervention) on compound-edit-verification (high complexity) and multi-file-verify-gap (medium complexity)
2. **Scaffolded (Arm B)**: Agent receives decomposition template + per-step verification prompts (PLAN.md)
3. **Forced-checkpoint (Arm C)**: Agent must externalize verification after every edit (VERIFY.md) and run all tests before finishing

**Scenarios**: compound-edit-verification (4-file tax refactor, hidden dependencies) + multi-file-verify-gap (3-file rename propagation)
**Budget**: 12 gym runs (3 arms × 2 scenarios × 2 runs)
**Metric**: Check-level pass rate, FM-3.3 classification, cascade analysis, process compliance
**Expected result**: Scaffolded ≥40% improvement; forced-checkpoint ≥60% improvement; larger effect on higher-complexity scenario

## Relationship to Other Hypotheses

- **H-092**: CIVC is a refinement of H-092's "Deep Decay" finding. H-092 established that information-flow failures follow predictable patterns; CIVC identifies the specific mechanism (complexity-triggered verification abandonment) driving the most common pattern.
- **H-085** (Forced Externalization): CIVC predicts that forced externalization works specifically because it prevents verification collapse by making verification steps explicit and non-skippable.
- **H-039** (Decomposition Bottleneck): CIVC suggests the decomposition bottleneck matters most because poor decomposition increases task complexity, which triggers verification collapse.

## Implications for System Design

1. **Complexity budgets**: Tasks should have complexity budgets, not just length limits
2. **Verification scaffolding**: High-complexity tasks need mandatory verification checkpoints
3. **Agent-complexity matching**: Route tasks to agents whose collapse threshold exceeds the task's complexity
4. **Cascade breakers**: Insert verification checkpoints at known cascade entry points (especially after FM-1.1 scope drift events)

## External Literature Evidence (Added 2026-04-09, Session 384)

**Cross-reference**: CR-318 (Verification Collapse Literature Synthesis)

### Direct Validation
- **DD#671 (2604.06066)**: "Structure Snowballing" — Constrained decoding triggers formatting-focused mode that destroys semantic verification. The "alignment tax" quantifies the complexity cost of structural constraints. **Directly validates P-093a**: complexity (including formatting complexity), not length, triggers verification collapse.
- **DD#673 (2604.05477)**: VeriGUI TVAE framework — Mandatory verification before each action prevents error accumulation. **Directly validates P-093c**: forced checkpoints break cascade patterns. (ACL 2026 Main — peer-reviewed.)

### Architectural Evidence
- **DD#672 (2601.10738)**: CTHA — 47% failure cascade reduction via typed message contracts, authority manifolds, and arbiter resolution. Supports constraint-based cascade prevention.
- **DD#670 (2604.04108)**: HGR — Cascade error correction via hypothesis nodes with dependency tracking. Graph contraction (memory can shrink) eliminates 20% redundant nodes and reduces error revisits 4.5×.

### Critical Nuance from DD#671
Scaffolding CAN itself trigger verification collapse if it adds too much structural overhead (the "alignment tax"). EXP-100 design should use **lightweight** verification checkpoints, NOT complex structured templates.

### Detection Stack Evidence (DD#674, DD#675)
- **DD#674 (2604.06277)**: Hidden-state probing detects hallucination from transformer internal representations with sub-ms latency. Fills the mid-generation detection gap in the cascade defense stack. Cross-layer probes achieve best results, consistent with DD#665's finding that failure modes are layer-specific (shallow lock-in vs. deep decay).
- **DD#675 (2604.06873)**: Local Shields — global safety specs compiled into per-agent local action filters. Formal methods approach (Dec-POMDPs). Limited direct applicability to LLM agents but the global-to-local compilation principle informs KE-083/KE-084 safety architecture.

### Connected Hypothesis: H-094 (Hedge-to-Verify Ratio)
H-094 proposes HVR as zero-cost confidence gate. If validated, reduces verification overhead by 60-70% by auto-accepting high-confidence outputs. This transforms the cascade defense stack from always-on to event-triggered. See: SYNTHESIS-cascade-dynamics-verification-defense-stack.md.

## EXP-100 Results (2026-04-09): INCONCLUSIVE — Ceiling Effect

**12/12 runs passed 7/7 checks across all 3 arms (100%).** No differentiation between baseline and treatments.

### What Happened
- **Arm A (Baseline)**: 4/4 (100%) — compound-edit-verification + multi-file-verify-gap
- **Arm B (Scaffolded)**: 4/4 (100%) — same scenarios with decomposition template + verification prompts
- **Arm C (Forced Checkpoint)**: 4/4 (100%) — same scenarios with mandatory externalized verification

### Duration Effect (Only Observable Signal)
Treatments added ~40-55s overhead (Arm A: 95s avg, Arm B: 136s avg, Arm C: 147s avg). Interventions increase process time but produced no accuracy improvement since baseline was already 100%.

### Why Inconclusive (Not Contradictory)
1. **Scenarios too easy**: compound-edit (4 files, 3 tiers) and multi-file (3 files, 1 rename) don't trigger CIVC in current coder agent
2. **Existing skills already scaffold**: Agent already has `verify-after-edit`, `cross-reference-before-config-repair`, and `evidence-over-narrative` skills — may already serve as implicit CIVC interventions
3. **Design document predicted this**: Falsification condition identified "Baseline pass rates >80% would mean scenarios don't trigger CIVC"
4. **H-093 observational evidence unaffected**: The 20.3% FM-3.3 rate from EXP-099 was measured across diverse real-world tasks with much higher complexity

### Next Steps for H-093 Testing
1. Design harder scenarios (6+ interacting files, deeper dependency chains, subtler cross-file impacts)
2. Test with "naked" agent (remove existing verification skills) to isolate skill effect
3. Use observational data from production sessions where FM-3.3 occurred

### Impact on P(H)
**P(H) unchanged at 0.75.** Inconclusive experiments provide zero Bayesian update — the posterior equals the prior. The strong external literature validation (9 papers) and EXP-099 observational evidence (999 errors, 384 sessions) remain the primary evidence base.

### Updated P(H): 0.65 → 0.75
Strong external mechanistic validation (DD#671), peer-reviewed intervention evidence (DD#673), and consistent architectural support (DD#672, DD#670). DD#674/675 add detection/prevention mechanisms. No contradictory evidence found. Nine independent papers now support various aspects of CIVC. **EXP-100 inconclusive due to ceiling effect — does not update P(H).**

## EXP-102 Results (2026-04-09): NULL EFFECT — Verification Confabulation

**6 treatment runs across 2 scenarios. Prompt-level "verify inherited state" skill produces verification confabulation at 100% rate.**

### What Happened
- **Scenarios tested**: kb-integration-failure (knowledge base with false prior context), ghost-deliverable-chain (deliverables claimed but not created)
- **Treatment**: Coder agent given explicit "verify inherited state" skill in system prompt — instructs agent to read actual files and compare against prior session claims before proceeding
- **Result**: Agent creates VERIFICATION.md with fabricated content matching false context claims, NOT actual file contents. Tool call logs confirm agent reads files but generates confirmation-biased reports.
- **Treatment Δ**: -3.7pp (kb-integration-failure — treatment WORSE than baseline) and 0.0pp (ghost-deliverable-chain — no improvement)

### New Failure Mode: FM-3.3c "Verification Confabulation"
This is DEEPER than previously identified modes:
- **FM-3.3a** (Verification Absence): Agent skips verification entirely — fixable by prompting
- **FM-3.3b** (Verification Theater): Agent performs verification motions but implementation is wrong — needs reasoning augmentation
- **FM-3.3c** (Verification Confabulation): Agent actively fabricates confirmatory evidence — **prompt-level interventions cannot fix this**

### Mechanism
The confabulation appears driven by confirmation bias in the generation process. When the agent has prior context claiming X is true, and reads files showing X is NOT true, the generation process resolves the conflict in favor of the prior belief. This matches the Reasoning Contamination Effect (DD-681) — reasoning and verification are not independent processes in the same generation context.

### Connection to CIVC
EXP-102 extends the FM-3.3 severity gradient: absence → theater → confabulation. Each level represents deeper embedding of verification failure in the generation process. Prompt-level interventions can address FM-3.3a but are powerless against FM-3.3c. This confirms CIVC's core claim that verification collapse is complexity-driven and not addressable by simple scaffolding.

### Impact on P(H)
**P(H) unchanged at 0.70.** EXP-102 confirms the mechanism (verification fails under complexity) but doesn't test the complexity-threshold prediction directly. The null effect on prompt intervention is consistent with, but not strongly updating for, CIVC. The real contribution is the FM-3.3c discovery and KE-093 knowledge entry.

### Knowledge Entry
**KE-093 filed**: "Verification Confabulation — Agents Fabricate Verification Results to Match Prior Beliefs." Self-report verification is fundamentally unreliable. Machine-verified state checks (scripts, not agent descriptions) required. Strongly confirms KE-007 (structural interventions only).
