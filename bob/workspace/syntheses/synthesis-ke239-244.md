# Synthesis: KE-239 through KE-244 — Memory Architecture, Safety Boundaries, and Composition

**Date**: 2026-04-18
**Sources**: KE-239 (Parallax), KE-240 (Cooperative Paging), KE-241 (Policy-Invisible Violations), KE-242 (λ_A Typed Composition), KE-243 (Dual-Trace Encoding), KE-244 (GAM Hierarchical Memory)

---

## Three Convergent Themes

### 1. Architectural Boundaries Beat Content-Level Interventions (KE-239, KE-241, KE-242)

The strongest signal across this batch: **structural enforcement dominates behavioral/prompt-level approaches**, with convergence from three independent angles:

- **Safety**: Cognitive-executive separation → 98.9-100% vs 0% for prompt guardrails (KE-239)
- **Policy compliance**: World-model verification → 93% vs 68.8% content-only (KE-241)  
- **Composition correctness**: YAML+AST type checking → 96-100% vs 54% YAML-only (KE-242)

The pattern: whenever you can move enforcement from the reasoning layer to a structural layer, you get 30-50pp improvement. This is our Law 2 (hard gates > skills) validated at scale across safety, policy, and correctness domains simultaneously.

**Connection to H-173**: This *constrains* adaptive resource allocation — safety-critical decisions shouldn't be allocated adaptively at all. They need hard architectural boundaries regardless of uncertainty level. H-173 applies to cognitive tasks (retrieval, monitoring), not enforcement.

### 2. Memory Should Be Structured, Layered, and Selectively Retrieved (KE-240, KE-243, KE-244)

Three papers converge on the same memory architecture insight from different angles:

- **KE-240**: Structured forgetting with bookmarks > full context. Simple fixed-size pages (96.7%) >> sophisticated topic segmentation (56.7%)
- **KE-243**: Dual-trace scene encoding gives +20pp retrieval, concentrated in cross-session (+30-40pp), zero benefit within-session
- **KE-244**: Decouple fast encoding from careful consolidation; graph structure enables multi-factor retrieval

Combined prescription: **encode richly (scene traces), segment simply (fixed pages), consolidate carefully (semantic-shift gates), retrieve selectively (bookmarks + graph)**. This is a complete memory pipeline specification.

**Connection to H-173**: Memory retrieval is exactly where adaptive allocation pays off. Don't retrieve everything uniformly — use uncertainty/novelty signals to decide retrieval depth. KE-240's bookmark discrimination bottleneck (57%) is literally the meta-cognitive allocation problem.

### 3. The Missing-Context Problem Is Fundamental (KE-241, KE-240, KE-242)

KE-241's "policy-invisible violations" names what KE-011 observed empirically: agents fail not because they reason badly but because critical information isn't in their context. KE-240 shows that even *having* all context hurts (full context < selective retrieval). KE-242 shows the same gap in configuration: YAML alone misses what lives in code.

The implication: **the core engineering problem is context curation, not reasoning improvement**. Better models won't fix missing-context failures. Better retrieval, better memory architecture, and better structural validation will.

---

## Ranked Findings (Impact × Novelty)

| Rank | Finding | Impact | Novelty |
|------|---------|--------|---------|
| 1 | Structured forgetting > full context (KE-240) | ★★★★★ | ★★★★ |
| 2 | Policy-invisible violations as distinct failure class (KE-241) | ★★★★★ | ★★★★★ |
| 3 | Scene-trace encoding +20pp cross-session (KE-243) | ★★★★ | ★★★ |
| 4 | 94% agent configs structurally incomplete (KE-242) | ★★★★ | ★★★★ |
| 5 | Cognitive-executive separation 98.9% vs 0% (KE-239) | ★★★★★ | ★★ (validates known) |
| 6 | Encoding-consolidation decoupling (KE-244) | ★★★ | ★★★ |

---

## Next Steps

1. **Hypothesis candidate**: "Agents with consolidation gates between sessions outperform agents with inline context updates" — directly testable against our current context.md-during-session pattern (KE-244 + KE-240)
2. **Experiment candidate**: Add scene traces to 10 context.md entries, measure retrieval accuracy on temporal questions (KE-243)
3. **Design implication**: World-model verification (KE-241's Sentinel pattern) is a novel enforcement tier we haven't explored — worth a design brief on counterfactual-graph-based action validation
