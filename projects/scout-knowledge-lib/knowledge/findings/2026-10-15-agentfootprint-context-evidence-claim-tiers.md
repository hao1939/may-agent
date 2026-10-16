<ai_context>
summary: "Pinned Agentfootprint inspection separates recorded context evidence, lexical answer checks, correlational usage accounting, and counterfactual causal claims instead of collapsing them into one observability promise."
triggers: ["Agentfootprint", "context provenance", "agent debugging", "causal ablation", "evidence gate", "context ledger"]
last_updated: "2026-10-16"
source_basis: "Static inspection of footprintjs/agentfootprint revision 2a46105e520512ba559dbd3a15a0a96fa7d1c5ad, plus an implementation and project-authored-test recheck at revision e7600e98ae1b7197ee80f282fe3199ec3f028208. Scout did not execute the software, tests, traces, or ablations."
</ai_context>

# Agent context observability needs explicit claim tiers

**Date:** 2026-10-15  
**Disposition:** New knowledge  
**Repo:** https://github.com/footprintjs/agentfootprint  
**Inspected revision:** https://github.com/footprintjs/agentfootprint/commit/2a46105e520512ba559dbd3a15a0a96fa7d1c5ad  
**Rechecked revision (2026-10-16):** https://github.com/footprintjs/agentfootprint/commit/e7600e98ae1b7197ee80f282fe3199ec3f028208

## Question

How can an agent runtime make context influence inspectable without overstating what a trace, token check, correlation, or rerun proves?

## Observation

A current GitHub Repository Search for `(agent sandbox OR agent runtime) in:name,description,readme pushed:>2026-10-01 stars:>20`, sorted by recently updated, returned `incomplete_results: false` and surfaced `footprintjs/agentfootprint`. Scout pinned its default branch to commit `2a46105e520512ba559dbd3a15a0a96fa7d1c5ad` before inspecting contents.

The repository's useful implementation signal is a layered honesty model:

- The runtime records context injections, tool interactions, decisions, and writes as connected run evidence. Its context ledger derives offers and uses from recorded commits and labels how each item counted.
- Ledger `earnRate` is explicitly bookkeeping (`used / offered`), while outcome columns are presence-correlations. The documentation rejects causal language for both and notes slot-granular credit and approximate token estimates.
- The answer-evidence gate performs deterministic lexical membership checks: names, identifiers, and numbers in an answer must occur in a tool result the run read. Its documentation explicitly says this can detect typed rather than read values, but cannot establish correctness, interpretation, or whether a claim follows from evidence.
- Context-bisect ranks suspects from the recorded causal graph, but gives counterfactual ablation a stronger tier than similarity scores. Its stated rule is that the claim tier travels with the number: embeddings are proxies, only ablation verdicts are causal, and completeness remains bounded by what tracking recorded.
- Missing or inexact recording is represented rather than silently upgraded. Basis codes identify redaction or partial nested values; an unmeterable run is refused rather than assigned a misleading score.

### 2026-10-16 implementation recheck

A fresh repository search for `"AI agent" observability pushed:>=2026-10-09 stars:>20`, sorted by update time, returned HTTP 200 with `total_count: 66` and `incomplete_results: false`. It surfaced the same repository, so Scout opened the existing record rather than creating a duplicate and pinned the recheck to `e7600e98ae1b7197ee80f282fe3199ec3f028208`.

The current implementation makes the counterfactual boundary more concrete than the earlier documentation-only summary:

- `applyAblations` removes named tools, injection IDs, and memory-entry IDs from the inputs used to rebuild an agent. Plain stages are not ablatable, and untracked run arguments must be overridden by the consumer's runner rather than filtered by the library.
- `runAblationProbe` refuses a one-sample verdict by clamping the sample count to at least two. It records flips plus similarity mean, range, and population standard deviation across seeded reruns. A strict majority of flips is required for confirmation.
- The localizer first reruns an empty intervention as a baseline. Any baseline flip marks the scenario unstable and forces every intervention verdict to `inconclusive`, even if an ablation itself flips every sampled output.
- Without a consumer-supplied rerunner, the report remains `correlational`; with one, only each intervention verdict moves to the causal tier. The structural and embedding-derived ranking stays a proxy in either mode. Machine-readable flags expose missing control dependencies, missing LLM-call IDs, absent read tracking, untracked sources, slice truncation, and unstable baselines.
- Project-authored tests encode these boundaries with a planted-fact fixture, a top-versus-bottom suspect comparison, sample-count clamping, and explicit assertions for correlational-only and unstable-baseline behavior. These tests are evidence of intended behavior, not independent execution evidence from this Scout review.

