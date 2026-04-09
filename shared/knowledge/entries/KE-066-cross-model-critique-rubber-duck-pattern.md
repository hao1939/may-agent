# KE-066: Cross-Model-Family Critique Closes 74.7% of Performance Gap

**Status**: Theoretically Supported
**Source**: DD-655 (GitHub Copilot CLI "Rubber Duck" — Cross-Model Family Critique)
**Confidence**: Moderate (industry deployment evidence, single benchmark)
**Created**: 2026-04-09

## Core Finding

Cross-model-family adversarial review — using a model from a *different* training family as an independent reviewer at sparse checkpoints — closes **74.7% of the performance gap** between a weaker model (Claude Sonnet 4.6) and a stronger model (Claude Opus 4.6) on SWE-Bench Pro. This is the first large-scale production deployment of cross-family critique (GitHub Copilot CLI "Rubber Duck" feature).

## Key Evidence

1. **74.7% gap closure**: Claude Sonnet 4.6 + GPT-5.4 Rubber Duck closes 74.7% of gap to Opus on SWE-Bench Pro
2. **Difficulty scaling**: Gains increase with task difficulty (+3.8% hard problems, +4.8% hardest problems)
3. **Silent failure detection**: All documented catches are bugs that produce no error signals — precisely where self-review fails
4. **Sparse > dense**: Three checkpoints (post-plan, post-implementation, post-test) capture most value
5. **Cross-family mechanism**: Different training biases catch different errors — validates DD-585 (representational collapse) and DD-472 (Conformity Paradox) at production scale

## Three Activation Modes

| Mode | Trigger | Use Case |
|------|---------|----------|
| Proactive | Automatic at checkpoints | Post-plan, post-implementation, post-test |
| Reactive | Agent stuck in loop | Break logjams when primary agent can't progress |
| On-demand | User-triggered | Ad-hoc critique requests |

## Why It Matters

- **Our system uses Claude exclusively** — Coach, Scout, Bob, Optimizer all same model family → same blind spots (representational collapse per DD-585)
- **Cross-family review at plan/implementation/test boundaries** could significantly improve quality with minimal overhead
- **Sparse checkpoint architecture** means low latency cost — don't review every step, review at high-leverage moments
- **Composable via subagent pattern** — integrates as a plugin, not a rewrite

## Connection to Our Knowledge Base

- **DD-585 (Representational Collapse)**: Same-family committees show 0.888 cosine similarity. Cross-family review breaks this
- **DD-472 (Conformity Paradox)**: Homogeneous agreement is unreliable. Rubber Duck engineers disagreement deliberately
- **KE-050 (Robustness-Architecture Nexus)**: Architecture > model for robustness. Cross-family review is an architectural intervention
- **KE-063 (Artifact Trust Asymmetry)**: Cross-family reviewer provides independent trust assessment of artifacts

## Limitations

- Single benchmark (SWE-Bench Pro) — may not generalize to all agent tasks
- Industry blog post, not peer-reviewed paper — effect sizes should be viewed cautiously
- The specific GPT-5.4/Claude pairing may not generalize to other model combinations
- Latency overhead not reported — sparse invocation mitigates but doesn't eliminate cost

## Actionable Implications

1. **HIGH PRIORITY**: Prototype cross-family review for our evaluator pipeline (add GPT-family review at high-leverage checkpoints)
2. **MEDIUM**: Implement reactive mode — route to different model family when agent loops
3. **LOW**: Consider on-demand human-triggered cross-family review

---
*Bob synthesis from DD-655 | 2026-04-09*
