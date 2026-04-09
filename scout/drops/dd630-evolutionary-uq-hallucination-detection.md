# DD#630 — Evolutionary Search for Automated UQ/Hallucination Detection Design

**Source**: arXiv:2604.03473 (Seleznyov, Korbut, Moskvoretskii, Somov, Panchenko, Tutubalina)
**Date discovered**: 2026-04-07 (Session 302)
**Rating**: ★★★★ HIGH
**Tags**: #meta-optimization #uncertainty-quantification #hallucination-detection #evolutionary-search #harness-engineering

## TL;DR

LLM-powered evolutionary search automatically discovers uncertainty quantification (UQ) methods represented as Python programs. Evolved methods outperform hand-designed baselines by 6.7% ROC-AUC on hallucination detection. Key twist: different LLMs employ qualitatively distinct evolutionary strategies — Claude builds complex linear estimators, GPT gravitates toward simple positional weighting.

## Key Findings

1. **UQ Methods as Evolvable Programs**: Rather than hand-designing uncertainty metrics, the system evolves Python programs that combine internal model signals (token probabilities, entropy, position) into uncertainty scores. The search space is open-ended — any valid Python program is a candidate.

2. **6.7% Relative ROC-AUC Improvement**: Across 9 datasets on atomic claim verification, evolved methods consistently beat strong manually-designed baselines (semantic entropy, lexical similarity, self-consistency). This generalizes robustly OOD.

3. **LLM-Specific Evolutionary Strategies**:
   - **Claude models**: High-feature-count linear estimators (complex, feature-rich)
   - **GPT-oss-120B**: Simple positional weighting schemes (interpretable, minimal)
   - **Opus 4.6 regression**: Surprisingly, Opus 4.6 shows regression vs. 4.5 — increased capability doesn't monotonically improve evolutionary search quality

4. **Complexity-Performance Relationship**: Only Sonnet 4.5 and Opus 4.5 reliably leverage increased complexity to improve performance. Other models generate more complex methods without corresponding accuracy gains — a meta-level Goodhart's Law.

## Why This Matters for Our Research

### Connection to Harness Engineering (CR#302, DD#575)

This is **meta-harness engineering**: agents designing their own quality assurance systems. The evolved UQ programs are, functionally, automated test oracles — they determine whether model output is trustworthy. This is the AutoAgent pattern (DD#575) applied to verification rather than task execution.

### Connection to Constitutional Meta-Engineering (CR#302)

The paper demonstrates that different LLMs (Claude vs GPT) produce qualitatively different "constitutions" for uncertainty. This validates our Law of Constitutional Individuation — the same meta-optimization objective, run on different substrates, produces genuinely different governance strategies. This means constitutional constraints can't be assumed to be substrate-neutral.

### Connection to Conformity Paradox (DD#472) via Opus 4.6 Regression

The Opus 4.6 regression is startling: a more capable model produces WORSE evolutionary search outcomes. This connects to DD#602 (AI Assistance Reduces Persistence) — more capability can reduce exploration breadth. In evolutionary search, the model's own capabilities become constraints on the search space it explores.

### Implications for Agent Self-Improvement

For our gstack factory:
- **Agents can evolve their own verification methods**: Rather than hand-crafting checks, let agents search for quality assurance programs that work on their specific task distribution.
- **LLM-specific search strategies matter**: The verification methods an agent discovers will reflect its own biases and strengths — this is both a feature (adaptation) and a risk (blind spots).
- **Meta-level quality assurance**: If agents design their own UQ methods, who verifies the UQ methods? This is the meta-verification problem — turtles all the way down until you hit human judgment or formal proofs.

## The Larger Pattern: Agents Designing Their Own Oversight

DD#628 (self-execution simulation), DD#629 (structural diversity enforcement), and now DD#630 (evolved UQ methods) form a coherent trajectory:

1. **DD#628**: Agent learns to verify its own code by simulating execution
2. **DD#629**: Agent system learns what constraints prevent degenerate behavior  
3. **DD#630**: Agent evolves its own uncertainty detection methods

This is the **Self-Governance Stack** emerging from three independent research groups. The trajectory points toward agents that design, validate, and maintain their own quality assurance infrastructure.

## Limitations & Open Questions

1. **Fitness landscape**: Are the discovered UQ methods genuinely novel, or are they rediscovering known combinations? The paper doesn't compare against exhaustive feature combination search.
2. **Adversarial robustness**: Can a model designed to fool its own evolved UQ metric? If so, the evolutionary arms race between generation and verification becomes the next frontier.
3. **Transfer across tasks**: UQ methods evolved for claim verification — do they transfer to code quality, reasoning chains, or planning outputs?

## Patterns & Predictions

**P395**: Within 12 months, major agent frameworks will include "UQ evolution" as a standard component — agents that automatically discover and refine their own uncertainty estimation methods for each deployment domain.

**P396**: The LLM-specific evolutionary strategy finding will generalize: different models will produce qualitatively different governance/oversight mechanisms, requiring model-specific constitutional design rather than one-size-fits-all approaches.

## References

- **R129**: Connects to DD#575/CR#302 (Constitutional Meta-Engineering) — evolved UQ as meta-harness engineering
- **R130**: Connects to DD#472 (Conformity Paradox) — Opus 4.6 regression shows capability-diversity tension in evolutionary search
- **R131**: Connects to DD#602 (AI Assistance Reduces Persistence) — more capable ≠ more explorative in meta-optimization
- **R132**: Connects to DD#628 (Self-Execution Simulation) — self-verification and evolved UQ as two faces of the self-governance stack
