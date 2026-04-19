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

## How to Drive It

### Detection
Optimizer reviews session transcripts for patterns:
- Agent does 3+ tool calls in a recognizable sequence → candidate for workflow
- Same sequence appears in multiple sessions → confirmed repeat task
- Agent's heartbeat describes a multi-step process in prose → should be a workflow

### Creation
When a pattern is detected:
1. Design the workflow (steps, inputs, outputs)
2. Implement as `agents/<owner>/workflows/<name>.ts` or `agents/shared/workflows/<name>.ts`
3. Test with gym or direct execution
4. Add to the agent's preferred workflows section
5. Monitor adoption

### Monitoring
Track via metrics:
- Are agents using the workflow? (tool call data)
- Does it complete successfully? (workflow run records)
- Is it better than freestyle? (compare quality/efficiency)

## Milestones

- [x] Audit table created with all known workflows
- [x] Dead workflows identified and confirmed removed (auto-loop, skill-lifecycle, coaching-feedback, error-scan — no workflow files exist)
- [x] Audit table updated with accurate usage data from codebase scan
- [ ] Convert top candidate pattern to a new workflow
- [ ] Measure workflow-coverage metric baseline

## Current Workflows (audit — updated 2026-04-19)

| Workflow | Location | Usage | Status |
|----------|----------|-------|--------|
| persistent-task | shared/workflows/ | Active, core | ✅ Keep |
| implement-and-verify | shared/workflows/ | Active | ✅ Keep |
| implement-and-review | shared/workflows/ | Active | ✅ Keep |
| verify-wrap | shared/workflows/ | Active | ✅ Keep |
| parallel-research | shared/workflows/ | Low | ⚠️ Monitor |
| growth-cycle | coach/workflows/ | Active | ✅ Keep |
| training-sprint | coach/workflows/ | Active | ✅ Keep |
| verified-coder | tech-lead/workflows/ | Active | ✅ Keep |
| lens-analysis | tech-lead/workflows/ | Active | ✅ Keep |
| project-monitor | may/workflows/ | Active | ✅ Keep |
| vet-skill | qa/workflows/ | Active | ✅ Keep |
| safe-edit | optimizer/workflows/ | Active | ✅ Keep |
| design-review | optimizer/workflows/ | Active | ✅ Keep |
| investigate-and-fix | optimizer/workflows/ | Active | ✅ Keep |
| enhance-cron | optimizer/workflows/ | Active | ✅ Keep |

### Removed (confirmed no workflow files exist)
- ~~auto-loop~~ — never implemented as workflow
- ~~skill-lifecycle~~ — only a skill dir, not a workflow
- ~~coaching-feedback~~ — no workflow file found
- ~~error-scan~~ — no workflow file found

## Candidate Patterns to Convert

From agent self-assessments and session archaeology:
- Coach: diagnose failure → design intervention → test in gym → deploy → measure (growth cycle exists but is it used?)
- Bob: find paper → evaluate → write deep dive → generate hypothesis → link to system
- Tech-lead: pick lens → investigate → write finding → dispatch fix
- Scout: triage arXiv → filter → deep dive → cross-reference
- May: receive request → triage → dispatch to agent → follow up

