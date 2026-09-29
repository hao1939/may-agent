<ai_context>
summary: "A current XHS paper explainer describes AgentWorld as evaluating long-horizon multi-agent collaboration with heterogeneous roles, independent black-box action, and a causal-contribution metric alongside task success. The reusable evaluation lesson is to separate whether a team finished from whether its members made causally useful contributions; all benchmark details and results remain secondary claims because Scout did not inspect the paper or repository."
triggers: ["AgentWorld", "multi-agent evaluation", "long-horizon collaboration", "Causal Collaboration Effectiveness", "CCE", "role confusion", "6abb29e1000000001b01e89b"]
last_updated: "2026-09-29"
source_basis: "Full text of XHS post 6abb29e1000000001b01e89b by 大模型知识分享, observed through the current XHS detail reader. The underlying AgentWorld paper, repository, task data, and experiments were not independently inspected."
</ai_context>

# Multi-agent evaluation should separate team success from useful contribution

**Observed:** 2026-09-29  
**Disposition:** New source-grounded finding  
**Coverage:** Full readable body and visible engagement metadata of one XHS post; no inspection of the underlying paper, repository, benchmark data, or experiments.

## Source

- **Source:** [XHS post 6abb29e1000000001b01e89b](https://www.xiaohongshu.com/explore/6abb29e1000000001b01e89b), “AgentWorld：多Agent LLM长程协作能力评估” by 大模型知识分享

## Source observation

The XHS post presents **AgentWorld** as a benchmark aimed at a gap in multi-agent evaluation: short competitive interactions or aggregates of individual-agent performance do not isolate whether agents can sustain genuine collaboration.

According to the post, AgentWorld contains 100 human-annotated tasks plus 100 augmented variants in an MMORPG sandbox. Tasks span more than 50 interaction rounds and require 3–20 agents with different roles and abilities to communicate, plan jointly, and share resources. It describes a black-box setup in which each agent acts independently without access to the others’ internal states.

The post says the benchmark reports binary task success and a graph-based metric called **Causal Collaboration Effectiveness (CCE)**. CCE is described as tracing causal dependencies among actions to estimate what fraction of agent effort contributed to the result. It also reports a maximum task-success result of 52.0% among the named tested models and highlights communication breakdown, role confusion, and failure to preserve a shared plan across rounds.

These task counts, metric mechanics, model comparisons, failure categories, and open-source status are **claims in the XHS explainer**. This scan did not inspect the paper, code, evaluator, data, traces, or statistical protocol.

## Why it matters

The useful evaluation pattern is a two-layer scorecard:

1. **Outcome:** Did the team complete the task?
2. **Contribution structure:** Which actions and agents were actually necessary or useful to that outcome?

Outcome alone can hide weak coordination. One agent may carry the task while others add cost, repeat work, or merely correlate with success. Conversely, a failed run can contain sound partial collaboration that a binary score discards. A contribution measure can therefore help distinguish productive delegation from redundant activity and localize failures in communication, role assignment, or shared-plan maintenance.

For long-horizon agent systems, evaluation traces should preserve role assignments, messages, resource transfers, plan revisions, actions, and outcome-relevant state transitions. This instrumentation recommendation is Scout’s interpretation; it is not a verified AgentWorld feature beyond the post’s high-level description of causal action dependencies.

## Limits and open questions

- This is a secondary XHS explanation, not a primary-paper assessment.
- The inspected post does not identify the paper URL, repository URL, exact task construction process, or CCE algorithm in enough detail to reproduce the claims.
- A causal graph is only as credible as its dependency extraction and counterfactual assumptions. The post does not establish how causal edges are inferred or validated.
- Sandbox collaboration may not transfer to software engineering, research, or organizational workflows with different communication and authority constraints.
- The reported 52.0% result cannot be compared safely without the tested configurations, sampling protocol, uncertainty, and scoring implementation.
- The source is distinct from **Qwen-AgentWorld**, the language-world-model project already represented elsewhere in the Scout library; the shared name does not imply the same project.

## Scout implication

Multi-agent evaluations should not collapse coordination into a team-level pass rate. Keep outcome scoring, per-agent contribution evidence, communication quality, role adherence, and plan persistence separate. Before adopting CCE specifically, inspect the primary paper and implementation to determine whether its causal attribution is reproducible and robust to redundant or interchangeable actions.
