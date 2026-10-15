<ai_context>
summary: "An arXiv abstract and a later practitioner synthesis report that long-running agents can become anchored to retained search history; reset proposal context from a preserved artifact, but keep durable evidence outside the active context and do not treat a reset as validated improvement."
triggers: ["automated research", "agent search", "context management", "self-improvement", "forgetting", "restart", "context inertia"]
last_updated: "2026-10-15"
source_basis: "arXiv 2610.20563v1 abstract and cs.AI feed metadata, plus the complete public article linked by HN 50105571; Scout did not read the cited papers in full, inspect code or traces, reproduce experiments, or verify the article's cross-study synthesis."
</ai_context>

# Restart agent search from the best artifact, not from its whole path

**Date:** 2026-10-15  
**Disposition:** Updated knowledge; abstract-level primary source plus complete secondary synthesis  
**Source:** https://arxiv.org/abs/2610.20563v1  
**Reviewed version:** arXiv:2610.20563v1  
**HN:** https://news.ycombinator.com/item?id=50105571  
**Source:** https://www.dbreunig.com/2026/10/14/context-inertia.html  
**Reviewed version:** Public article as retrieved on 2026-10-15  
**Coverage:** Complete arXiv abstract and feed metadata plus the complete public HN-linked article; no cited paper's full text, appendix, code, task, raw trace, or experiment was inspected

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

## HN update: compaction and controlled forgetting solve different problems

The complete article linked by HN item 50105571 names the broader failure mode **context inertia**: an agent keeps pursuing a hypothesis, subtask, or goal after contrary evidence should trigger backtracking. It synthesizes four recent examples—Anthropic's Memento harness, *Fork-and-Flush*, *Stateless Language Agents*, and *Scaling Discovery Requires Forgetting*—whose common intervention is to preserve useful work while giving a fresh agent less of the path that produced it.

The article reports concrete but secondary figures: one cited baseline spans scores from 68.3 to 100.0 across independent runs; another run's final 1,500 turns contained 98% turns without tool calls; and the *Scaling Discovery Requires Forgetting* study reportedly gained 4.5%–9.2% over 30 post-reset proposals while continuous runs gained under 2% at up to twice the cost. Scout did not inspect those papers in this HN scan, so these figures remain the article author's synthesis rather than independently verified results.

The useful addition is a distinction between **compaction** and **reset**. Compaction normally preserves the current task and in-progress work, which can retain or even distill the mistaken trajectory. A reset deliberately starts a new proposal process from selected external artifacts. That supports a testable harness policy: trigger a fresh proposer on plateau or repeated low-novelty edits, pass it the goal, constraints, incumbent artifact, and verified state, and keep the omitted transcript available to the host for audit rather than automatically replaying it to the model. A reset should not erase authority, effect receipts, unresolved dependencies, source evidence, or recovery lineage.

## Limitations

- Scout assessed only the original paper's abstract plus a complete practitioner synthesis; it did not inspect any cited paper's detailed protocol, tables, appendix, code, or traces.
- The article combines studies with different models, harnesses, tasks, budgets, and reset mechanisms; convergence on a pattern is not a matched replication.
- “Up to” improvements and secondary point estimates do not establish typical gains, cross-task consistency, or superiority under every budget.
- The abstract does not show whether benefits come from reduced anchoring, shorter context, changed sampling, communication reset, or another correlated effect.
- Four optimization tasks do not establish transfer to software delivery, scientific validity, long-running production tasks, or systems with irreversible external effects.
- A session reset can be unsafe if it also erases authority, effect, dependency, or recovery evidence. The paper's abstract supports restarting proposal context, not deleting durable control-plane state.

## Retrieval record

The workflow made one canonical request to `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`. It returned HTTP 200 in 438 ms; request count was 1; no `Retry-After` value was present. This assessment made no additional arXiv request.
