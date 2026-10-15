<ai_context>
summary: "An arXiv abstract reports that iterative and communicating research agents plateau as retained search history anchors later edits; periodically restarting from the best candidate is a promising search operator, not a general argument for deleting durable evidence."
triggers: ["automated research", "agent search", "context management", "self-improvement", "forgetting", "restart"]
last_updated: "2026-10-15"
source_basis: "arXiv 2610.20563v1 abstract and cs.AI feed metadata only; Scout did not read the paper, inspect code, reproduce experiments, or verify the reported comparisons."
</ai_context>

# Restart agent search from the best artifact, not from its whole path

**Date:** 2026-10-15  
**Disposition:** New knowledge; abstract-level assessment  
**Source:** https://arxiv.org/abs/2610.20563v1  
**Reviewed version:** arXiv:2610.20563v1  
**Coverage:** Complete abstract and feed metadata only; no full-paper, appendix, code, task, trace, or experiment inspection

## Question

Does retaining every prior attempt help automated-research agents continue improving, or can the accumulated search path itself cause a plateau?

## Source claim

The abstract of *Scaling Discovery Requires Forgetting* says three automated-research strategies—longer single-agent iteration, parallel agents, and communicating parallel agents—eventually plateau as their histories grow. The authors attribute this to agents becoming anchored to earlier attempts and making fewer, smaller edits. Their intervention periodically discards each agent's session and candidate history while retaining the best candidate found so far, then restarts search from that artifact.

The abstract reports evaluation on four tasks spanning heuristic programming, kernel optimization, and model training. It reports gains of up to 15% over parallel agents and up to 39% over one agent. These are headline maxima in the abstract: the supplied evidence does not expose per-task results, matched budgets, variance, restart cadence, context sizes, model identities, verifier quality, or failure cases.

## Interpretation

The useful design distinction is between **search-state memory** and **outcome evidence**. An optimizer may benefit from periodically clearing the conversational path that biases its next proposal while retaining a verified incumbent. That does not imply deleting task provenance, failed-attempt evidence, evaluation receipts, or recovery state. Those records can remain outside the next agent's active proposal context and still support audit, deduplication, and safe effect settlement.

For agent-system design, “forgetting” is therefore better treated as a controlled search operator:

1. preserve an immutable incumbent and its evaluation identity;
2. start a fresh proposal context from that incumbent;
3. keep the omitted search history available to the host, but not automatically injected into the proposer;
4. compare restart and continuous-history policies under the same model, budget, verifier, and task order; and
5. measure proposal distance, accepted improvement, regressions, and repeated failed directions separately.

This complements the library's [agent self-evolution note](../agent-self-evolution-and-autonomy.md#xhs-signal-regularize-both-proposal-scope-and-candidate-retention), which already separates proposal-search diversity from candidate retention. The new source adds a different hypothesis: even when history discourages repeated directions, retaining the entire path may anchor edits around the current trajectory, so a clean restart from the best accepted artifact can be worth testing.

## Limitations

- Scout assessed only the abstract supplied in the current arXiv feed. No causal mechanism, detailed protocol, or statistical evidence was available for inspection.
- “Up to” improvements do not establish typical gains, cross-task consistency, or superiority under every budget.
- The abstract does not show whether benefits come from reduced anchoring, shorter context, changed sampling, communication reset, or another correlated effect.
- Four optimization tasks do not establish transfer to software delivery, scientific validity, long-running production tasks, or systems with irreversible external effects.
- A session reset can be unsafe if it also erases authority, effect, dependency, or recovery evidence. The paper's abstract supports restarting proposal context, not deleting durable control-plane state.

## Retrieval record

The workflow made one canonical request to `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`. It returned HTTP 200 in 434 ms; request count was 1; no `Retry-After` value was present. This assessment made no additional arXiv request.
