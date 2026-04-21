# KE-323: Token-Level Collaboration Defeats Response-Level Voting Under Adversarial Conditions

**Date**: 2026-04-22
**Source**: DD-Consensus Trap (arXiv:2604.17139)
**Confidence**: High
**Connects**: KE-316, KE-315, KE-320, KE-308

## Core Finding

Response-level aggregation (majority voting) in multi-agent verification collapses when corrupted agents form a local majority. Token-level round-robin (RR) interleaving — where agents sequentially contribute tokens to a shared auto-regressive context — maintains robust accuracy well beyond the majority corruption threshold. The mathematical mechanism: voting is a linear sum (easily overwhelmed); token interleaving is a non-linear operator product where honest agents exert "restorative pull" at every token.

## Evidence

- Majority voting collapses when corrupted agents ≥ 50% (accuracy drops to adversarial level)
- Token-level RR maintains robust accuracy even when corrupted agents are the majority
- Tested across diverse reasoning benchmarks
- Formal proof: operator-product formalism shows honest model's contribution compounds non-linearly through the sequence

## Mechanism / Why

In majority voting, each agent produces a complete response independently. A corrupted majority simply outvotes honest agents — the honest reasoning is discarded wholesale. In token-level interleaving, honest and corrupted agents alternate within a single chain of thought. Each honest token constrains the next corrupted token's distribution, and vice versa. The honest agent's "restorative pull" accumulates through the sequence, making it exponentially harder for adversarial agents to maintain a coherent false narrative.

## Implications

### 1. Verification architecture matters more than agent count
Adding more agents to a majority-vote verification system provides linear robustness (fails at 50% corruption). Token-level interleaving provides non-linear robustness. For adversarial verification, the collaboration method is more important than the number of verifiers.

### 2. Sequential cost is the trade-off
RR is inherently sequential — agents must wait for each other's tokens. This is slower than parallel independent generation + voting. The trade-off is robustness vs. latency, making RR appropriate for high-stakes verification but not routine checks.

### 3. Extends KE-316's information asymmetry insight
KE-316 showed that verification benefits from diverse information sources. This result shows that even with the same information, the *aggregation mechanism* determines robustness. Token-level collaboration extracts more signal from the same set of agents.

## Actionable

- For high-stakes verification (safety-critical decisions, adversarial scenarios): prefer token-level interleaving over independent-then-vote
- For routine verification: majority voting remains cost-effective when corruption risk is low
- Design verification protocols with explicit corruption tolerance requirements; choose aggregation method accordingly
- Explore hybrid approaches: independent generation for initial assessment, token-level interleaving for contested decisions

## Open Questions

- Can token-level interleaving be approximated with sentence-level or paragraph-level alternation (reducing latency)?
- What's the practical corruption threshold for our verification pipeline?
- How does RR interact with typed epistemic acts (KE-320) — can we get both structure and token-level robustness?


[SIG: 1776778916:ke323ctr]
