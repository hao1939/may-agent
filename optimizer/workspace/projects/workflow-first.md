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

## Current Workflows (audit — updated iteration 5)

| Workflow | Owner | Refs | Status |
|----------|-------|------|--------|
| growth-cycle | coach | 200 | ✅ Core — most referenced workflow |
| verify-wrap | shared | 165 | ✅ Core — heavy use across agents |
| persistent-task | shared | 158 | ✅ Core — project engine |
| implement-and-review | shared | 109 | ✅ Active |
| training-sprint | coach | 105 | ✅ Active |
| implement-and-verify | shared | 86 | ✅ Active |
| parallel-research | shared | 77 | ✅ Active (was marked "Rare" — actually well-used) |
| investigate-and-fix | optimizer | 68 | ✅ Active |
| design-review | optimizer | 53 | ✅ Active |
| verified-coder | tech-lead | 47 | ✅ Active |
| coaching-feedback | shared | 40 | ✅ Active (was marked "Rare" — actually well-used) |
| lens-analysis | tech-lead | 26 | ✅ Active |
| safe-edit | optimizer | 20 | ✅ Active |
| error-scan | shared | 20 | ✅ Active |
| enhance-cron | optimizer | 16 | ⚠️ Low — review for consolidation |
| convention-review | coach | 13 | ⚠️ Low — review for consolidation |
| verify-setup | coach | 9 | ⚠️ Low — review for consolidation |
| auto-loop | — | — | ❌ Removed (dead, 0 real usage) |
| skill-lifecycle | — | — | ❌ Removed (dead, 0 real usage) |

**Note:** `auto-loop.yml` and `skill-lifecycle.yml` were already deleted from `.workflow/` in a prior iteration. No `.workflow/*.yml` files remain — workflows are defined as `.ts` files under `agents/*/workflows/`.

## Candidate Patterns to Convert

From agent self-assessments and session archaeology:
- Coach: diagnose failure → design intervention → test in gym → deploy → measure (growth cycle exists but is it used?)
- Bob: find paper → evaluate → write deep dive → generate hypothesis → link to system
- Tech-lead: pick lens → investigate → write finding → dispatch fix
- Scout: triage arXiv → filter → deep dive → cross-reference
- May: receive request → triage → dispatch to agent → follow up

## Next Action

**Low-usage workflows to review for consolidation:**
- `enhance-cron` (16 refs) — optimizer-specific, may be too narrow; consider merging into `investigate-and-fix`
- `convention-review` (13 refs) — coach-specific; keep if actively used in coaching cycles, otherwise merge into `growth-cycle`
- `verify-setup` (9 refs) — lowest usage; check if it's redundant with `verify-wrap`

**Uncovered task patterns that should adopt workflows:**
- **Bob** (research agent): no dedicated workflow for the paper→deep-dive→hypothesis pipeline. Candidate: adapt `parallel-research` or create `research-pipeline`
- **Scout**: arXiv triage→filter→deep-dive has no workflow. Could reuse `parallel-research`
- **May** (dispatch/triage): request→triage→dispatch→follow-up is a repeat pattern with no workflow

**Concrete next step:** Audit Bob and Scout sessions to confirm the repeat pattern, then build a `research-pipeline` workflow in `agents/shared/workflows/` that both can use.

