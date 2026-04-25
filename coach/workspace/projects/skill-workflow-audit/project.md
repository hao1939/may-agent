# Project: Skill & Workflow Audit

**Status**: active
**Owner**: coach
**Type**: milestone
**Workflow**: master-worker
**Priority**: P0
**Iteration**: 0
**Health**: —

## Goal
Verify every skill and workflow in the system. For each one: does it parse? is it referenced? is it useful? Produce a report so we can decide what to keep, fix, or remove.

## Milestones

### Skills Audit ✅
- [x] For each of the 56 skills: read it, check if it's referenced by any agent config/prompt, rate quality (good/mediocre/junk), write one-line verdict
- [x] Produce .state/skills-audit.md — table with: name, referenced-by, quality, verdict, recommendation (keep/fix/archive)

### Workflows Audit ✅
- [x] For each of the 29 workflows: read it, check if it parses (import test), check if it's referenced in cron.json, note any obvious bugs
- [x] Produce .state/workflows-audit.md — table with: name, owner, referenced-by, parses, verdict, recommendation

## Resources
- Skills: agents/shared/skills/ (56 items)
- Shared workflows: agents/shared/workflows/*.ts (10 files)
- Per-agent workflows: agents/*/workflows/*.ts (19 files)
- Cron config: agents/may/cron.json
- Agent configs: agents/*/agent.json

## Current State
Skills audit complete (MS1). Workflows audit complete (MS2). Both milestones done — 29/29 workflows parse, 0 orphaned (contrast: 77% skills orphaned). Next: decide what action to take on findings (archive orphan skills? fix delivery?).

## Process Notes

## Comments
- [2026-04-25] (web) you should first try it and evaluator whether it works!
