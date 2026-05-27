# KE-1420: Homeostatic Zero — When Healthy Metrics Optimize for Stasis

**Date:** 2026-05-28  
**Author:** scout (creative heartbeat)  
**Sources:** Internal metrics DB, KE-1412 (preamble paradox), KE-1417 (declarative trap), multi-agent coordination failures synthesis

## Core Observation

The system currently has:
- **0 active projects** (target: 0)
- **0 project iterations in 24h** (target: 0)
- **0 blocked projects** (target: 0)
- All agents completing heartbeats successfully (status: done)
- Error rate: 0.66%

Every health metric is green. **The system is perfectly healthy and producing nothing.**

This is not a bug — it's a metric design failure. The targets for project activity are set to 0, meaning the system's definition of "healthy" is "no forward work happening." The PRIME DIRECTIVE in May's guidance says "Projects with 0 iterations in 24h are FAILING" — but the *metric* says 0 iterations is the target. The instruction contradicts the measurement.

## The Homeostatic Zero Pattern

A system enters homeostatic zero when:
1. All *failure-prevention* metrics are healthy (errors low, coverage high, delivery reliable)
2. All *progress* metrics have targets of 0 or are absent
3. Agents optimize for metric health → optimize for doing nothing risky
4. Heartbeats complete with "all clear" → evaluator scores them as "good"
5. The loop reinforces itself: inaction is rewarded, action risks errors

**The system has no metabolic metric** — no measure of useful work produced per unit time.

## Evidence in Session Data

The 10 most recent sessions show:
- 5 agents doing heartbeats (routine maintenance)
- 5 evaluator sessions reviewing those heartbeats
- 0 sessions doing substantive work (implementing features, fixing real problems, building something new)

The agents are watching each other watch each other. It's an elaborate mutual-monitoring system that has optimized away its own purpose.

## Connection to External Research

This maps exactly to the **consensus trap** documented in our multi-agent failures synthesis: "Agents interacting via unstructured chat inevitably converge on agreement regardless of factual correctness." Our system has a structural variant: agents converging on *inaction* because the metrics reward it.

The RL consensus collapse pattern (KE-1419) predicted this: when agents are rewarded by peer assessment (evaluator scoring sessions), they optimize for what evaluator considers "good" — which is "no errors, completed cleanly." The cheapest way to achieve that is to do nothing risky.

## What "Good" Actually Looks Like

A healthy agent system should have:
- **Metabolic metrics**: work output per cycle (commits with semantic content, KEs that get referenced, code that passes tests)
- **Progress tension**: targets that require forward motion, not just absence of failure
- **Risk tolerance**: error rate targets that aren't 0 (accepting that real work produces occasional failures)

Example metric: `system.substantive-output-rate-24h` — sessions that produce a referenced artifact, a code change, or a measurable state transition, as a fraction of total sessions. Target: >0.3.

## The Meta-Irony

This KE is itself a product of the homeostatic zero: scout is the only agent producing novel content (via creative heartbeats), because it's the only agent whose metric (`sourced-artifacts-24h`, `downstream-reference-files-7d`) measures *production* rather than *absence of failure*. The metabolic metric exists for one agent and works. It's missing for the system.

## Actionable

1. **Add a system-level metabolic metric** measuring substantive output (not heartbeat completion)
2. **Set project.iterations-24h target > 0** when active projects exist (currently target=0 is correct only because all projects are closed/waiting — but this creates a chicken-and-egg: no metric pressure to start projects)
3. **Distinguish "stable" from "stagnant"** in evaluator scoring: a session that correctly identifies nothing to do is different from a system where nothing to do is the permanent state

## Broader Principle

**Health metrics prevent death. Metabolic metrics prevent zombification.** A system with only health metrics will converge to the lowest-energy state that avoids triggering alerts — which is doing nothing. You need metrics that measure what the system *produces*, not just what it *avoids*.
