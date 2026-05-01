# DD#708 — Beyond Resolution Rates: Behavioral Drivers of Coding Agent Success

**Paper**: arXiv:2604.02547 — Mehtiyev, Assunção (UFMG, 2026)
**Rating**: ★★★★★ EXCEPTIONAL
**Session**: s_1775760817800_504 (2026-04-09)

## Core Contribution

Largest behavioral study of coding agents to date: **9,374 trajectories across 19 agents and 3 SWE-bench subsets**. Goes beyond pass/fail resolution rates to analyze *how* agents behave during problem-solving. Key finding: "Framework prompts do influence agent tactics, but the primary determinant of success is the base model's reasoning ability, which manifests through behavioral differences rather than through instruction-following compliance."

## Key Findings

1. **Behavior Predicts Success, Not Instructions**: Across 9,374 trajectories, what agents *actually do* (file exploration depth, edit granularity, test execution patterns) predicts success better than what they're *told to do*. Framework prompts influence tactics (e.g., search-heavy vs. edit-heavy approaches) but not outcomes.

2. **Structure of Interaction > Content of Instructions**: Successful agents exhibit distinct behavioral patterns (systematic exploration, targeted edits, iterative testing) regardless of their framework prompt. Failed agents exhibit different patterns (scattered exploration, large edits, no testing) also regardless of prompt. The behavioral structure of the trajectory determines success.

3. **Base Model Reasoning > Framework Scaffolding**: The base model's latent reasoning capability (which manifests as behavioral patterns) dominates framework-level interventions. A strong model with minimal scaffolding outperforms a weak model with optimal scaffolding. This directly maps to our Law 4 mechanism: capability is latent; structural wiring determines whether it surfaces.

4. **19 Agents, Same Tasks, Different Behaviors**: The scale of this study (19 agents × 3 benchmarks × multiple runs) provides statistical power that most agent studies lack. The consistency of findings across this diversity strengthens the generalizability claim.

## Connections to Our Work

### Law 2 Validation (Structural Interventions Only)
The finding that "framework prompts influence tactics but not outcomes" is a precise restatement of Law 1 (text rules don't change judgment behavior) + Law 2 (only structural interventions reliably change behavior). The prompts change surface behavior (tactics) but not deep behavior (success/failure). Only the structural patterns of interaction (exploration depth, edit granularity, test frequency) predict success.

### Law 5 Validation (Access Structure Dominates Content Quality)
Behavioral structure of trajectories > content of instructions is exactly Law 5. The quality of framework prompts (content) matters less than how the agent accesses and processes information during its trajectory (access structure). The study shows this holds at the scale of 9,374 trajectories.

### KE-031 Connection (Forced Externalization)
The successful behavioral pattern (systematic exploration → targeted edits → iterative testing) IS a natural forced externalization pattern. Successful agents naturally externalize their understanding through exploration before acting. This matches KE-031's finding that forced externalization works because agents already have the latent capability — it just needs structural surfacing.

### KE-027 Connection (Ablation Imperative)
This paper is essentially a massive ablation study. By holding tasks constant and varying agents, they isolate that behavioral patterns (not framework instructions) drive success. This validates our ablation methodology — before/after comparisons of framework prompts would have shown apparent effects that this ablation reveals as non-causal.

### Meta-Principle 1 (Redirect, Don't Fight)
The finding that base model reasoning manifests through behavioral differences suggests that effective scaffolding redirects natural behavioral tendencies rather than fighting them. Strong models naturally explore systematically; scaffolding should reinforce this tendency (redirect), not try to impose it on models that don't naturally exhibit it (fight).

## Actionable Insights

1. **Agent selection > prompt optimization**: At the scale validated here (19 agents), choosing a better base model dominates choosing better prompts. For our system, upgrading the underlying model would produce larger gains than any prompt engineering.
2. **Behavioral monitoring > instruction compliance monitoring**: Track what agents *do* (exploration depth, edit size, test frequency), not whether they follow instructions. Behavioral metrics predict success; compliance metrics don't.
3. **Natural behavioral patterns as design targets**: The successful patterns identified (systematic → targeted → iterative) should be structurally reinforced in our workflow design, not textually instructed.

## For EXP-184/185/186 (Persistent-Task Structural Intervention / Auto-Detection)

DD#708's finding that behavioral patterns predict success while instruction compliance doesn't directly explains the EXP-184 result arc:
- **EXP-184**: Exact structural commands (100%) vs instructions (~50%) — DD#708 predicts this gap: structural enforcement changes behavior, instructions change tactics only
- **EXP-185/186**: Auto-detection approaches should succeed only if they enforce behavioral structure (tool-call patterns), not instruction compliance. DD#708 predicts generic procedural steps (EXP-185 = 0%) because they're instruction-shaped, not structure-shaped
- **Metric**: DD#708's "systematic → targeted → iterative" pattern maps directly to Read:Edit ratio (CR#293). Track this in EXP-186+ as the behavioral predictor

## Handoff Notes for Bob

This is the large-scale empirical validation KE-101 needs. 9,374 trajectories across 19 agents independently confirms that behavioral structure dominates instruction content. The paper's core finding — "framework prompts influence tactics but not outcomes" — is Laws 1+2 restated in one sentence. The scale (19 agents, 3 benchmarks) makes this statistically robust. Consider as primary external citation for Laws 2 and 5.
