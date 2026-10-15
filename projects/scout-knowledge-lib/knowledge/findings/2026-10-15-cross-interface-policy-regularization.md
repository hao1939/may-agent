<ai_context>
summary: "Cross-Interface Policy Regularization trains a tool policy to agree across paired equivalent interfaces and reduces held-out name/schema sensitivity, but it depends on a canonicalization adapter, adds rollout cost, mainly improves tool choice rather than arguments, and has weak multi-turn evidence."
triggers: ["cross-interface policy regularization", "CIPR", "tool interface robustness", "tool renaming", "canonical tool names", "function calling"]
last_updated: "2026-10-15"
source_basis: "Full reading of arXiv:2610.20576v1, including appendices, retrieved from arXiv on 2026-10-15; author-reported experiments were not reproduced and the linked code repository was not inspected."
</ai_context>

# Train tool semantics across interfaces, then keep a canonical boundary

**Date:** 2026-10-15  
**Disposition:** New knowledge  
**Coverage:** Full paper and appendices; no code inspection or experiment reproduction  
**Source:** [One Task, Many Interfaces: Simple Cross-Interface Consistency Training Improves LLM Agent Robustness, arXiv:2610.20576v1](https://arxiv.org/abs/2610.20576v1)  
**Source revision:** 2610.20576v1 (submitted 2026-10-14)  
**Repo:** [ArtinTD/cross-interface-policy-regularization](https://github.com/ArtinTD/cross-interface-policy-regularization)

## Question

Can post-training make an agent preserve task behavior when semantically equivalent tool interfaces use unfamiliar names, ordering, or distractors, rather than binding competence to one presentation?

## Source claims and evidence

Cross-Interface Policy Regularization (CIPR) replaces tool and argument names with position-based identifiers, constructs paired interfaces whose equivalent actions are known, and penalizes divergence between the policy's action distributions across each pair. One term rescores the same response under both interfaces; a second compares distributions averaged over separately sampled rollout groups. The task objective still supplies correctness, while the consistency loss supplies invariance. At deployment, a canonicalization adapter maps the live interface into the names used by the trained policy.

The authors add CIPR to ToolRL-style GRPO and compare it with the same multi-interface training without the consistency loss:

- On 2,501 BFCL v4 single-turn items, held-out perturbations include typos, distractors, reordered or duplicated tools, and cheaper or faster equivalents whose unfamiliar name is correct. With Qwen2.5-3B, CIPR preserves 74.9% original-interface accuracy and raises the held-out-group mean from ToolRL's 40.6% to 56.1%; multi-interface training reaches 54.2%.
- With Qwen3.5-4B native function calling, CIPR reaches 85.0% on the original interface and 80.7% across held-out groups, versus 84.8% and 76.4% for ToolRL and 84.8% and 79.7% for multi-interface training. Most of the remaining difference over multi-interface training is small relative to the reported confidence intervals.
- The largest diagnosed effect is narrower than general robustness: under implicit cost/latency perturbations, the share of items where Qwen3.5-4B called the costlier or slower equivalent fell by 24.56 points. Conditional argument-error rates barely changed (12.07% for ToolRL, 11.61% for CIPR), and CIPR produced more no-call and wrong-call-count failures.
- In WebShop self-distillation, renaming `search` and `click` to neutral synonyms had reduced the released AgentLM-7B reward from 78.9 to 5.5. CIPR reached 76.0 under those synonyms and 81.0 through canonical names. Misleading swapped names still drove both models to zero when passed directly to the policy.

## Interpretation

The paper provides controlled evidence that interface randomization and interface consistency are different interventions. Showing a model many presentations broadens its training distribution; explicitly matching action distributions across equivalent presentations adds a smaller but repeatable held-out benefit. The paired construction is also a useful evaluation principle: tool-interface migrations should be tested on semantically identical tasks with perturbed names, ordering, descriptions, and decoys, not only on the unchanged schema.

The practical architecture is not “the model no longer cares about interfaces.” It is **semantic training plus a stable translation boundary**. Canonicalization prevents familiar or misleading names from reaching the policy, while runtime validation must still bind canonical actions and arguments back to the exact live schema. Interface fingerprints, migration tests, and deterministic adapters therefore remain part of the reliability boundary.

## Limitations

- The strongest evidence is single-turn BFCL. On the multi-turn τ²-bench, Qwen3.5-4B CIPR had the smallest original-to-perturbed gap but lower absolute reward than ToolRL on the original interface and every perturbation group; this does not establish improved end-to-end task completion.
- The consistency objective directly regularizes tool choice and no-call probability, not argument construction. It can trade a wrong tool for abstention or an incorrect number of calls.
- Canonicalization is required at inference. Directly presented deceptive names still mislead the model, so the method does not remove the need for trusted schema translation or defend that adapter from malicious metadata.
- The rollout term adds another group of sampled rollouts per prompt. The paper reports one training run per configuration, models only up to 9B parameters, and no independent reproduction.
- Known action equivalences are easy to construct for tool lists but harder for rich state-changing actions such as code edits.

## Relevance

For an agent runtime that evolves tool schemas, a bounded trial could pair recorded tasks across the current schema and semantics-preserving aliases, then measure accepted outcomes separately for tool selection, argument validity, abstention, and final effect. Compare ordinary post-training, interface randomization, and consistency training while holding the model, task set, rollout budget, adapter, and verifier fixed. Deployment should keep the canonicalization map versioned and verify its round trip against each live schema revision.
