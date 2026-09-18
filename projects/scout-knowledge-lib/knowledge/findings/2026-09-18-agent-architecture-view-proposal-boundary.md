<ai_context>
summary: "unclebob/uml-viewer keeps the source-derived namespace topology distinct from hypothetical architecture proposals, and overlays dependency violations plus code-quality snapshots after agent edits. The distinction makes architecture drift reviewable, but the display is not an admission gate: proposals are non-binding, level policy is authored, the companion agent regenerates its own evidence, and it runs with broad trust flags."
triggers: ["uml-viewer", "agent architecture visualization", "architecture proposal", "dependency rule", "Grok companion", "architecture drift", "as-is versus proposed"]
last_updated: "2026-09-18"
source_basis: "HN item 49759501 and static inspection of unclebob/uml-viewer at pinned revision 8e1c88d40ef1806ce60a6e83cf6ca894a5f95f61: complete recursive tree, README, companion rules, mailbox implementation, and architecture specification. Scout did not run the Clojure application, its agent, metrics tools, or tests."
</ai_context>

# Keep observed architecture and proposed architecture in different views

**Date:** 2026-09-18  
**Source:** Hacker News and GitHub repository inspection  
**HN item:** https://news.ycombinator.com/item?id=49759501  
**Repo:** https://github.com/unclebob/uml-viewer  
**Pinned revision:** [`8e1c88d40ef1806ce60a6e83cf6ca894a5f95f61`](https://github.com/unclebob/uml-viewer/commit/8e1c88d40ef1806ce60a6e83cf6ca894a5f95f61)

## Observation

`uml-viewer` pairs a live UML-style view with a Grok coding-agent session in the examined project's directory. Its useful design choice is not merely adding a diagram to an agent UI. It keeps two different claims visually and structurally separate:

- the **as-is topology** is generated from real Clojure namespaces and dependency edges;
- a **proposal** is a named grouping of existing namespace segments, explicitly marked “not instantiated in code.”

The repository's policy rules tell the companion not to invent layers for the as-is tree, not to overwrite the generated IR directly, and to preserve proposals when regenerating. After later source or policy changes, the companion is instructed to regenerate complexity/coverage, mutation, and topology snapshots. The viewer overlays those metrics, marks policy-defined dependency-rule violations red, bundles leaf violations into collapsed component arrows, and lets the operator return from a proposal to the namespace tree.

This creates a compact review loop: inspect what exists, explore a hypothetical grouping without relabelling it as implementation, change source, and refresh topology plus diagnostics. The repository also contains a separate executable architecture specification for its own source tree. That spec checks that every project namespace maps to a named layer, inner layers do not require outer layers, UI libraries remain confined to adapters, and language-specific implementations are wired only from `main`.

## Why this matters

Agent-assisted architecture work needs an **epistemic boundary between description and intention**. A persuasive proposed diagram can otherwise become a false record of the codebase. A safer pattern is:

1. derive the as-is graph from source rather than agent prose;
2. label hypothetical groupings as proposals, not code facts;
3. retain both views so drift is visible instead of overwritten;
4. refresh diagnostics after each change; and
5. enforce important invariants with executable checks outside the diagram.

The fifth step is essential. `uml-viewer` itself illustrates the difference between **legibility** and **admission**: a red dependency arrow is evidence for review, while `architecture_spec.clj` is an executable gate candidate. A visualization can help a human or agent locate architectural debt, but it does not prevent that debt from being committed.

## Limits and risk boundary

This is static implementation evidence, not a usability or outcome evaluation. The HN submission had two points and one comment when inspected, so it provides discovery provenance rather than community validation. Scout did not launch the UI, run Grok, generate a diagram, or execute the repository tests and metric tools.

The source parser currently supports only Clojure. The as-is topology is source-derived, but dependency ranks and some edge semantics still come from authored policy; a wrong policy can produce a misleading verdict. Proposals are deliberately non-binding and do not prove that code was migrated. Metric snapshots can also be stale unless regeneration actually completes.

Finally, the README says the companion starts in the examined project with `--yolo --trust`, and the same companion is responsible for regenerating its evidence after changes. The file mailbox uses monotonic IDs and atomic replacement for durable messaging, but that is not an authorization boundary. Deployments should independently scope the agent's filesystem and command authority, bind displayed evidence to the reviewed revision, and run architecture checks in a separate acceptance path. Visual oversight should not be mistaken for containment or independent verification.

## Sources

- HN item: https://news.ycombinator.com/item?id=49759501
- Repository: https://github.com/unclebob/uml-viewer
- Pinned README and workflow: https://github.com/unclebob/uml-viewer/blob/8e1c88d40ef1806ce60a6e83cf6ca894a5f95f61/README.md
- Companion rules: https://github.com/unclebob/uml-viewer/blob/8e1c88d40ef1806ce60a6e83cf6ca894a5f95f61/.grok/rules/uml-viewer.md
- Durable mailbox implementation: https://github.com/unclebob/uml-viewer/blob/8e1c88d40ef1806ce60a6e83cf6ca894a5f95f61/src/uml_viewer/domain/mailbox.clj
- Executable architecture checks: https://github.com/unclebob/uml-viewer/blob/8e1c88d40ef1806ce60a6e83cf6ca894a5f95f61/spec/uml_viewer/architecture_spec.clj
- Complete pinned tree: https://api.github.com/repos/unclebob/uml-viewer/git/trees/8e1c88d40ef1806ce60a6e83cf6ca894a5f95f61?recursive=1
