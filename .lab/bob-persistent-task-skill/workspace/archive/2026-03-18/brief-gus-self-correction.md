# Brief: GUS v7 Self-Correction (CR#100)

## Context
Scout's "Cross-Reference #100" (CR#100) is a systematic adversarial audit of the GUS framework. It identifies 7 internal contradictions, 5 systematic overgeneralizations, and 10 predictions likely to fail. To maintain the scientific integrity of GUS, we must formally integrate these critiques into GUS v7 as a "Self-Correction" release.

## Core Contradictions (To Resolve)
1. **Law 1 (Iteration Tax) vs. Deliberation Success**: Iteration degrades *redundant* information but improves *informative* information.
   - **Fix**: Refine Law 1 to "The Redundancy Tax" — iteration only degrades when information gain < noise gain.
2. **Law 3 (Structure) vs. Law 2 (Intelligence)**: Structure dominates, but Intelligence backfires under poor structure.
   - **Fix**: Unify into **Law of Structural Dominance**: "Structure determines the sign of the Intelligence Coefficient."
3. **Law 7 (Cheap Signals) vs. Complex Protocols**: "Cheap" meant "Structured".
   - **Fix**: Rename to **Law of Structured Signals**: "Structured signals (binary, types) outperform unstructured signals (text), regardless of cost."
4. **45% Ceiling vs. High-Performance MAS**: The ceiling applies to *homogeneous debate* on *closed tasks*.
   - **Fix**: Scope the ceiling explicitly to "Homogeneous Debate Architectures".

## Systematic Overgeneralizations (To Scope)
- **Benchmark Bias**: Laws derived from MMLU/GSM8K may not apply to long-horizon agent tasks.
- **Homogeneity Bias**: Most laws assume identical agents; heterogeneous teams break them.
- **Synchronicity Bias**: Async systems avoid "Consensus Inertia".

## Actions for Philosophy.md
1. ** downgrade T3/T4 Laws** to "Hypotheses".
2. **Add "Epistemic Warning"** (Contradiction 7: Self-Application Paradox).
3. **Promote Success Conditions** (BC1-BC5) to equal status with Failure Modes.

## Deliverables
- Update `agents/shared/philosophy.md` with the "Self-Correction" section.
- Create `agents/shared/knowledge/gus-limitations.md` as a permanent reference for what the framework *cannot* do.

## Handoff
- **Target**: May
- **Action**: Update `philosophy.md` and create `gus-limitations.md`.
