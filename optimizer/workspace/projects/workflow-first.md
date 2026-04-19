# Project: Workflow-First Culture

**Status**: active
**Owner**: optimizer
**Priority**: P0

## Goal

Make workflows the default way agents work. When an agent does something repeatedly, enforces a process, or builds stable operations — it should be a workflow.

## Three Principles

### 1. Repeat tasks → workflow
When an agent does the same pattern more than twice (investigate → diagnose → fix, research → synthesize → write), that pattern should become a workflow. The workflow captures the process so it's consistent every time.

### 2. Enforcement → workflow or guard
When something needs to happen reliably (verify after write, check metrics before deciding), it should be structural. If it's per-session process → workflow. If it's a quality check across all sessions → guard.

### 3. Stable operations → workflow
When a process is proven and should be reused (persistent-task for projects, implement-and-verify for code), it's a workflow. Not instructions in a doc — executable process.

## Metrics

| Metric | Type | What it measures | Target |
|--------|------|-----------------|--------|
| `optimizer.workflow-coverage` | continuous | % of multi-step work that uses a workflow | 80% |
| `optimizer.repeat-task-detection` | continuous | Repeat patterns identified and converted to workflows per week | ≥2 |
| `optimizer.workflow-effectiveness` | health | % of workflow runs that complete successfully vs freestyle | >90% |

## Current Workflows (audit — updated iter 27)

| Workflow | Location | Status |
|----------|----------|--------|
| persistent-task | shared/workflows/ | ✅ Active, core |
| implement-and-verify | shared/workflows/ | ✅ Active |
| implement-and-review | shared/workflows/ | ✅ Active |
| verify-wrap | shared/workflows/ | ✅ Active |
| parallel-research | shared/workflows/ | ⚠️ Rare — review |
| fewshot-inject-helpers | shared/workflows/ | ✅ Active |
| safe-edit | optimizer/workflows/ | ✅ Active |
| design-review | optimizer/workflows/ | ✅ Active |
| investigate-and-fix | optimizer/workflows/ | ✅ Active |
| enhance-cron | optimizer/workflows/ | ✅ Active |
| growth-cycle | coach/workflows/ | ✅ Active |
| training-sprint | coach/workflows/ | ✅ Active |
| gym-helpers | coach/workflows/ | ✅ Active |
| verified-coder | tech-lead/workflows/ | ✅ Active |
| lens-analysis | tech-lead/workflows/ | ✅ Active |
| project-monitor | may/workflows/ | ✅ Active |
| vet-skill | qa/workflows/ | ✅ Active |
| auto-loop | — | ❌ Removed (confirmed not on disk) |
| skill-lifecycle | — | ❌ Removed (confirmed not on disk) |
| error-scan | — | ❌ Removed (confirmed not on disk) |

**Total**: 17 active workflows across 5 agents + shared.

## Candidate Patterns to Convert

From agent self-assessments and session archaeology:
- **review-output** — Coach/tech-lead "review-only assessment" freestyle pattern → standardize as workflow
- Bob: find paper → evaluate → write deep dive → generate hypothesis → link to system
- Tech-lead: pick lens → investigate → write finding → dispatch fix
- Scout: triage arXiv → filter → deep dive → cross-reference
- May: receive request → triage → dispatch to agent → follow up

## Milestones

- [x] Audit table updated with accurate filesystem data (iter 27)
- [x] Confirmed dead workflows removed: auto-loop, skill-lifecycle, error-scan
- [x] Discovered 17 actual workflows (was tracking only 8)
- [ ] Evaluate parallel-research usage — keep or remove?
- [ ] Design and create review-output workflow from freestyle pattern
- [ ] Measure workflow-coverage metric baseline
