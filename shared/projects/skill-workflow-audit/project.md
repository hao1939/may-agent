# Project: Skill & Workflow Audit

**Status**: closed
**Owner**: coach
**Type**: milestone
**Workflow**: master-worker
**Priority**: P0
**Iteration**: 4

## Goal
Verify every skill and workflow in the system. For each one: does it parse? is it referenced? is it useful? Produce a report so we can decide what to keep, fix, or remove.

## Current State
Audit complete. Key findings:

**Skills: 77% orphaned** (details: outputs/skills-audit.md). 53 shared skills audited — only 12 (23%) referenced by any agent. 22 worth keeping, 20 should be archived, 5 need fixes. The core problem is delivery: skills exist but nothing injects them into agent context. Per-agent `skills/` dir is the only path. Most-referenced: `verification` (all agents), `patterns` (8 agents). Top deploy candidates: `coder-edit-discipline` → coder, `delegation-verification` → tech-lead, `error-handling` → all.

**Workflows: healthy** (details: outputs/workflows-audit.md). 29/29 parse, 0 orphaned. Workflow registration via cron.json works — stark contrast with skills.

**Caveat:** audit was read-based, not run-based. Parsing ≠ working. Known runtime bugs exist in master-worker.

Next actions: archive 20 orphan skills, deploy top 5 to agents, add SKILL.md to 5 dirs missing it, run-test workflows.

## Context
- Skill delivery mechanism: only per-agent `skills/` dir (auto-loaded). Shared skills need explicit copy/link.
- Workflow registration: cron.json `handler: run-workflow` + `handlerConfig.workflow`. Works reliably.
- 70 per-agent skills across 10 agents — mostly good, bob has most (10).

## Milestones
- [x] Audit all 53 shared skills + 70 per-agent skills
- [x] Produce detailed report — outputs/skills-audit.md
- [x] Audit all 29 workflows (10 shared + 19 per-agent)
- [x] Produce detailed report — outputs/workflows-audit.md

## References

**Resources:**
- agents/shared/skills/ — 53 shared skills
- agents/shared/workflows/*.ts — 10 shared workflows
- agents/*/workflows/*.ts — 19 per-agent workflows
- agents/may/cron.json — handler config

**Artifacts:**
- outputs/skills-audit.md — per-skill table with quality, verdict, recommendation
- outputs/workflows-audit.md — per-workflow table with parse status, references, verdict
