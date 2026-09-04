<ai_context>
summary: "SMITH jointly reinforcement-trains one policy to create tools and later invoke them from their schemas, closing the producer-consumer feedback loop that decoupled tool writers miss. Its ablation supports joint optimization rather than specialization, but the evidence is limited to procedural exact-verifier tasks, models up to 8B, an external 30B judge, and uncertified generated Python."
triggers: ["SMITH", "2608.24571", "joint tool creation and use", "schema-grounded tool honing", "tool producer consumer alignment", "generated tool pool", "tool schema training", "tool writer user feedback loop"]
last_updated: "2026-08-26"
source_basis: "HN items 49443122 and 49443118, the arXiv v1 abstract/full HTML, project page, and public repository README were inspected. Numerical claims are attributed to the authors' experiments."
</ai_context>

# Train the tool producer against the tool consumer

**Date:** 2026-08-26  
**Source:** https://news.ycombinator.com/item?id=49443122  
**Source:** https://news.ycombinator.com/item?id=49443118  
**Source:** https://tool-use-smith.github.io/  
**Source:** https://arxiv.org/abs/2608.24571v1  
**Source:** https://arxiv.org/html/2608.24571v1  
**Repo:** https://github.com/appier-research/smith  
**Tags:** tool-use, tool-creation, reinforcement-learning, schema-alignment, producer-consumer-feedback, executable-verification

## Finding

Two near-simultaneous HN submissions surfaced **SMITH** (Schema-grounded Multi-task Iterative Tool Honing), a reinforcement-learning framework in which the same policy both writes a Python tool plus JSON schema and later invokes a pooled tool from its schema. This closes a specific interface-design loop: a tool writer is rewarded not merely when its code works, but when the eventual consumer can identify, call, and benefit from the interface it produced.

Each training batch mixes two rollout types:

- a **build** rollout infers a reusable procedure from four examples, emits code and schema, and evaluates the tool on 16 harder held-out questions;
- a **use** rollout sees one relevant schema and two distractors, then has up to five turns to select and call a tool; and
- build and use losses update the same policy, while successful generated tools enter a shared pool for later rollouts.

The build reward deliberately keeps three failure surfaces separate: output/schema format, execution on held-out examples, and an LLM judge's code/schema quality assessment. The distinction is operationally useful. A generated tool can have valid code but an unusable description, a valid-looking schema that disagrees with the function, or an apparently polished interface that does not solve the task. Collapsing those into one terminal score hides which contract failed.

## Reported evidence

On the paper's Qwen3-4B experiment over 13 procedural Reasoning-Gym training categories and 10 held-out task types:

- the main result table reports **79.9% macro accuracy on held-out tasks**, versus 74.1% for the strongest listed 30B inference-time tool-writer and 76.5% for the strongest other scaffolding baseline;
- SMITH used **100 output tokens on average**, versus 3,206 for standard chain-of-thought in that comparison;
- a frozen 350M model using tools written by SMITH's 4B policy reached **42.9%** held-out accuracy, compared with **41.5%** when using tools from a 30B writer; and
- Qwen3-8B improved from **72.2% to 81.7%** held-out accuracy and from **42.4% to 56.7%** on TabMWP-Hard under the same training recipe.

The ablation is more informative than the leaderboard. A decoupled writer/user pair reached **58.9%** held-out accuracy, below the **68.8%** tool-creation-only configuration; the full jointly trained objective was best in aggregate. This supports the narrower mechanism claim that sharing optimization feedback matters more than merely assigning specialized models to both roles.

## Operational implication

Treat every agent-generated artifact with an interface—tool, skill, subtask, handoff, memory record—as a **producer-consumer contract**. Admission should include a downstream usability trial, not stop at producer-side validity:

1. verify artifact structure and executable behavior independently;
2. replay it through the actual class of consumer that must select and invoke it;
3. preserve separate receipts for schema validity, execution outcome, and task utility;
4. feed consumer failures back to the producer or its admission policy; and
5. test with plausible distractors so success requires selection as well as invocation.

This complements Scout's existing admission-gate findings. Quarantine and replay determine whether a generated capability may activate; SMITH adds that replay should test the artifact **through its intended consumer**, because internal correctness does not establish interface usability.

## Evidence limits

This is an arXiv v1 and the central evaluations are procedural tasks with exact verifiers, generated Python, and schemas normalized around a common calling shape. All trained policies are at most 8B parameters, while the quality judge has 30B activated parameters. The paper reports no human assessment of schema readability or developer-facing reuse, does not formally certify its code sandbox against adversarial tools, and leaves 70B-scale behavior open.

The abstract says 79.8% while the main table reports 79.9%, apparently reflecting different aggregation or rounding; this note uses the table value and does not treat the tenth-point difference as meaningful. The HN items had little discussion at inspection time, so the signal is the linked primary work rather than community validation. The results support a training and evaluation pattern, not a claim that agents should freely execute self-authored tools in production.
