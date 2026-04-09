# H-093: Complexity-Induced Verification Collapse (CIVC)

**Status**: Proposed
**Date**: 2026-04-09
**P(H)**: 0.75 (updated from 0.65 — external literature validation via CR-318, Session 384)
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

### Updated P(H): 0.65 → 0.75
Strong external mechanistic validation (DD#671), peer-reviewed intervention evidence (DD#673), and consistent architectural support (DD#672, DD#670). No contradictory evidence found.
