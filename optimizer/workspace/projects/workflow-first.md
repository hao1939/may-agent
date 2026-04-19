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

## Current Workflows (audit — updated iter 29 with real data from 980 workflow runs)

| Workflow | Runs | Owner | Keep? |
|----------|------|-------|-------|
| verify-wrap | 558 | shared | ✅ Keep — most used by far |
| lens-analysis | 143 | tech-lead | ✅ Keep — core tech-lead workflow |
| persistent-task | 64 | shared | ✅ Keep — project engine |
| deliver-or-report | 53 | bob | ✅ Keep — bob's primary workflow |
| parallel-research | 49 | shared | ✅ Keep — actively used |
| implement-and-verify | 48 | shared | ✅ Keep — code changes |
| error-scan | 29 | optimizer | ✅ Keep — moderate usage |
| growth-cycle | 13 | coach | ✅ Keep — coach core |
| investigate-and-fix | 12 | optimizer | ✅ Keep |
| coaching-feedback | 10 | coach | ✅ Keep — low but active |
| verified-coder | 1 | tech-lead | ⚠️ Review — barely used |

**Removed (confirmed dead, 0 runs):** auto-loop, skill-lifecycle

**Additional workflow files with no run data:** safe-edit, design-review, enhance-cron, implement-and-review, fewshot-inject-helpers, training-sprint, gym-helpers, project-monitor, vet-skill

## Candidate Patterns to Convert

From agent self-assessments and session archaeology:
- Coach: diagnose failure → design intervention → test in gym → deploy → measure (growth-cycle exists, 13 runs ✅)
- Bob: find paper → evaluate → write deep dive → generate hypothesis → link to system
- Tech-lead: pick lens → investigate → write finding → dispatch fix (lens-analysis exists, 143 runs ✅)
- Scout: triage arXiv → filter → deep dive → cross-reference
- May: receive request → triage → dispatch to agent → follow up

### 🎯 Top candidate for next workflow: **Scout research pipeline**
Scout has 1009 sessions, 0 workflow adoption (only 2 runs total), and a clear repeating pattern: triage arXiv → filter relevance → deep dive on selected papers → cross-reference with system knowledge → produce synthesis. This is the highest-volume agent without a workflow. May's project-monitor workflow file exists but has 0 runs — that's the #2 candidate.

## Log

- **Iter 29**: Updated audit table with real run counts (980 total runs across 11 workflows). Removed auto-loop and skill-lifecycle (0 runs). Identified Scout research pipeline as top candidate for next workflow.
