# Project: Agent System Literacy

**Status**: active
**Owner**: bob
**Workflow**: master-worker
**Type**: continuous
**Priority**: P1
**Iteration**: 11
**Health**: —

**Stop Reason**: 

All 13 milestones are delivered:
- **Phase 1:** 5 skills written ✅
- **Phase 2:** 4 gym scenarios + baseline measurement ✅
- **Phase 3:** Failure anal
**Resume Condition**: 
## Goal
Agents should know how to use the infrastructure effectively — create projects, use workflows, read metrics, escalate when stuck. Teach via skills, measure via gym benchmarks.

## Metrics
- system.project-creation-rate: how often agents create projects from heartbeat discoveries
- system.escalation-quality: % of escalations that include context (reason, what was tried)

## What Agents Need to Learn

| Skill | What | When to use |
|-------|------|------------|
| **Creating projects** | How to set up project.md with goal, milestones, metrics, resources | When heartbeat finds a sustained problem |
| **Project workflow** | How iterations work, what worker/reviewer do, how milestones track | When working inside a project |
| **Reading metrics** | What ✅/📉/🔴 mean, how to investigate red metrics | Every heartbeat |
| **Escalation** | When to finish(blocked), what context to include, the chain | When stuck after real attempts |
| **Agent cooperation** | fork (dispatch), call (sync), Notify (FYI), agents.list/peek | When dispatching or cooperating |
| **Adding comments** | How to unblock another agent's project with a comment | When you can help another agent |

## Milestones

### Phase 1: Skills ✅
- [x] Write skill: creating-projects.md → agents/shared/skills/creating-projects/skill.md
- [x] Write skill: working-in-projects.md → agents/shared/skills/working-in-projects/skill.md
- [x] Write skill: reading-metrics.md → agents/shared/skills/reading-metrics/skill.md
- [x] Write skill: escalation.md → agents/shared/skills/escalation/skill.md
- [x] Write skill: helping-others.md → agents/shared/skills/helping-others/skill.md

### Phase 2: Benchmarks
- [x] Gym scenario: agent finds a problem in heartbeat, should create a project
- [x] Gym scenario: agent is stuck in a project, should escalate properly
- [x] Gym scenario: agent sees a red metric, should investigate and act
- [x] Gym scenario: agent sees another agent's blocked project, should help
- [x] Measure baseline: run each scenario 5x per agent

### Phase 3: Improve
- [x] Identify which agents fail which scenarios
- [x] Iterate on skills based on failure patterns
- [x] Re-measure and track improvement

## Resources
- Shared skills directory: agents/shared/skills/
- Gym scenarios: agents/gym/scenarios/
- Common-sense.md: agents/shared/common-sense.md
- Project system design: agents/shared/may-agent-docs/design/project-system.md
- Debugging skill (exists): agents/shared/skills/debugging-handlers-workflows.md

## Current State
done: **Decision: DONE** — Mark this project complete.

All 13 milestones are delivered:
- **Phase 1:** 5 skills written ✅
- **Phase 2:** 4 gym scenarios + baseline measurement ✅
- **Phase 3:** Failure anal

## Process Notes

## Comments

## Iteration Summary
- **Iter 2**: CONTINUE. Good progress.

- **Iter 3**: CONTINUE. Good progress.

- **Iter 4**: CONTINUE. Good progress.

- **Iter 5**: CONTINUE. Good progress.

- **Iter 7**: All the needed scenarios already exist. The milestone "Gym scenario: agent finds a problem in heartb

- **Iter 8**: All 4 scenarios created and validated.

- **Iter 9**: Now I have the baseline. Let me note this is a "criteria-only" mode (evaluating the scenario text it

