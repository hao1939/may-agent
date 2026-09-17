---
title: "XHS: Robot-use agents need physical interfaces and feedback-aware evaluation"
source: xhs
date: 2026-09-14
last_updated: 2026-09-16
type: finding
tags: [xhs, embodied-agents, robotics, evaluation, resource-map]
relevance: medium
---

<ai_context>
summary: "A current XHS project announcement frames robot-use agents as a distinct resource and evaluation category spanning perception/control interfaces, execution feedback, simulators, datasets, and physical demonstrations. The collection is a useful discovery map, not evidence that the listed systems work or transfer from simulation to robots."
triggers: ["robot-use agent", "embodied agent resources", "robot agent evaluation", "Awesome Robot Use Agent", "physical agent feedback"]
</ai_context>

# Robot-use agents need physical interfaces and feedback-aware evaluation

## Current XHS observation

A detail-read XHS post by the maintainer of **Awesome Robot Use Agent (RUA)** announces a searchable collection of papers, projects, tools, datasets, benchmarks, and community demonstrations for agents that act through robots. The author distinguishes this scope from computer-use agents: robot-use systems must connect task understanding and planning to perception and control interfaces, then use observations and execution feedback to check outcomes and revise the plan.

The collection also separates real-robot demonstrations, simulation experiments, and supporting perception or reconstruction demonstrations. That taxonomy is the useful signal. “Embodied agent” is too broad an evaluation label unless a report names:

1. the action surface and control interface;
2. the observation and feedback available after an action;
3. whether the result comes from simulation, a physical robot, or only a supporting perception component;
4. the task and benchmark used to judge completion;
5. whether code, data, and original demonstration provenance are available.

A polished demo in one category does not establish capability in another. In particular, simulation success is not physical-world reliability, and a perception or reconstruction demo is not closed-loop task execution.

## Update: “Agent as Policy” makes runtime adaptation part of the policy

A newly detail-read XHS research explainer describes **Agent as Policy (AGP)**, in which a general-purpose agent interprets visual evidence, writes executable programs, issues robot motions, observes physical results, and revises its actions at runtime. The post says the system receives no task- or environment-specific training and was exercised on assembly from human video, target-image block construction, dice rolling, directed throwing, and dual-arm towel folding. It reports at least 8 successes in 10 trials for every evaluated configuration of assembly, block construction, and dice rolling, and says reusing saved programs and procedures shortened repeat-trial execution time.

This sharpens the resource map's evaluation checklist in two ways. First, “policy” can include an agentic program-generation and feedback loop rather than only a learned low-level controller, so evaluations should state which layer produced each action. Second, reuse of saved programs is a separate efficiency claim from first-attempt task success: reports should disclose whether a trial is cold-start or experience-assisted and measure both success rate and execution time.

The XHS body is a secondary summary and does not identify the paper or expose per-task trial tables. Its reported counts therefore remain discovery evidence, not independently verified performance evidence.

## Evidence boundary

- Scout read the current XHS post body rather than inferring from its search card.
- The post itself supplies the project website and GitHub repository and says entries preserve original sources, but this XHS-only run did not inspect or validate the external collection, its coverage, or its maintenance process.
- The post showed 70 likes, 92 collections, and 12 comments at inspection. The visible comments were brief encouragement rather than technical evaluation, so engagement indicates early interest, not efficacy.
- Claims about specific systems—such as the post's referenced GPT-6 Astra demonstrations—require inspection of their original sources before reuse.

## Sources

- **Source:** https://www.xiaohongshu.com/explore/6aa7bf8000000000120341db
- **Stable item ID:** `6aa7bf8000000000120341db`
- **Source (Agent as Policy explainer):** https://www.xiaohongshu.com/explore/6aa927ea00000000260086f8
- **Stable item ID:** `6aa927ea00000000260086f8`
- **Project listed by the post (not inspected in this run):** https://github.com/kairunwen/Awesome-Robot-Use-Agent
- **Website listed by the post (not inspected in this run):** https://kairunwen.github.io/Awesome-Robot-Use-Agent/
