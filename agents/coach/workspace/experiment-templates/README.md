# Experiment Templates

Quick-setup scaffolds so coach doesn't rebuild structure for each EXP-NNN.
All templates follow a 5-phase structure: **Design → Setup → Run → Analyze → Graduate**.

## Templates

| File | Type | When to use | Real example |
|------|------|-------------|--------------|
| `ab-single-scenario.md` | (a) single-scenario A/B | One clean change, one scenario, tight signal | EXP-143 (C1.x A/B) |
| `hard-gate-generalization.md` | (b) hard-gate generalization | Testing a gate across 3–5 scenarios | EXP-157 (analysis-gate → KE-180) |
| `prompt-variant-sweep.md` | (c) prompt-variant sweep | 3–5 phrasings of same rule/prompt | EXP-143..156 (C1.x wording sweep) |
| `behavioral-intervention.md` | (d) behavioral intervention | Reduce a specific failure mode via rule/workflow | prove-the-loop Iter 1..8 (C1.x) |

## Picking the right template

- **"I have one change and want to know if it helps."** → (a) ab-single-scenario
- **"Does this gate concept generalize?"** → (b) hard-gate-generalization
- **"Which wording works best?"** → (c) prompt-variant-sweep
- **"I want to suppress FM-x.y specifically."** → (d) behavioral-intervention

If the question is a mix (e.g. "which wording of this intervention works?"), start with (c) to pick a winner, then validate via (d).

## Usage

```bash
# Copy the matching template into your workspace under the EXP ID
cp agents/coach/workspace/experiment-templates/ab-single-scenario.md \
   agents/coach/workspace/EXP-NNN.md
# Then fill in the <angle-bracket> placeholders in Phase 1 before running anything.
```

## Hard constraints (apply to ALL templates)

- **KE-123**: one intervention per experiment — stacking costs 12–15pp.
- **KE-180**: do NOT gate on "write ANALYSIS.md" — analysis gates HARM performance. Gate artifacts must produce the *solution*, not describe the problem.
- **KE-182**: gate artifacts must be part of the solution; metric must be product-quality; never gate implementation-bottleneck tasks.
- **KE-025**: prefer shorter prompts on ties — instruction overhead hurts.
- **KE-002 / KE-007**: text rules fail on judgment failures (0/20 in experiments) — prefer workflows.

## Workflow

1. `cp` template → `EXP-NNN.md`
2. Fill Phase 1 (Design) completely before touching any files.
3. Setup, Run, Analyze, Graduate in order — each phase has a checklist.
4. After Graduate, append one JSON line to `agents/coach/workspace/experiments.jsonl`.
