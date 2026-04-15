# KE-187: Policy-Invisible Violations Validate Architectural Enforcement and Reveal World-Model Verification as a Ch2 Variant

**Date**: 2026-04-15
**Source**: DD-766 (PhantomPolicy + Sentinel, paper 2604.12177)
**Hypothesis**: H-098 (Attention Channel Theory), H-085 (Forced Externalization), H-089 (Environmental Evidence Discovery)
**Confidence**: High (theoretical convergence across 4 independent research threads; DD-766 N=600 traces, 5 frontier models)
**Tags**: `policy-invisible` `world-model-verification` `channel-theory` `architectural-enforcement` `absent-information` `sentinel`

## Finding

DD-766 identifies **policy-invisible violations** — failures where agents violate organizational policy because the policy-relevant information is absent from their visible context. This is not a reasoning failure or a compliance failure. The agent literally cannot see the information it needs to comply.

This finding converges with four threads in our research, and answers a key question: **Is Sentinel's world-model verification a new enforcement paradigm, or does it fit within our existing Ch1/Ch2/Ch3 taxonomy?**

**Answer: It's a Ch2 variant — environmental-state enforcement via speculative execution — but it reveals a Ch2 *sub-taxonomy* we haven't mapped.**

## The Four Connections

### 1. H-085 (Forced Externalization): Sentinel Is Counterfactual Externalization

Our forced externalization mechanism (H-085) works by requiring the agent to write its judgment as an artifact before acting. Sentinel's counterfactual graph simulation does something structurally parallel but more sophisticated:

| | Our Forced Externalization | Sentinel's Counterfactual Simulation |
|---|---|---|
| **Mechanism** | Agent writes ANALYSIS.md → gate reads it → allow/block | Agent proposes action → system simulates post-action world state → verify invariants → allow/block/clarify |
| **Who does the reasoning?** | The agent (self-analysis) | The system (world-model verification) |
| **Information source** | Agent's own knowledge | Organizational knowledge graph (external) |
| **Effectiveness** | 87-100% when agent can self-diagnose; 0% on absent-information (EXP-078) | 93.0% overall; specifically targets absent-information cases |

The critical difference: **Sentinel externalizes the verification to a system that HAS the missing information.** Our forced externalization externalizes judgment to the same agent that may lack the information. This is why:
- Our externalization fails on absent-information tasks (EXP-078: 0/3, EXP-098: 0/3)
- Sentinel succeeds on absent-information tasks (93.0% vs 68.8% content-only baseline)

**This maps perfectly to KE-186**: information quality trumps process forcing. Sentinel is essentially the F1 channel (expert pre-analysis) applied as a runtime gate. The "expert" is the organizational knowledge graph, not a human analyst.

### 2. H-089 (Environmental Evidence Discovery): Policy-Invisible = Absent-Information

DD-766's "policy-invisible violations" are a specific, named instance of the absent-information failure class we identified in EXP-078/079/098. Our taxonomy:

- **Present-but-wrong**: Information exists in context but agent overlooks it → externalization works (H-085)
- **Absent-field**: Information doesn't exist in agent's context → externalization fails, cross-reference works (EXP-079: 100%)

DD-766 adds precision: the absent information isn't just missing by accident — it's **structurally invisible** because it lives in entity attributes, session history, or organizational state that the agent's context window never included.

Our cross-reference intervention (EXP-079: 100% on absent-field tasks) and Sentinel's knowledge graph share the same mechanism: **routing the agent to an external information source that contains the missing facts.** The difference is scope — our cross-reference sends the agent to grep the codebase; Sentinel simulates against a full organizational knowledge graph.

### 3. H-098 (Attention Channel Theory): Sentinel Is Ch2, Not a New Channel

Sentinel operates through Channel 2 (environmental-state modification):
- It intercepts proposed actions (tool-call level, not text-prompt level)
- It creates a hard gate condition (allow/block/clarify) that cannot be attention-competed away
- It operates independently of the agent's text-processing stream

This makes Sentinel a **Ch2 intervention** — but a *qualitatively different* one from our artifact-based gates:

| Ch2 Sub-Type | Mechanism | Example | Information Source |
|---|---|---|---|
| **Artifact Gate** | Agent writes artifact → gate reads → allow/block | ANALYSIS.md + workflow gate | Agent's own reasoning |
| **Environmental Check** | System checks environmental state → allow/block | Path hallucination guard (EXP-132) | File system state |
| **World-Model Gate** | System simulates post-action state → verify invariants → allow/block | Sentinel | Organizational knowledge graph |

The progression reveals an insight: **Ch2 interventions form a spectrum from self-verification (artifact gates) to system-verification (world-model gates), with effectiveness scaling with the information richness of the verification source.**

