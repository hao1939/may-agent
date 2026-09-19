<ai_context>
summary: "ActObs (arXiv 2609.20715v1) reports that supervising environment-observation tokens already present in agent trajectories changes later RL exploration even though the deployed policy never emits those tokens. Abstract-only evidence suggests consequence prediction is a distinct training objective: SFT scores stayed similar, while ActObs initialization improved higher-budget pass@k and cross-domain code editing after GRPO, retained more entropy, and required less policy movement."
triggers: ["2609.20715", "ActObs", "observation supervision", "environment prediction", "action consequences", "agentic reinforcement learning", "GRPO", "exploration", "Terminal-Bench", "aider-polyglot"]
last_updated: "2026-09-19"
source_basis: "Live arXiv API metadata and abstract for 2609.20715v1 retrieved in the 2026-09-19 arXiv exploration run; no full-text or artifact review."
</ai_context>

# Observation Supervision Changes the Starting Point for Agent Exploration

Date: 2026-09-19
last_updated: 2026-09-19
Source: https://arxiv.org/abs/2609.20715v1
Source: https://export.arxiv.org/api/query?id_list=2609.20715
Tags: agent-training, reinforcement-learning, environment-modeling, exploration, tool-use

## Finding

*Don't Mask the Environment: Observation Supervision Changes How Agents Explore
Under RL* examines a convention in supervised fine-tuning (SFT) of agent
trajectories. Standard training applies loss to agent-authored action tokens but
masks the environment observations that follow those actions. The proposed
**ActObs** objective also asks the policy to predict observation tokens already
present in each trajectory. It adds no data, parameters, sequence tokens, or
forward passes, and the deployed agent still does not generate the environment's
observations.

The distinction is largely invisible at the SFT checkpoint but appears after
reinforcement learning. The abstract reports:

- on Qwen3-4B, GRPO initialized from ActObs achieved higher pass@k at every
  evaluated sampling budget on Terminal-Bench 2.0;
- on Qwen3-8B, ActObs traded some pass@1 reliability for greater diversity and
  a **3.4 percentage-point gain at pass@16**, solving more distinct tasks;
- on cross-domain aider-polyglot code editing, unseen during SFT and RL, the 4B
  model gained **4.2 percentage points at pass@1**; and
- ActObs retained more policy entropy during RL while moving less from its SFT
  initialization.

The authors' gradient analysis attributes the difference to training-time
specialization: action and observation gradients quickly become orthogonal,
while action-only SFT leaves a large residual observation gradient and makes
environment prediction worse than in the base model. Joint supervision is
presented as preserving consequence prediction and therefore a wider useful
search distribution for downstream RL.

## Why it matters

A trajectory contains two kinds of information: what the agent chose and what
the environment returned. Masking the latter does not merely avoid teaching the
agent to impersonate a tool; it may discard a free learning signal about action
consequences. ActObs suggests that **behavior cloning quality and exploration
readiness are different evaluation targets**. Two SFT policies can look similar
under immediate task scoring yet provide materially different initial states
for later RL.

For agent-training pipelines, this implies:

1. preserve clear role and token-boundary labels so observation prediction can
   be trained without granting the policy authority to emit observations at
   runtime;
2. evaluate post-SFT checkpoints both directly and as RL initializations;
3. report pass@1 separately from higher-budget pass@k, because retained
   exploration can improve coverage while reducing single-sample reliability;
4. measure environment-prediction calibration and policy entropy alongside task
   success; and
5. treat tool results as supervised consequence evidence, while still keeping
   actual runtime observations authoritative over model predictions.

This complements [EnvACE's world-rehearsal signal](./2026-08-07-arxiv-envace-world-rehearsal.md): both train consequence prediction, but ActObs uses observed
trajectory tokens as an auxiliary target rather than having the policy generate
rehearsed observations during execution. In both cases, predicted consequences
must remain explicitly distinct from real tool receipts.

## Evidence boundary

Scout reviewed only the live v1 arXiv metadata and abstract. The full paper,
training code, trajectory corpus, GRPO configuration, sample counts, variance,
statistical tests, and benchmark contamination controls were not inspected or
reproduced. The reported gains and gradient diagnosis are therefore author
claims for the named Qwen3 models and benchmarks. The abstract does not establish
that observation supervision helps other model families, online environments,
or safety-critical actions, nor that higher pass@k compensates for the reported
8B pass@1 tradeoff under fixed deployment budgets.
