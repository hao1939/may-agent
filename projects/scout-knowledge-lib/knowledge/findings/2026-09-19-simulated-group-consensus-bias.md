<ai_context>
summary: "A matched replay study of 100 human Wason-task groups reports that belief-anchored LLM-agent groups reached much more apparent consensus than the human groups, partly because agents almost always participated while about one fifth of people never posted. Two sensitivity analyses that reduced different scoring asymmetries still found 34.0–44.4 percentage-point consensus gaps, and high agent agreement did not imply correctness."
triggers: ["2609.20543", "simulated deliberation", "agent consensus", "participation matching", "Wason task", "belief anchoring", "collective cognition", "consensus accuracy"]
last_updated: "2026-09-19"
source_basis: "Live arXiv API metadata and abstract for 2609.20543v1 retrieved in the 2026-09-19 arXiv exploration run. The arXiv HTML endpoint returned HTTP 404, so no full text, code, data, or supplementary material was reviewed."
</ai_context>

# Simulated Agent Consensus Can Be a Participation Artifact

Date: 2026-09-19
last_updated: 2026-09-19
Source: https://arxiv.org/abs/2609.20543v1
Source: https://export.arxiv.org/api/query?id_list=2609.20543
Tags: multi-agent, deliberation, evaluation, consensus, participation, human-simulation

## Finding

*Language-model groups overstate consensus when replaying human deliberation on
a reasoning task* compares 100 held-out human groups on a Wason reasoning task
with matched groups of LLM agents. Each agent was anchored to one human
participant's pre-discussion answer, and the authors report scoring agent and
human groups with the same code.

The abstract shows that “same scoring” does not by itself make the two group
processes comparable. Human full-consensus estimates varied from **24.0% to
57.0%** across scoring definitions, and about one fifth of human participants
never posted, whereas agents almost always participated. The authors therefore
ran two post-unblinding sensitivity analyses:

- a submit-based comparison over 98 groups found agent–human consensus gaps of
  **34.0 percentage points in chat mode** and **43.9 points in reasoning mode**;
- a participation-matched comparison over 45 groups found gaps of **34.1** and
  **44.4 points**, respectively.

Those routes remove different measurement asymmetries but produce estimates
within 0.5 percentage points of one another. The abstract further reports that
the gap survived removal of early stopping and a reparameterization intended to
remove a memorizable answer. Under the latter condition, reasoning-mode agent
groups agreed nearly unanimously but mostly on incorrect answers. Simulated
consensus therefore did not track collective accuracy, and the belief-anchored
agent groups were biased estimators of the human group-outcome distribution in
this setting.

## Why it matters

An agent population can appear more decisive than a human population for two
separate reasons: it may converge more readily, and it may simply produce fewer
abstentions or silent participants. Treating both as “consensus” promotes a
runtime participation difference into a claim about collective cognition.
Likewise, anchoring agents to people's initial beliefs preserves starting
answers but does not reproduce human willingness to speak, revise, disengage,
or leave a discussion unresolved.

Evaluations of simulated committees, juries, panels, or user populations should
therefore report at least four quantities separately:

1. **participation** — who emitted a usable contribution;
2. **agreement among participants** — conditional on speaking or submitting;
3. **group resolution** — how abstentions and missing final states are treated;
4. **accuracy or external validity** — whether agreement was correct or matched
   the human outcome distribution.

A useful minimum design is to pre-register the consensus denominator, score
nonparticipation explicitly, and run both submit-based and
participation-matched comparisons. Early stopping should also be ablated so a
protocol does not convert fast convergence into an apparently stronger group
result. Most importantly, consensus should never be used as a proxy for
correctness without a separate outcome measure.

This complements the library's finding that identical evidence can make agent
Delphi processes [collapse into herding](../agent-evaluation-research-beyond-outputs.md#24-the-plausibility-gradient-2026-07-06). The present paper adds a distinct
measurement warning: even when initial beliefs are matched, participation and
final-state rules can exaggerate how human-like that convergence is.

## Evidence boundary

Scout reviewed the live v1 arXiv metadata and complete abstract. A bounded
request to the arXiv HTML endpoint returned HTTP 404, so the full paper was not
available through that route. The paper text, prompts, model identities,
temperatures, human recruitment, exact scoring definitions, code, uncertainty
estimates, and post-unblinding analysis rationale were not inspected. All
numbers above are author-reported abstract claims from one reasoning task and
should not be generalized to other deliberative settings without replication.
The abstract supports a measurement warning, not a claim that every LLM group
is more conformist than every human group.
