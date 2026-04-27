# Project: Skill & Workflow Audit

**Status**: closed
**Owner**: coach
**Type**: milestone
**Workflow**: master-worker
**Priority**: P0
**Iteration**: 4

## Goal
Verify every skill and workflow in the system. For each one: does it parse? is it referenced? is it useful? Produce a report so we can decide what to keep, fix, or remove.

## Milestones

### Skills Audit
- [x] Audit all 53 shared skills + 70 per-agent skills
- [x] Produce detailed report — outputs/skills-audit.md

### Workflows Audit
- [x] Audit all 29 workflows (10 shared + 19 per-agent)
- [x] Produce detailed report — outputs/workflows-audit.md

## Findings

### Skills: 77% orphaned
- **53 shared skills** audited: 22 keep, 5 fix, 20 archive, 6 junk
- **Only 12/53 (23%) referenced** by any agent config or prompt
- **Most referenced**: `verification` (all agents), `patterns` (8 agents), `evidence-over-narrative` (shared)
- **Delivery problem**: skills exist but no mechanism injects them into agent context. Per-agent skills/ dir is the only delivery path.
- **Top deploy candidates**: `coder-edit-discipline` to coder, `delegation-verification` to tech-lead, `error-handling` to all

### Workflows: healthy
- **29/29 parse** without errors
- **0 orphaned** — all referenced in cron, code, or docs
- **Contrast with skills**: workflow registration via cron.json works; skill delivery doesn't

## Recommended Actions
- Archive 20 orphaned skills — unreferenced, untested, adding noise
- Deploy top 5 skills to agents that need them (copy to per-agent skills/)
- Add SKILL.md to 5 directories missing it (escalation, growth-cycle, etc.)
- Run-test workflows — this audit checked parsing, not execution. Known runtime bugs exist.

## Artifacts
- outputs/skills-audit.md — per-skill table with quality, verdict, recommendation
- outputs/workflows-audit.md — per-workflow table with parse status, references, verdict

## Comments
- [2026-04-25 hao] you should first try it and evaluate whether it works!
- Note: audit was read-based, not run-based. Parsing does not equal working.
