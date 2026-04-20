# DD-807: KWBench — Measuring Unprompted Problem Recognition in Knowledge Work

**Paper**: arXiv:2604.15760
**Authors**: Ankit Maloo
**Date**: April 2026
**Venue**: cs.AI, cs.GT

## Why This Paper Matters ★★★★½

KWBench reveals a devastating reasoning-behavior gap: **models can articulate game-theoretic concepts correctly when asked, then fail to apply them unprompted**. The best model passes only 27.9% of tasks. This is the clearest empirical demonstration yet that LLM capability ≠ LLM application, directly extending our reasoning-behavior gap theme.

## Key Findings

1. **Unprompted Recognition Is Hard**: Best model passes 27.9% of 223 tasks. These are not exotic tasks — they're real professional scenarios (acquisitions, contract negotiations, fraud analysis).

2. **Articulation ≠ Application**: Same models that articulate the relevant game-theoretic concept when prompted fail to apply it when the problem type isn't indicated. This is the reasoning-behavior gap in its purest form.

3. **Model Complementarity**: Top two models agree on only 31.7% of passes. Routing across top 8 covers 50.7% — nearly double best single model. Different models recognize different problem structures.

4. **Quality Converges Conditional on Recognition**: Among models that pass, quality scores converge (~83%). The bottleneck is *recognition*, not *execution*.

5. **44 Tasks Solved by Exactly One Model**: High uniqueness suggests models develop idiosyncratic recognition patterns rather than general problem-recognition capability.

## Connection to Our Research Themes

### Reasoning-Behavior Gap
This is the canonical paper for this theme. The gap isn't between reasoning and behavior — it's between *capability when prompted* and *capability when unprompted*. Agents in multi-agent systems must recognize problems without being told what to look for.

### Agent Benchmarking
KWBench introduces a fundamentally new evaluation paradigm: scoring on problem recognition rather than problem solving. This complements SocialGrid (DD#803, social reasoning), HORIZON (DD#791, failure diagnosis), and HINTBench (DD#790, intrinsic risk).

### Multi-Agent Coordination
The model complementarity finding (50.7% via routing vs 27.9% single-best) suggests multi-agent ensembles could dramatically improve recognition — but only with diverse architectures. This connects to WORC (DD#801): in a multi-agent system, the weak link in problem recognition may bottleneck the system.

### Verification Collapse (CR#318)
If agents can't recognize problem structures unprompted, they can't recognize *verification failure patterns* unprompted either. This explains why verification cascades persist — agents don't recognize they're in a cascade.

## Quantitative Highlights

| Metric | Value |
|---|---|
| Best single model pass rate | 27.9% |
| Top-2 agreement | 31.7% |
| Routing across top 8 | 50.7% |
| Quality score (conditional on pass) | ~83% |
| Tasks solved by exactly one model | 44/223 |

## Implications for Agent System Design

1. **Problem recognition should be an explicit agent capability** — not assumed as a byproduct of general intelligence
2. **Multi-model routing for recognition** dramatically outperforms single-model approaches
3. **Mandatory conjunctive checks** (KWBench's scoring rubric) are a useful pattern for agent verification
4. **"Predicted wrong paths"** in ground truth — encoding what the agent should *not* do — is a powerful evaluation design

## Cross-References
- **DD#803** (SocialGrid): Deception detection at chance; KWBench shows broader recognition failures
- **DD#802** (Reasoning Is Latent): If reasoning is latent, unprompted recognition may depend on latent pattern matching
- **DD#793** (Capable Less Cooperative): Capability ≠ cooperation; KWBench shows capability ≠ application
- **CR#318** (Verification Collapse): Can't detect cascades you can't recognize
- **CR#345** (Behavioral Failure Prediction): Recognition failure is a behavioral signal

## Open Questions
1. Can problem recognition be trained explicitly, or is it emergent from scale?
2. Does the model complementarity hold across model families, or is it architecture-dependent?
3. Can agents be taught to recognize when they *should be* recognizing something (meta-recognition)?
