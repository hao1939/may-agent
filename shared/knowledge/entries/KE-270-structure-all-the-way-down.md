# KE-270: "Structure All the Way Down" — Week 15 Capstone Convergence

**Date**: 2026-04-19
**Source**: CR-339 (capstone of DD#656-743, CR#317-336, EXP-099-127)
**Confidence**: High
**Connects**: KE-101 (structure > content), KE-105 (verification stack), KE-122 (skill internalization), KE-123 (iatrogenesis), KE-106 (guards don't train), H-098 (attention channel theory)

## Core Finding

Five independent research streams from 88 deep dives and 50+ external papers converge: agent behavior is determined by structural constraints (architecture, context topology, verification mechanisms), not content (instructions, prompts, reasoning quality). This operates at every level — transformer attention, prompt ordering, session context, verification, intervention design, multi-session error propagation, multi-agent cooperation, and evaluation methodology.

## Evidence

- **Verification**: 30+ papers show verification quality = evidence architecture, not reasoning quality. 50-69% of correct answers use broken reasoning (DD#688). Consensus ≠ faithfulness (DD#730).
- **Behavioral detection**: Linguistic signals fail (HVR AUROC 0.535); behavioral/trajectory signals work (F1 0.88-0.94, DD#682).
- **Five Laws validation**: 6 independent groups, 3 domains, ~19K evaluations confirm structure > content. Prompt reordering alone causes 72% accuracy drop (DD#706).
- **Intervention hierarchy**: Skills > Guards > Injections. Combined interventions cause -12 to -15pp iatrogenesis (KE-123). Instruction stacking → O(N²) degradation (DD#739).
- **Error propagation**: 5-phase lifecycle (generation→commitment→inheritance→amplification→entrenchment). Context isolation yields 90-98% vs 21-60% without (DD#733).
- **Cooperation**: o3 at 17% collective performance vs o3-mini at 50% — scaling intelligence does NOT improve cooperation (DD#731).

## Mechanism / Why

Structural constraints are binding because they limit the space of possible behaviors before reasoning begins. Content-level interventions compete for finite attention capacity and can conflict with each other. Structure operates pre-attentionally (context topology, available actions) while content operates post-attentionally (instructions interpreted within existing structure).

## Implications

### 1. Verification research should target evidence architecture, not smarter verifiers
Build better evidence presentation structures rather than improving reasoning about evidence.

### 2. Gym-production gap is structural, not parametric
5 dimensions differ: constraint density (~10 vs ~200), temporal structure, context scale, evaluation alignment, agent state. Pause gym FM-3.3 experiments; pivot to production observation.

### 3. The Cooperation-Calibration-Context Triad
Multi-agent systems require structural enforcement of cooperation, statistical calibration of agreement, and active context isolation. None solved by scaling intelligence.

## Actionable

- Add "External Validation" section to KE-101 citing CR#325, CR#336, CR#339
- Design production observation study (CR#326 Path A) as next priority
- When designing interventions: ONE targeted structural intervention, never stacking

## Open Questions

- Where does the principle break? Creative/generative tasks may be the exception (P-339e, confidence 0.60)
- What determines whether an intervention internalizes as skill vs. remains permanent infrastructure?
- How to detect Phase 5 error entrenchment (errors that survive compaction become indistinguishable from facts)?
