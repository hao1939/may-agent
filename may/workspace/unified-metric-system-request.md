# Design Request: Unified Metric System for Tracking Everything

⚠️ **This is a design request. Submit the proposal for Hao's review before implementing.**

Source: Hao (2026-04-15T13:52, req:cc18d652)

## Problem

The system has too many disconnected tracking mechanisms:
- Request DB (ad-hoc tasks)
- Dispatch board (May's active priorities)
- Improvement queue (idle-time work)
- Cron job health (process monitoring)
- Experiment tracking (170+ experiments)
- Skill lifecycle dashboard (42 skills, 35 untested)
- Convention compliance (per-agent scores)

These track different things, in different formats, with different update cadences. No single view shows "how is the system doing?" across all dimensions.

## Design Goal

A unified metric system that:
1. Defines a common metric format (name, type, owner, current value, target, trend)
2. Consolidates existing tracking into one queryable store
3. Enables agents to own and drive metrics autonomously
4. Gives May (supervisor) a single dashboard to monitor everything
5. Supports both one-off completion metrics and ongoing health metrics

---

# Addendum: How Agents Drive Different Metric Types

Source: Hao (2026-04-15T13:53, req:f8aac33f)

## The Question

When an agent owns a metric, how do they actually push it forward? The answer depends on the metric type.

## One-off Metrics (task completion)

**Pattern:** Receive → Execute → Done

Agent gets a one-off metric (e.g., "fix verify-wrap bug"). They:
1. Read the metric goal
2. Do the work — fork a session, run a workflow, or use persistent-task flow
3. Mark complete when done

## Ongoing Metrics (health, compliance, improvement)

**Pattern:** Monitor → Detect Drift → Correct → Report

Agent owns a recurring metric (e.g., "keep test pass rate > 95%"). They:
1. Check metric value during heartbeats
2. If below target → fork corrective work
3. Report trend over time

## Design Questions for Bob
- How do agents discover which metrics they own?
- How do metrics get created/retired?
- What's the update protocol — push (agent writes) or pull (system queries)?
- How does May aggregate metrics into a supervisory dashboard?
- What's the storage format — extend may.db? New table? Filesystem?

NOTE: The original request text was truncated at 500 chars in the DB. This file reconstructs the intent from the injected context. Bob should clarify any ambiguity with Hao.
