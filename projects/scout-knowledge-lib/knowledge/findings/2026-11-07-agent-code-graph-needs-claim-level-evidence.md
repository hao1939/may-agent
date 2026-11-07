<ai_context>
summary: "Graphify's pinned source separates deterministic code extraction, model-assisted semantic extraction, edge confidence, source locations, and unsupported code-symbol flags. This makes a code graph inspectable context for agents, not proof that its relations are correct or useful."
triggers: ["Graphify", "code knowledge graph", "coding-agent context", "claim-level provenance", "semantic extraction", "incremental code graph"]
last_updated: "2026-11-07"
source_basis: "Static inspection of Graphify-Labs/graphify at revision 16218bfc80d4ca2799734d045039f7ed1a5fa9fb: README, complete recursive tree, architecture documentation, evidence-binding implementation and tests, and incremental-update instructions. Scout did not install or run Graphify, its tests, an assistant integration, a model backend, or its benchmarks."
</ai_context>

# Agent code graphs need claim-level evidence, not one confidence aura

**Date:** 2026-11-07  
**Disposition:** New source signal  
**Repo:** https://github.com/Graphify-Labs/graphify  
**Inspected revision:** [`16218bfc80d4ca2799734d045039f7ed1a5fa9fb`](https://github.com/Graphify-Labs/graphify/commit/16218bfc80d4ca2799734d045039f7ed1a5fa9fb)

## Question

What evidence should accompany a generated codebase graph before an agent treats it as durable navigation context?

## Source observations

Graphify's pinned documentation describes two materially different extraction paths. Code structure is parsed locally with tree-sitter or built-in parsers, while documents, PDFs, images, and transcripts may go through a model-assisted semantic pass. Its graph schema retains `source_file` and optional source location on nodes and edges, labels edges `EXTRACTED`, `INFERRED`, or `AMBIGUOUS`, and reports a path using the confidence of its weakest hop.

The implementation adds a narrower check for model-produced code nodes. `_bind_node_evidence` extracts identifiers from a returned code-symbol label and looks for at least one of them in the attributed dispatched source. When none is found, the node is retained but marked `verification = "unverified"`; model-hedged `INFERRED` or `AMBIGUOUS` nodes are not upgraded by this check. Project-authored tests cover fabricated symbols, case variants, file slices, absolute paths, and validation of the extra field.

Incremental-update instructions also distinguish replacement from accumulation. Re-extracted source files replace their earlier chunks, deleted sources are pruned, failed or omitted semantic chunks are left unstamped so they can be retried, and stale semantic hashes are cleared. This is important for agent context because a graph can otherwise look increasingly comprehensive while preserving relations whose source has changed or disappeared.

## Reusable implication

A code graph presented to an agent should preserve at least five coordinates per claim:

1. **extraction route** — deterministic parser, model inference, or authored declaration;
2. **source identity** — file, location, and inspected revision;
3. **claim status** — extracted, inferred, ambiguous, or unsupported by the attributed bytes;
4. **update status** — current, replaced, deleted, failed, or pending re-extraction; and
5. **query composition** — especially the weakest evidence grade along a multi-hop answer.

This supports a useful operating rule: use the graph to choose what to inspect next, but require source-bound confirmation before a graph-derived relation drives a consequential edit or verdict. Retaining an unsupported node with an explicit flag can be better than silently dropping it because it exposes the extraction defect without laundering it into trusted context.

This complements [Ontology Atlas](./2026-10-05-ontology-atlas-reviewable-agent-context.md): that source emphasizes reviewable authored meaning and explicit freshness states, while Graphify provides a concrete extraction pipeline with per-edge provenance, evidence downgrades, and source-replacement mechanics.

## Evidence limits

- GitHub Repository Search returned `incomplete_results: false`; metadata was used for discovery, not implementation proof.
- Scout statically inspected the pinned README, complete recursive tree, `docs/how-it-works.md`, `graphify/llm.py`, `tests/test_evidence_binding.py`, and incremental-update instructions.
- Scout did not install or run the software, tests, supported assistants, hooks, model backends, graph queries, or incremental updates.
- Identifier occurrence is a weak support check: a matching token does not prove that the generated symbol, relation, or interpretation is semantically correct.
- Project-authored tests and documentation do not establish correctness, security, scale, retrieval quality, or downstream coding-agent benefit. The README's benchmark claims were not independently inspected or reproduced.

## Sources reviewed

- [Repository](https://github.com/Graphify-Labs/graphify)
- [README at the inspected revision](https://github.com/Graphify-Labs/graphify/blob/16218bfc80d4ca2799734d045039f7ed1a5fa9fb/README.md)
- [How it works](https://github.com/Graphify-Labs/graphify/blob/16218bfc80d4ca2799734d045039f7ed1a5fa9fb/docs/how-it-works.md)
- [Evidence-binding implementation](https://github.com/Graphify-Labs/graphify/blob/16218bfc80d4ca2799734d045039f7ed1a5fa9fb/graphify/llm.py)
- [Evidence-binding tests](https://github.com/Graphify-Labs/graphify/blob/16218bfc80d4ca2799734d045039f7ed1a5fa9fb/tests/test_evidence_binding.py)
- [Incremental-update instructions](https://github.com/Graphify-Labs/graphify/blob/16218bfc80d4ca2799734d045039f7ed1a5fa9fb/graphify/skills/codex/references/update.md)
