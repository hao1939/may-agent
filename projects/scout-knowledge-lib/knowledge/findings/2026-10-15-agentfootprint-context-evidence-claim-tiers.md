<ai_context>
summary: "Pinned Agentfootprint inspection separates recorded context evidence, lexical answer checks, correlational usage accounting, and counterfactual causal claims instead of collapsing them into one observability promise."
triggers: ["Agentfootprint", "context provenance", "agent debugging", "causal ablation", "evidence gate", "context ledger"]
last_updated: "2026-10-15"
source_basis: "Static inspection of footprintjs/agentfootprint revision 2a46105e520512ba559dbd3a15a0a96fa7d1c5ad: README, context-bisect, context-ledger, answer-evidence documentation, and design proposals. Scout did not execute the software, tests, or ablations."
</ai_context>

# Agent context observability needs explicit claim tiers

**Date:** 2026-10-15  
**Disposition:** New knowledge  
**Repo:** https://github.com/footprintjs/agentfootprint  
**Inspected revision:** https://github.com/footprintjs/agentfootprint/commit/2a46105e520512ba559dbd3a15a0a96fa7d1c5ad

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

## Interpretation

Agent observability should expose an evidence ladder, not one generic “traceability” badge. Recorded occurrence can support “this value was presented”; backward-slice membership can support “this write is structurally connected to the answer”; repeated co-presence can support prioritization; lexical membership can reject some unsupported values; and controlled removal or substitution can support a bounded causal claim. Each layer answers a different question.

The reusable design rule is to carry the claim tier and recording limits with every diagnostic result. In particular, a guard passing should not become “the answer is true,” and a frequently unused context item should not be removed solely because correlation or coarse slice credit says it earned few tokens. Agentfootprint's “demote, never starve” policy is a useful hedge against making historical observability self-fulfilling.

## Limits

Scout performed static inspection only. GitHub Search reported 21 stars at observation, so this is implementation-backed but limited adoption evidence. Scout did not install the package, execute its tests, reproduce a trace, inspect emitted artifacts from a live model, or run counterfactual ablations. Repository documentation and project-authored design claims are not independent validation of completeness, performance, causal correctness, or production reliability. Search results are topic discovery, not proof that the implementation works.

## Primary evidence

- [README and framework overview](https://github.com/footprintjs/agentfootprint/blob/2a46105e520512ba559dbd3a15a0a96fa7d1c5ad/README.md)
- [Context ledger and honesty model](https://github.com/footprintjs/agentfootprint/blob/2a46105e520512ba559dbd3a15a0a96fa7d1c5ad/src/context-ledger/README.md)
- [Context-bisect claim tiers](https://github.com/footprintjs/agentfootprint/blob/2a46105e520512ba559dbd3a15a0a96fa7d1c5ad/src/context-bisect/README.md)
- [Answer-evidence gate scope and limits](https://github.com/footprintjs/agentfootprint/blob/2a46105e520512ba559dbd3a15a0a96fa7d1c5ad/src/core/agent/evidence/README.md)
- [Tool-output provenance proposal](https://github.com/footprintjs/agentfootprint/blob/2a46105e520512ba559dbd3a15a0a96fa7d1c5ad/docs/proposals/008-tool-output-provenance.md)
- [Contextual-error taxonomy proposal](https://github.com/footprintjs/agentfootprint/blob/2a46105e520512ba559dbd3a15a0a96fa7d1c5ad/docs/proposals/010-contextual-error-types.md)
