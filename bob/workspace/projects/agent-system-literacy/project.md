# Project: Agent System Literacy

**Status**: active
**Owner**: bob
**Type**: continuous
**Priority**: P1
**Iteration**: 0
**Health**: —

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

### Phase 1: Skills
- [ ] Write skill: creating-projects.md (when, how, what goes in project.md)
- [ ] Write skill: working-in-projects.md (iterations, milestones, reviewer, evaluator)
- [ ] Write skill: reading-metrics.md (three states, investigating, acting)
- [ ] Write skill: escalation.md (when, how, what context)
- [ ] Write skill: helping-others.md (adding comments, forking investigations)

### Phase 2: Benchmarks
- [ ] Gym scenario: agent finds a problem in heartbeat, should create a project
- [ ] Gym scenario: agent is stuck in a project, should escalate properly
- [ ] Gym scenario: agent sees a red metric, should investigate and act
- [ ] Gym scenario: agent sees another agent's blocked project, should help
- [ ] Measure baseline: run each scenario 5x per agent

### Phase 3: Improve
- [ ] Identify which agents fail which scenarios
- [ ] Iterate on skills based on failure patterns
- [ ] Re-measure and track improvement

## Resources
- Shared skills directory: agents/shared/skills/
- Gym scenarios: agents/gym/scenarios/
- Common-sense.md: agents/shared/common-sense.md
- Project system design: agents/shared/may-agent-docs/design/project-system.md
- Debugging skill (exists): agents/shared/skills/debugging-handlers-workflows.md

## Current State
Not started.

## Process Notes

## Comments
- [2026-04-23 hao] Skills teach agents how to use the system. Benchmarks measure if they actually do. This is how we make agents system-literate — not by dumping docs in their prompt, but by giving them skills they can read on demand and scenarios that test real usage.
