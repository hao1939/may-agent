<ai_context>
summary: "A first-person agent-memory build report shows how machine-checked downstream logic can coexist with an unvalidated prose-to-symbol mapping; contradiction systems need explicit, reviewable receipts for proposition identity and context, not only proofs over the resulting atoms."
triggers: ["agent memory contradiction", "proposition identity", "semantic canonicalization", "formal verification boundary", "prose to symbols", "memory conflict detection"]
last_updated: "2026-11-09"
source_basis: "HN item 50419884 and the complete accessible article body inspected 2026-11-09. Scout did not inspect the memory system, source code, proofs, tests, paper corpus, prompts, or stored memories."
</ai_context>

# Formal memory checks need semantic-mapping receipts

**Date:** 2026-11-09  
**Disposition:** New source-grounded design finding  
**Coverage:** HN discovery item plus one complete first-person article; no implementation or formal-artifact inspection

## Observation

[HN item 50419884](https://news.ycombinator.com/item?id=50419884) links to a builder's account of using coding agents to create a local memory system and then attempting to add automatic contradiction detection. The article says the project accumulated a Rust daemon, multiple retrieval strategies, a solver, Agda and Cubical Agda proofs, a Petri-net model, and a plan language with replay properties. Despite that formal machinery, the author reports that the system still did not perform the original task of reliably identifying contradictions in prose memories.

The reported bottleneck appeared before the proved logic. Conflict rules operated over symbols, so a prior canonicalization step had already decided whether two pieces of prose expressed the same proposition. If that mapping merged unlike claims, it could invent a conflict; if it separated paraphrases or differently scoped claims, the solver could miss one. A proof that the symbolic conflict rules behave consistently therefore would not establish that the prose was translated into the right entities, predicates, scope, time, speaker, or context.

The source is especially useful as a failure report about verification placement. Cheap generation made it possible to add sophisticated components and machine-checked artifacts faster than the builder could validate the assumptions connecting them to the intended outcome. The result was not an argument against formal methods. It was an example of a formally treated downstream layer leaving the load-bearing semantic judgment outside the proof boundary.

## Reusable implication

An agent-memory contradiction system should retain a separate **semantic-mapping receipt** for every derived comparison. At minimum, that receipt should identify:

- the exact source spans and source identities;
- the normalized proposition or event representation produced from each span;
- entity, time, modality, polarity, speaker, and contextual qualifiers;
- whether the relation is asserted as equivalent, narrower, broader, related, or genuinely conflicting;
- the model, prompt, schema, policy, or human judgment that produced the mapping;
- confidence, competing mappings, and the evidence used to settle or defer ambiguity;
- the downstream rule or proof revision that consumed the mapping.

Keep three claims distinct:

1. **Mapping validity:** the prose was represented faithfully enough for the comparison.
2. **Rule validity:** given those representations, the contradiction logic has the stated properties.
3. **Outcome utility:** surfaced conflicts improve memory quality rather than adding noisy or misleading context.

Formal verification can strongly support the second claim while saying little about the first or third. A practical system should make uncertain identity judgments revisable and auditable, permit abstention, and evaluate mapping errors separately from solver errors. Tests should include paraphrases, changing names, temporal updates, quoted beliefs, negation scope, modality, missing entities, and claims that are merely different rather than contradictory.

This also suggests a review rule for agent-generated systems: inspect the earliest unproved transformation feeding a proved subsystem before treating the proof as evidence for end-to-end correctness. The more rapidly agents can generate solvers, schemas, proofs, and architecture, the more important it becomes to state which human-meaning judgment remains outside those artifacts.

## Evidence boundary

The article is a retrospective, first-person account, not a released benchmark or independently reproduced evaluation. Scout read the complete accessible article body and the HN item, but did not inspect or run the described memory tool, source code, tests, formal proofs, Petri net, plan language, prompts, Zotero collection, retrieved papers, stored memories, or contradiction outputs. The author's descriptions of what compiled, was proved, or failed were not independently verified. The article's reading list was model-suggested and was not checked source by source. HN item 50419884 had one point and no visible discussion when retrieved, so HN provides discovery rather than validation or adoption evidence.

## Sources

- **HN:** https://news.ycombinator.com/item?id=50419884
- **Source:** https://arbustoemchamas.substack.com/p/i-naively-tried-vibe-coding-a-memory
