# Project: Workflow-First Culture

**Status**: active
**Owner**: optimizer
**Priority**: P0

## Goal

Make workflows the default way agents work. When an agent does something repeatedly, enforces a process, or builds stable operations — it should be a workflow.

## Three Principles

### 1. Repeat tasks → workflow
When an agent does the same pattern more than twice, that pattern should become a workflow.

### 2. Enforcement → workflow or guard
When something needs to happen reliably, it should be structural.

### 3. Stable operations → workflow
When a process is proven and should be reused, it's a workflow — not instructions in a doc.

## Metrics

| Metric | Type | Target |
|--------|------|--------|
| `optimizer.workflow-coverage` | continuous | 80% of multi-step work uses workflows |
| `optimizer.repeat-task-detection` | continuous | ≥2 patterns converted/week |
| `optimizer.workflow-effectiveness` | health | >90% workflow success rate |

## Current Workflows (audit)

| Workflow | References | Status |
|----------|-----------|--------|
| verify-wrap | 539 | ✅ Keep — heavily used |
| growth-cycle | 85 | ✅ Keep — core coaching |
| parallel-research | 54 | ✅ Keep — active |
| implement-and-verify | 49 | ✅ Keep — code changes |
| implement-and-review | 49 | ✅ Keep |
| persistent-task | 36 | ✅ Keep — project engine |
| training-sprint | 29 | ✅ Keep |
| skill-lifecycle | 19 | ⚠️ Low — review |
| auto-loop | 5 | ⚠️ Low — review |
| coaching-feedback | 0 | ❌ Dead — remove |
| error-scan | 0 | ❌ Dead — remove |

## Milestones

- [x] Audit all workflows with reference counts
- [x] Remove dead workflows (coaching-feedback, error-scan) — confirmed: no files exist on disk
- [x] Review low-usage workflows (auto-loop, skill-lifecycle) — already deleted per REGISTRY.md
- [ ] Convert 1 candidate pattern into a new workflow
- [ ] Measure workflow coverage baseline

## Candidate Patterns to Convert

- Bob: find paper → evaluate → write deep dive → generate hypothesis → link to system
- Tech-lead: pick lens → investigate → write finding → dispatch fix
- Scout: triage arXiv → filter → deep dive → cross-reference
- May: receive request → triage → dispatch to agent → follow up

## Next Action

1. Remove dead workflows (coaching-feedback, error-scan) — 0 references, no files exist on disk.
2. Review low-usage: auto-loop (5 refs), skill-lifecycle (19 refs) — are they defined anywhere?
3. Pick highest-value candidate pattern and design a workflow for it.