- Artifact gates: effective when agent can self-diagnose (87-100%), fail on absent-info (0%)
- Environmental checks: effective for verifiable state (path exists? commit clean?), limited to file-system facts
- World-model gates: effective even on absent-information (93%), because the verification source has richer information than the agent

### 4. CR-335 (Context Pollution): Two Sides of the Information Gap

CR-335 describes context pollution — bad information entering the agent's context and degrading decisions. DD-766 describes the mirror: **context absence** — good information never entering the agent's context, causing invisible violations.

Together they define the full failure space for context-dependent compliance:

```
Context pollution (CR-335)     → Agent has WRONG information → makes bad decisions
Context absence (DD-766)       → Agent LACKS information    → violates invisibly
Context correct + present      → Agent CAN comply           → standard reasoning applies
```

Our interventions map to these:
- **For pollution**: Attention channel theory (H-098) — route information through Ch2 to bypass polluted Ch1
- **For absence**: Cross-reference (EXP-079) or world-model verification (Sentinel) — connect agent to external information sources
- **For correct+present**: Forced externalization (H-085) — ensure the agent actually processes information it already has

## Key Question Answered

> Does DD-766 suggest a NEW enforcement paradigm (world-model verification) that extends beyond our current Ch1/Ch2/Ch3 taxonomy?

**No, but it extends Ch2.** World-model verification is firmly Channel 2 — it operates through environmental state modification and hard gates, not text instructions. But it reveals that Ch2 has meaningful sub-types based on the information source of the verification:

1. **Ch2-Self**: Agent verifies against its own reasoning (artifact gates). Bounded by agent's knowledge.
2. **Ch2-Environment**: System verifies against local state (file checks, test results). Bounded by local environment.
3. **Ch2-World-Model**: System verifies against a rich knowledge representation (knowledge graph, organizational state). Bounded by the graph's completeness.

The progression from Ch2-Self to Ch2-World-Model is exactly the progression from forced externalization (H-085) to information-quality-driven enforcement (KE-186). **The more the verification source knows, the more failure modes it catches.** Forced externalization is the degenerate case where the verification source is the same agent that might be wrong.

## Practical Implications

1. **For our system**: Our current Ch2 gates are all Ch2-Self or Ch2-Environment. To handle absent-information failures (our known boundary condition in EXP-078/098), we'd need Ch2-World-Model: a verification layer with access to information the agent doesn't have. This could be as simple as "before committing, check against a reference spec" or as complex as Sentinel's full graph simulation.

2. **For H-085's boundary conditions**: The absent-information boundary (EXP-078: 0%, EXP-098: 0%) is NOT a fundamental limit of Ch2 enforcement — it's a limit of Ch2-Self specifically. Ch2-World-Model (Sentinel-style) achieves 93% on exactly these failure types. This reframes the boundary: the question isn't "can we fix absent-information failures?" but "can we build a verification source that has the missing information?"

3. **For research priority**: DD-766 suggests our cross-reference intervention (EXP-079: 100%) is a lightweight Ch2-World-Model — the codebase itself serves as the "knowledge graph." Expanding cross-reference patterns may be more tractable than building a full Sentinel-style system.

## Connections

- **H-085**: Sentinel is counterfactual forced externalization — same gate mechanism, different verification source
- **H-089**: Policy-invisible violations are the named version of our absent-information failure class
- **H-098**: Sentinel is Ch2, but reveals Ch2 sub-taxonomy (Self/Environment/World-Model)
- **KE-186**: Information quality trumps process forcing — Sentinel's 93% vs content-DLP's 68.8% is the same pattern as F1 100% vs F2 0%
- **EXP-078/079/098**: Absent-information boundary — Sentinel solves exactly the failures our self-verification gates can't
- **CR-335**: Context pollution is the mirror of context absence; together they define the full information-gap failure space
- **KE-127**: Error propagation lifecycle — policy-invisible violations are a specific propagation path (absence → invisible error → violation)
- **EXP-132**: Path hallucination guard is Ch2-Environment (verifies file paths exist before use) — intermediate between artifact gates and world-model gates

## Open Questions

1. **Can we build lightweight Ch2-World-Model for our system?** A reference-spec checker that verifies agent actions against known constraints (not a full knowledge graph, but a structured set of "must-not-violate" rules checked at the tool-call level). How much of Sentinel's benefit could we capture with 10% of the infrastructure?

2. **Does the Ch2 sub-taxonomy predict effectiveness gradients?** If Ch2-Self < Ch2-Environment < Ch2-World-Model in information richness, do they show corresponding effectiveness gradients in our data? Our path hallucination guard (Ch2-Environment) might serve as a test case.

3. **What's the relationship between DD-766's 5.3% manual-review correction rate and our evaluator confirmation bias (EXP-039)?** Both suggest automated evaluation systematically misses nuanced failures — but from different directions (policy violations vs quality assessment).
