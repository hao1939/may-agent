<ai_context>
summary: "An arXiv abstract reports that decision models which act poorly in long-horizon environments can still provide useful retrospective action labels and improve a smaller policy through reinforcement learning. The evidence supports evaluating actor, judge, and teacher roles separately, but Scout did not inspect the paper, code, trajectories, reward construction, training runs, or statistical analysis."
triggers: ["decision model", "actor judge teacher", "long-horizon agent", "retrospective action evaluation", "credit assignment", "ALFWorld", "WebShop", "2611.17167"]
last_updated: "2026-11-14"
source_basis: "arXiv:2611.17167v1 title, metadata, and abstract retrieved through the workflow-owned cs.AI feed request."
</ai_context>

# Poor agent actors can still teach

**Date:** 2026-11-14  
**Source:** [Actor, Judge, or Teacher? Understanding Decision Models in Long-Horizon Agents](https://arxiv.org/abs/2611.17167v1)  
**Source revision:** arXiv:2611.17167v1  
**Coverage:** Title, metadata, and abstract only  
**Disposition:** New knowledge

## Question

Should a model be rejected as an agent evaluator or reinforcement-learning teacher merely because it performs poorly when directly controlling the same long-horizon agent?

## What the abstract reports

The paper distinguishes three roles for a typed-output decision model:

1. **Actor:** choose the agent's next action.
2. **Judge:** evaluate actions after they have been taken.
3. **Teacher:** score actions to train a policy with reinforcement learning.

The authors compare three decision models and three general LLMs as actors and judges on ALFWorld, then use JEV as a teacher on ALFWorld and WebShop. The abstract reports that all six models, when acting, are distracted from a prerequisite subgoal by an easier one. When judging complete trajectories, however, the same models credit steps toward the prerequisite. It further says that asking whether each action helped, rather than whether the whole task would succeed, better separates useful from useless actions.

As a teacher, JEV reportedly raises a Qwen2.5-1.5B policy trained with GRPO from **72.8% to 82.9%** success on ALFWorld and from **56.8% to 71.4%** on WebShop. The paper's proposed explanation is informational: retrospective judgment can see consequences that an actor must anticipate before they occur.

## Scout interpretation

Actor quality, retrospective judgment quality, and teaching value are different measurements. A model can be weak at online planning yet useful after the episode because the completed trajectory exposes which actions advanced a necessary subgoal and which were attractive distractions. Evaluations should therefore avoid using direct task success as the sole admission test for critics, process judges, or reward models.

The abstract also suggests a more precise supervision target for long-horizon agents: score whether an action helped from the eventual trajectory, rather than asking only whether success remained likely. The former can preserve credit for prerequisite work even when later actions fail, while a coarse episode-success forecast may erase useful local decisions.

A practical evaluation should keep at least four receipts separate:

- **Actor receipt:** success and failure modes when the model chooses actions online with only current information.
- **Retrospective-judge receipt:** agreement with action-level labels after seeing the complete trajectory.
- **Teacher receipt:** held-out policy improvement after training on those scores.
- **Cost and transfer receipt:** inference, training, calibration, and whether gains persist across tasks, policies, models, and environments.

This separation matters for agent systems that already use specialized planners, reviewers, graders, or helper models. A model that should not control tools may still be useful as an offline diagnostic or bounded training signal. That does not make it safe as an online authorization gate: retrospective labels arrive too late to prevent an effect, and policy improvement does not prove calibration for high-consequence individual actions.

## Retrieval record

The workflow-owned bounded request checked:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 469 ms
- **Request count:** 1
- **Retry-After:** not present

## Evidence limits

Scout reviewed only the arXiv feed's title, metadata, and abstract. The full paper, decision-model identities and versions, prompts, typed output spaces, ALFWorld and WebShop protocols, trajectory sampling, action labels, judge metrics, GRPO configuration, reward scaling, baselines, repeated runs, variance, statistical tests, failure cases, compute, code, and data were not inspected.

The reported before-and-after policy scores do not by themselves isolate which component caused the gains, whether direct outcome rewards or alternative critics would perform similarly, or whether the trained policy preserved behavior outside the evaluated tasks. The abstract does not establish that a poor actor is always a useful judge, that retrospective judgment is well calibrated, or that teacher gains transfer to irreversible or safety-critical decisions. It supports role-specific evaluation, not automatic promotion of weak actors into runtime judges or teachers.
