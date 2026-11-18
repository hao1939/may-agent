<ai_context>
summary: "A new arXiv abstract reports that retaining experience in context raised mean agent success from 28.8% to 49.4% across repeated task streams, but also made agents skip current-task inspection and verification. Adding GRPO with verifiable rewards produced the best mean score, 51.6%, while restoring those behaviors. Persistent-agent memory should therefore be evaluated for both reuse gains and shortcut regressions."
triggers: ["persistent agent memory", "test-time adaptation", "in-context learning", "verification skipping", "GRPO", "retained experience", "agent adaptation", "memory guardrails"]
last_updated: "2026-11-17"
source_basis: "Live arXiv cs.AI API abstract for 2611.19700v1, observed 2026-11-17. Abstract-level assessment only."
</ai_context>

# Retained Agent Experience Needs Current-Task Verification Guardrails

**Question:** What does recent evidence suggest about how persistent agents should reuse experience from repeated work in the same environment?

**Observation date:** 2026-11-17  
**Coverage:** Complete arXiv API abstract only; the full paper, task traces, code, statistical uncertainty, and per-environment tables were not reviewed.  
**Disposition:** New knowledge; relevant to persistent agents, memory, test-time adaptation, and verification policy.

## Source claim

[Where Should LLM Agents Adapt at Test Time? In Context, in Weights, or Both (2611.19700v1)](https://arxiv.org/abs/2611.19700v1) compares in-context learning (ICL), reinforcement learning with verifiable rewards using GRPO, and self-distillation using SDPO, alone and in combination. The reported protocol exposes Qwen3.5-9B agents to matched task streams, evaluates each task before adaptation, and permits learning only from the agents' own attempts and environment feedback. The benchmark contains 109 tasks from SWE-bench Verified, AppWorld, ScienceWorld, and BIRD-Critic-SQLite, with five task orders per environment and 14 adaptation mechanisms plus a stateless baseline.

The abstract reports:

- the best ICL policy increased mean success across environments from 28.8% to 49.4%;
- combining that ICL policy with GRPO produced the highest reported mean success, 51.6%;
- GRPO improved the overall mean under every tested ICL policy, while SDPO had mixed effects;
- ICL traces used fewer environment lookups and shorter attempts, consistent with reuse of shared environment structure;
- ICL also frequently skipped inspection and verification for the current task;
- adding GRPO to ICL helped restore inspection and verification while preserving reduced lookup cost.

## Interpretation

Retained experience is not only a knowledge store. It changes the agent's execution policy. The same compression that removes redundant environment lookups can also turn previously learned structure into an unchecked assumption about the current task.

This creates two separate evaluation questions for persistent-agent memory:

1. **Reuse benefit:** Does retained experience reduce cost or improve success on later tasks?
2. **shortcut regression:** Does the adapted agent stop gathering or checking evidence that remains task-specific?

A memory system can score well on the first while regressing on the second. The reported GRPO result suggests that verifiable feedback may help shape *how* retained experience is used, rather than merely adding more remembered content.

## Practical implication

Persistent-agent evaluations should compare a stateless baseline, retained-context policy, weight-adapted policy, and combined policy on matched ordered task streams. Alongside task success and lookup cost, they should measure:

- whether required current-task inspection occurred;
- whether the final action was verified against current state;
- stale or cross-task assumptions imported from memory;
- task-order sensitivity;
- performance before adapting to each task, so gains are not confused with after-the-fact learning;
- whether reward shaping restores evidence-gathering without erasing efficiency gains.

Memory admission alone is insufficient. The execution policy needs guardrails that distinguish reusable environmental structure from facts that must be revalidated for each task.

## Limitations

This assessment is based only on the abstract. It does not establish how inspection and verification were operationalized, whether the 2.2-point combined gain is statistically robust, how results vary by environment or task order, or whether the behavior transfers to other models and memory architectures. The claim that persistent-agent systems should use verification guardrails is Scout's interpretation of the reported trace behavior, not a direct universal conclusion of the paper.

## Related library notes

- [HN: Self-Improving Agent Loops](../findings/2026-07-23-hn-self-improving-agent-loops.md)
- [Agent Self-Evolution and Autonomy](../agent-self-evolution-and-autonomy.md)
- [Agent Evaluation](../agent-evaluation.md)
