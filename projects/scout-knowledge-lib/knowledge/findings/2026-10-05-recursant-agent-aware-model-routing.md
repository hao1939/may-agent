<ai_context>
summary: "Recursant makes model routing trajectory-aware: an OpenAI-compatible gateway uses tool outcomes, repeated failures, helper-agent status, conversation continuity, cost, capacity, and deterministic privacy taint to choose among local and public models per step. Its repository evidence is unusually candid: a small synthetic coding benchmark supports narrower cost-saving claims, while a learned routing adviser failed to save money on a later live comparison."
triggers: ["Recursant", "agent-aware model routing", "hybrid inference", "trajectory-aware routing", "privacy-tainted conversation", "model gateway", "per-step model selection"]
last_updated: "2026-10-05"
source_basis: "HN item 49960535 and static inspection of ajensenwaud/recursant at revision 6e0db68d0eb39cdbeff200995b42cd8dc6161b13, including README, repository tree, benchmark contract, efficiency comparison, and privacy-model evidence. No build or live gateway test was performed."
</ai_context>

# Agent-aware routing can use trajectory state, not just prompt difficulty

**Date:** 2026-10-05  
**Disposition:** New knowledge  
**Source:** https://news.ycombinator.com/item?id=49960535  
**Repo:** https://github.com/ajensenwaud/recursant  
**Inspected revision:** [`6e0db68d0eb39cdbeff200995b42cd8dc6161b13`](https://github.com/ajensenwaud/recursant/commit/6e0db68d0eb39cdbeff200995b42cd8dc6161b13)

## Question

What is substantively different about an “agent-aware” model router, and how much evidence supports its cost, quality, and privacy claims?

## Source claims and inspected design

The new Show HN describes Recursant as an OpenAI-compatible gateway for hybrid private/public inference. The author says it can run an existing agent against local vLLM/Ollama and public OpenRouter models without changing the agent, selecting a model for each step.

The repository makes “agent-aware” more concrete than ordinary prompt classification. Its documented decision order is:

1. route content matching deterministic privacy rules—or content the gateway cannot inspect—to a private model and keep that conversation private thereafter;
2. preserve model continuity when switching could disrupt an ongoing tool/assistant exchange;
3. use trajectory signals such as whether the preceding action succeeded, whether failures repeat, and whether a request belongs to a helper agent;
4. among eligible models, consider price, load, and health.

This is a useful architectural signal. Prompt difficulty is only one possible routing feature; an agent loop also exposes causal state after each action. A successful tool step may justify a cheaper continuation, repeated failure may justify escalation, and a tool-call boundary may make switching unsafe even when another model looks cheaper. The gateway can enforce the chosen endpoint because requests pass through it, unlike prompt hooks that merely recommend delegation.

The privacy mechanism is similarly stateful: a detected private datum taints the conversation so later turns remain private, and failure of the private model does not fall back to a public provider. This is stronger than checking each prompt independently, because later context may depend on sensitive earlier turns even when it no longer repeats the triggering string.

## What the evidence does—and does not—establish

The README advertises “29–39% cheaper at the same quality,” but the pinned evidence supports a narrower statement. In 30 paired runs over ten repository-authored synthetic development tasks, one Hermes harness, one model pair, and an eight-turn cap:

- the deterministic signal router cost 25% less overall than direct GPT-4.1 and passed 25/30 runs versus 20/30;
- a router plus the Jev adviser cost 41% less and passed 21/30;
- among pairs where both arms passed, the reported savings were 15% and 33%, respectively;
- pass-rate differences were within the experiment's uncertainty, and the baseline itself failed 10/30 strict hidden checks.

Those results are promising for this exact benchmark, not proof of generally equal quality. The repository says the tasks were authored for the benchmark rather than drawn from a third-party holdout.

A later comparison is especially informative. On 13 matched unseen task-repeats, a learned efficiency model made routing more conservative and increased cost by 4% overall (16% on both-pass pairs) relative to the deterministic trajectory-signal router. The project therefore left that model off. This negative result supports a practical hypothesis: predicting whether a frontier model would make the same move is not equivalent to predicting whether a cheaper model will still advance the job. Direct action/outcome signals may be both cheaper and better aligned with agent progress.

Privacy claims also need precise boundaries. The README explicitly says regex privacy checks are a safety net, not a guarantee. A repository experiment reports deterministic rules at 86% recall on its 2,142-item synthetic test set but only 25% for names, addresses, and dates of birth; added NER models raised recall while introducing latency and false positives on code-like agent text. Scout did not reproduce these experiments or test live egress.

## Practical implication

A model router for agents should expose its decision as a typed, auditable policy result rather than a single opaque “difficulty” score. Useful inputs include:

- conversation/attempt identity and whether privacy taint is already sticky;
- tool-call and response boundaries that constrain safe model switching;
- verified action outcomes and repeated-failure counters;
- helper-versus-primary role;
- endpoint trust class, health, capacity, and measured cost.

Evaluation should be task-level and paired. Per-request classifier accuracy is insufficient: the real question is whether routing lowers total job cost while preserving verified completion, including retries, auxiliary calls, and failed attempts. Privacy evaluation is a separate claim and needs concrete egress tests; cost/quality success does not establish confidentiality.

## Limitations and coverage

Scout reviewed the complete non-truncated repository tree plus the HN item, README, benchmark contract, final deterministic/Jev comparison, later learned-efficiency comparison, and privacy-model evidence at the pinned revision. Scout did not compile or run the C gateway, inspect every source file, reproduce benchmarks, contact providers, or assess operational hardening. The repository was created the same day as the HN post, had no GitHub-detected license, zero stars, and no HN comments at observation time, so this is an implementation/evidence signal rather than community validation.

The Scout library already contained an unrelated product also named Recursant: [HN Scan #118](./2026-06-24-hn-scan-118.md) covers `recursant.ai`, an enterprise agent-governance service mesh. The repository assessed here is `ajensenwaud/recursant`, a hybrid inference router; the two subjects should not be merged.

## Sources reviewed

- [Show HN item 49960535](https://news.ycombinator.com/item?id=49960535)
- [README at the inspected revision](https://github.com/ajensenwaud/recursant/blob/6e0db68d0eb39cdbeff200995b42cd8dc6161b13/README.md)
- [Final deterministic/Jev comparison](https://github.com/ajensenwaud/recursant/blob/6e0db68d0eb39cdbeff200995b42cd8dc6161b13/docs/evidence/m3-final-comparison-d.md)
- [Learned efficiency model live check](https://github.com/ajensenwaud/recursant/blob/6e0db68d0eb39cdbeff200995b42cd8dc6161b13/docs/evidence/m3-efficiency-live.md)
- [Privacy-model comparison](https://github.com/ajensenwaud/recursant/blob/6e0db68d0eb39cdbeff200995b42cd8dc6161b13/docs/evidence/m2-privacy-models.md)
- [Benchmark contract](https://github.com/ajensenwaud/recursant/blob/6e0db68d0eb39cdbeff200995b42cd8dc6161b13/docs/benchmark-contract.md)
