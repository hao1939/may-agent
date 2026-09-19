<ai_context>
summary: "RetireOPD (arXiv 2609.20784v1) reports a staged agent-training recipe: first optimize a privileged skill-conditioned teacher with environment rewards, then train a skill-free student with RL plus token-level on-policy distillation, and retire the teacher when both teacher-student discrepancy and a task-success threshold say its marginal value has faded. Abstract-only results report gains over RL baselines on ALFWorld and WebShop, with every student eventually surpassing its teacher."
triggers: ["2609.20784", "RetireOPD", "self-retiring distillation", "on-policy distillation", "privileged teacher", "teacher retirement", "agentic reinforcement learning", "ALFWorld", "WebShop"]
last_updated: "2026-09-19"
source_basis: "Live arXiv API metadata and abstract for 2609.20784v1 retrieved in the 2026-09-19 arXiv exploration run; no full-text, code, data, or artifact review."
</ai_context>

# Privileged Agent Teachers Should Earn—and Eventually Lose—Their Role

Date: 2026-09-19
last_updated: 2026-09-19
Source: https://arxiv.org/abs/2609.20784v1
Source: https://export.arxiv.org/api/query?id_list=2609.20784
Tags: agent-training, reinforcement-learning, on-policy-distillation, teacher-student, tool-use

## Finding

*RetireOPD: Self-Retiring On-Policy Distillation for Agentic Reinforcement
Learning* addresses two weaknesses in using a privileged self-teacher to give
multi-turn agents denser supervision than one trajectory-level reward. A teacher
with task skills is not necessarily reliable merely because it sees privileged
information, and teacher guidance can become less useful as the student
improves.

The proposed recipe separates three phases or roles:

1. optimize a skill-conditioned teacher against environment rewards rather than
   assuming that privileged context makes it competent;
2. train a skill-free student jointly with reinforcement learning and token-level
   on-policy distillation from that teacher; and
3. retire the teacher adaptively once teacher-student discrepancy stops shrinking
   **and** the student reaches a target fraction of the teacher's success rate,
   after which the student continues with RL alone.

Across Qwen2.5 models from 1.5B to 7B, the abstract reports improvements over an
RL baseline of **14.1%–18.8% on ALFWorld success rate** and **11.8%–19.0% on
WebShop accuracy**. It also says the final skill-free student surpassed its own
skill-conditioned teacher in every tested setting. These are author-reported
abstract results; the abstract does not clarify whether the percentage gains are
relative or percentage-point changes.

## Why it matters

The reusable idea is not simply “distill a stronger model.” It is to treat
privileged supervision as a temporary training instrument with two separately
measured conditions:

- **teacher fitness:** the privileged policy must first demonstrate reward-grounded
  competence; and
- **retirement readiness:** declining imitation discrepancy alone is insufficient,
  because teacher and student could agree while both perform poorly. A task-outcome
  threshold provides a second gate before the teacher is removed.

This suggests a general design rule for agent training: **keep auxiliary
supervision only while it adds information beyond the learner's own improving
policy, and decide its removal with both behavioral and outcome evidence.** The
student surpassing the teacher is plausible because retirement stops imitation
from becoming a ceiling and lets environment reward continue to optimize the
skill-free policy.

The signal complements [ActObs](./2026-09-19-observation-supervision-agent-exploration.md),
which changes the information retained by the SFT initialization. RetireOPD
instead changes how privileged guidance is introduced and withdrawn during RL.
It also contrasts with [Socratic-Zero](./2026-09-03-arxiv-socratic-zero-teacher-guided-curriculum.md),
where a fixed teacher remains the verifier and curriculum source: RetireOPD makes
teacher competence and eventual removal explicit parts of the training design.

## Evidence boundary

Scout reviewed only the live v1 arXiv metadata and abstract. The full paper,
retirement formula and thresholds, teacher skills, reward definitions, training
budgets, baseline parity, per-task results, seeds, variance, statistical tests,
and released artifacts were not inspected or reproduced. The abstract therefore
supports a promising schedule design and the named benchmark claims, not a
general conclusion that self-retirement is optimal, robust to noisy rewards, or
transferable to other agent environments. It also does not establish the causal
contribution of each component without the paper's ablations.
