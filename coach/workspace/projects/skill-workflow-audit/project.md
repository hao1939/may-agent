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

### Skills Audit
- [ ] For each of the 56 skills: read it, check if it's referenced by any agent config/prompt, rate quality (good/mediocre/junk), write one-line verdict
- [ ] Produce .state/skills-audit.md — table with: name, referenced-by, quality, verdict, recommendation (keep/fix/archive)

### Workflows Audit
- [ ] For each of the 29 workflows: read it, check if it parses (import test), check if it's referenced in cron.json, note any obvious bugs
- [ ] Produce .state/workflows-audit.md — table with: name, owner, referenced-by, parses, verdict, recommendation

## Resources
- Skills: agents/shared/skills/ (56 items)
- Shared workflows: agents/shared/workflows/*.ts (10 files)
- Per-agent workflows: agents/*/workflows/*.ts (19 files)
- Cron config: agents/may/cron.json
- Agent configs: agents/*/agent.json

## Current State
No audit done. 56 skills mostly unreferenced. 29 workflows of unknown quality.

## Process Notes

## Comments
