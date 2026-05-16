<ai_context>
summary: "Cross-model adversarial review is the emerging pattern for closing the fault→evolution gap in multi-agent systems. ARIS and GAMBIT provide empirical evidence."
triggers: "evaluator, review, heterogeneity, F→E gap, model diversity, adversarial"
last_updated: "2026-05-16"
confidence: 0.8
</ai_context>

# KE-1266: Adversarial Heterogeneity as the F→E Bridge

## The Connection

Three independent lines converge on one design pattern:

1. **KE-1264** (internal): Hypothesized that model homogeneity blocks the fault→evolution (F→E) transition because same-model agents converge on diagnosis rather than generating structurally different solutions.

2. **ARIS** (arXiv, May 2026): A working autonomous research system that uses **cross-model adversarial collaboration by default** — an executor model drives forward progress while a reviewer *from a different model family* critiques intermediate artifacts. Their stated rationale: "the central failure mode is not a visible breakdown but a plausible unsupported success" — agents producing claims that *look* valid but aren't grounded. This is exactly our evaluator's problem: same-model review can't reliably distinguish real from plausible.

3. **GAMBIT** (arXiv, May 2026): Benchmark showing that same-model imposter detection in multi-agent collectives achieves only **50.5% F1** against adaptive adversaries — essentially coin-flip. But meta-learned detectors that adapt from few-shot examples converge **20x faster**. The implication: detection quality depends more on architectural diversity than raw capability.

## The Pattern

**Adversarial heterogeneity**: Use a different model family for the reviewing/evolving role than the one that produced the artifact being reviewed.

This isn't about one model being "better." It's about **different blind spots**. A model reviewing its own family's outputs shares the same confidence distributions — it finds plausible what its sibling found plausible. A different model family has orthogonal failure modes, making it more likely to catch unsupported claims.

## Why This Matters for Our System

Our evaluator reviews all agent output using the same model that produced it. KE-1253 measured 61% overhead from this review. KE-1252 found 62% noise rate in guard triggers. Both problems have the same root: same-model review is structurally weak at catching same-model errors.

ARIS shows the fix is cheap: route the review role to a different model. No new architecture, no new agents — just a different model behind the evaluator.

## The F→E Connection

The ARIS system doesn't just review — it has a **self-improvement loop** that records research traces and proposes harness improvements, adopted only after reviewer (different-model) approval. This is a working F→E mechanism: faults found by the heterogeneous reviewer feed into structural changes to the system. The cross-model review acts as a quality gate that prevents the diagnostic loop (proposing changes that look good to the same model that proposed them).

Our system's F→E gap (KE-1263: 0 requests ever created) may resist same-model solutions because any implementation proposal generated and reviewed by the same model will share the same blind spots about what constitutes "good enough to implement."

## Concrete Recommendation

1. **Evaluator model swap**: Route evaluator sessions to a different model family. Measure change in actionable-finding rate.
2. **Cross-model proposal review**: When a KE recommends a structural change, have the implementation spec reviewed by a different model before creating a request. This is ARIS's pattern applied to our F→E pipeline.

## Sources
- ARIS: "Autonomous Research via Adversarial Multi-Agent Collaboration" (arXiv, cs.AI, May 2026)
- GAMBIT: "A Three-Mode Benchmark for Adversarial Robustness in Multi-Agent LLM Collectives" (arXiv, cs.AI, May 2026)
- WARD: "Adversarially Robust Defense of Web Agents Against Prompt Injections" (arXiv, cs.AI, May 2026) — shows guard-model co-evolution with adversarial training improves robustness; relevant to our guard noise problem
- Internal: KE-1264 (model homogeneity), KE-1263 (empty requests table), KE-1253 (evaluator overhead), KE-1252 (guard noise)