## Interpretation

Agent observability should expose an evidence ladder, not one generic “traceability” badge. Recorded occurrence can support “this value was presented”; backward-slice membership can support “this write is structurally connected to the answer”; repeated co-presence can support prioritization; lexical membership can reject some unsupported values; and controlled removal or substitution can support a bounded causal claim. Each layer answers a different question.

The reusable design rule is to carry the claim tier and recording limits with every diagnostic result. In particular, a guard passing should not become “the answer is true,” and a frequently unused context item should not be removed solely because correlation or coarse slice credit says it earned few tokens. Agentfootprint's “demote, never starve” policy is a useful hedge against making historical observability self-fulfilling.

The implementation recheck adds a second rule: a counterfactual verdict inherits the fidelity of its intervention runner and outcome comparator. Rebuilding without a tool or memory item can establish dependence within that reconstructed scenario; it does not by itself prove that the item caused a real-world failure, that the rerun preserved every other relevant variable, or that semantic output distance represents task correctness. Baseline stability, seeded repeats, and variance are necessary controls, not a universal causal certificate.

## Limits

Scout performed static inspection only. GitHub Search reported 21 stars at recheck, so this is implementation-backed but limited adoption evidence. Scout did not install the package, execute its tests, reproduce a trace, inspect emitted artifacts from a live model, or run counterfactual ablations. The reviewed tests use project-authored fixtures and mock components; they do not validate runner fidelity, production-model nondeterminism, intervention isolation, or whether an output comparator measures task success. Repository documentation, source, and project-authored tests are not independent validation of completeness, performance, causal correctness, or production reliability. Search results are topic discovery, not proof that the implementation works.

## Primary evidence

- [README and framework overview](https://github.com/footprintjs/agentfootprint/blob/2a46105e520512ba559dbd3a15a0a96fa7d1c5ad/README.md)
- [Context ledger and honesty model](https://github.com/footprintjs/agentfootprint/blob/2a46105e520512ba559dbd3a15a0a96fa7d1c5ad/src/context-ledger/README.md)
- [Context-bisect claim tiers](https://github.com/footprintjs/agentfootprint/blob/2a46105e520512ba559dbd3a15a0a96fa7d1c5ad/src/context-bisect/README.md)
- [Answer-evidence gate scope and limits](https://github.com/footprintjs/agentfootprint/blob/2a46105e520512ba559dbd3a15a0a96fa7d1c5ad/src/core/agent/evidence/README.md)
- [Tool-output provenance proposal](https://github.com/footprintjs/agentfootprint/blob/2a46105e520512ba559dbd3a15a0a96fa7d1c5ad/docs/proposals/008-tool-output-provenance.md)
- [Contextual-error taxonomy proposal](https://github.com/footprintjs/agentfootprint/blob/2a46105e520512ba559dbd3a15a0a96fa7d1c5ad/docs/proposals/010-contextual-error-types.md)
- [Current context-bisect implementation](https://github.com/footprintjs/agentfootprint/blob/e7600e98ae1b7197ee80f282fe3199ec3f028208/src/context-bisect/localize.ts)
- [Current ablation probe and verdict logic](https://github.com/footprintjs/agentfootprint/blob/e7600e98ae1b7197ee80f282fe3199ec3f028208/src/context-bisect/ablation.ts)
- [Project-authored localizer tests](https://github.com/footprintjs/agentfootprint/blob/e7600e98ae1b7197ee80f282fe3199ec3f028208/test/context-bisect/localize.test.ts)
- [Project-authored ranking validation fixture](https://github.com/footprintjs/agentfootprint/blob/e7600e98ae1b7197ee80f282fe3199ec3f028208/test/context-bisect/validation.test.ts)
