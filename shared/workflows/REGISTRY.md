# Workflow Registry

**Owner**: Optimizer (accountable for quality, deduplication, effectiveness tracking)
**Last audit**: 2026-04-21T12:00 (Tech Lead — full reconciliation against disk: 7 ghost entries removed, 8 missing workflows added, line counts corrected)

**Current convention, 2026-05-11**: `project` is the default explicit-project
driver. `master-worker*` files remain as legacy/tested workflow code and
historical project metadata, but active or resumable shared projects should not
select them unless a reviewer records a specific reason. Prefer migrating
waiting projects to `workflow: project` before they resume.

## Shared Workflows (active or wired)

| Name | File | Lines | Purpose |
|------|------|-------|---------|
| `project` | `shared/workflows/project.ts` | 1210 | Default explicit-project driver. Persistent iterative loop with owner review, worker iteration, comments, project.md + journal.md, and legacy single-file support. |
| `metric-alert-triage` | `shared/workflows/metric-alert-triage.ts` | 297 | Owner judgment workflow for metric alerts. Requires a concrete operation and emits durable `metric.alert_judged` evidence. |
| `closed-loop-steward` | `shared/workflows/closed-loop-steward.ts` | 20 | Workflow wrapper for May's recurring closed-loop audit; keeps the handler as an event-to-workflow bridge. |
| `evaluator-deep-eval` | `shared/workflows/evaluator-deep-eval.ts` | 20 | Workflow wrapper for non-heuristic evaluator sessions selected by `eval-llm-scan`. |
| `session-recovery` | `shared/workflows/session-recovery.ts` | 131 | Recover or escalate failed sessions from `session.failed` events. |
| `implement-and-verify` | `shared/workflows/implement-and-verify.ts` | 203 | Lightweight code workflow (H-070 P3): coder Plan → Write → Verify. No QA agent. **Workhorse — 85% of all workflow usage.** |
| `verify-wrap` | `shared/workflows/verify-wrap.ts` | 26 | Minimal wrapper for explicitly verified work. Still referenced by May cron entries and agent references. |
| `goal-driver` | `shared/workflows/goal-driver.ts` | 423 | Experimental project judgment loop. No active project reference after `scout-second-brain-learning` returned to `project`; keep only as temporary compatibility until archival review. |

**Not workflows** (helper modules with no `execute()` function):
- `fewshot-inject-helpers.ts` — keyword-based utility for prepending few-shot examples
- `heartbeat-data.ts` — shared heartbeat data loaders (metrics, projects, alerts, inbox). Zero LLM cost.

### Deleted since last audit
- `implement-and-review.ts` — archived (6% completion rate, broken verdict parsing)
- `persistent-task.ts` — was an alias for `project.ts`, removed
- `heartbeat.ts` — replaced by per-agent heartbeat workflows + `heartbeat-data.ts`
- `error-scan.ts` — dead code, zero consumers (446 lines)

### Legacy Shared Workflows Kept For Compatibility

- `master-worker.ts` and `master-worker*` variants remain on disk with tests, but
  are not the default project path. Non-terminal shared projects should use
  `workflow: project` unless a reviewer records a specific reason.

## Archived Shared Workflows

12 workflows were previously archived and have now been **deleted from disk** (2026-04-11). All recoverable from git history only.

Deleted workflows (3,800+ lines total): `code-review-loop`, `context-learn`, `evidence-gate`, `gated-exploration`, `predict-then-verify`, `reviewed-delivery`, `two-phase`, `verify-and-finish`, `verify-parallel`, `research-to-production`, `auto-loop`, `implement-and-adversarial-review`, `skill-lifecycle` (removed 2026-04-19, 0 recent usage), `freestyle-wrap`, `coaching-feedback` (removed 2026-05-25, 0 usage in cron or any caller).

## Agent-Specific Workflows

### Per-Agent Heartbeats
Every agent has a heartbeat workflow (uses shared `heartbeat-data.ts` loaders):
`amy-kimi-heartbeat.ts`, `bob-heartbeat.ts`, `coach-heartbeat.ts`, `may-heartbeat.ts`, `optimizer-heartbeat.ts`, `qa-heartbeat.ts`, `scout-heartbeat.ts`, `tech-lead-heartbeat.ts` (~59 lines each)

### Coach
| Name | File | Lines | Purpose |
|------|------|-------|---------|
| `growth-cycle` | `coach/workflows/growth-cycle.ts` | 386 | Full training cycle: assess → train → measure |
| `gym-helpers` | `coach/workflows/gym-helpers.ts` | 421 | Helper functions for gym scenarios (not a workflow) |
| `training-sprint` | `coach/workflows/training-sprint.ts` | 301 | Focused training session on a specific skill |

### May
No active workflows. (`project-monitor.ts` removed 2026-07-16 — 236 lines, 0 consumers, 0 cron/handler references.)

### Optimizer
| Name | File | Lines | Purpose |
|------|------|-------|---------|
| `investigate-and-fix` | `optimizer/workflows/investigate-and-fix.ts` | 338 | Analysis that forces action — counters optimizer's 51% findings-without-follow-through anti-pattern |

### Tech-Lead
| Name | File | Lines | Purpose |
|------|------|-------|---------|
| `verified-coder` | `tech-lead/workflows/verified-coder.ts` | 178 | Code with built-in verification |

### Deleted since last audit
- `bob/workflows/deliver-or-report.ts`
- `may/workflows/design-then-build.ts`
- `may/workflows/research-pipeline.ts`
- `may/workflows/test-and-fix.ts`
- `optimizer/workflows/design-review.ts` — dead code, 0 runs, 0 references (removed 2026-12-04)
- `optimizer/workflows/enhance-cron.ts` — dead code, 0 runs, 0 references (removed 2026-12-04)
- `optimizer/workflows/safe-edit.ts` — dead code, 0 runs, 0 references (removed 2026-12-04)
- `qa/workflows/vet-skill.ts` — dead code, 0 runs, 0 references (removed 2026-12-04)
- `tech-lead/workflows/lens-analysis.ts` — dead code, 0 runs, 0 references (removed 2026-12-04)

## Consolidation Status (completed 2026-04-04, all promoted files since archived)

Historical: Three duplicate sets were consolidated. All promoted shared copies have since been archived/deleted as the system evolved to use `project.ts` as the primary workflow pattern. (`worker-reviewer.ts`, `master-worker.ts`, and `error-scan.ts` were later removed as dead code.)

## Effectiveness Tracking

**Last measured**: 2026-04-04T09:45 — see `agents/shared/knowledge/experiments/EXP-001/results.md`
**Previous update**: 2026-04-04T08:30 (corrected — previous data had fabricated/misattributed numbers)

⚠️ **DATA INTEGRITY NOTE** (2026-04-04): The previous version of this section contained fabricated
usage data. "60 code-review-loop runs" were actually `implement-and-review` runs (coder+qa sessions).
"65 two-phase runs" were actually `growth-cycle` and `training-sprint` runs. All numbers below are
verified against actual workflow run files and the sessions database.

### Per-Workflow Performance (ACTUAL — from 59 on-disk run files)
| Workflow | Location | Runs | Done | Escalated | Done% | Notes |
|----------|----------|------|------|-----------|-------|-------|
| growth-cycle | coach/workflows/ | 26 | 26 | 0 | **100%** | Coach's best workflow |
| implement-and-review | shared/workflows/ | 16 | 1 | 14 | **6%** | ⛔ BROKEN — see analysis |
| skill-lifecycle | *(deleted)* | 12 | 12 | 0 | **100%** | Excellent (archived) |
| training-sprint | coach/workflows/ | 4 | 4 | 0 | **100%** | Works well |
| verified-coder | tech-lead/workflows/ | 1 | 1 | 0 | 100% | Only 1 run, insufficient data |

### Per-Workflow Performance (DB — 180 workflow runs from sessions table)
| Workflow type | Runs | Success | Interrupted | Errored | Success% | Avg Ops |
|---------------|------|---------|-------------|---------|----------|---------|
| implement-and-review (coder+qa) | 78 | 51 | 17 | 4 | **65.4%** | 13.1 |
| coach (growth-cycle+training-sprint) | 88 | 62 | 18 | 8 | **70.5%** | 45.7 |
| optimizer | 12 | 9 | 3 | 0 | **75.0%** | 82.3 |

**Note**: On-disk run files (59) are a subset of DB runs (180). Many runs were archived to history/ without retaining run files. The DB is the authoritative source.

### EXP-001: Workflow vs Non-Workflow Comparison (2026-04-04)
Full report: `agents/shared/knowledge/experiments/EXP-001/results.md`

**Headline**: Workflows do NOT improve quality scores — they cost 2.7x more per good outcome.
- Workflow good rate: 42.7% vs non-workflow 45.5% (-2.8pp)
- Workflow cost per good: $3.19 vs non-workflow $1.19
- BUT: Workflow done rate: 89% vs non-workflow 76% (+13pp)
- AND: Workflow error rate: 2.6% vs non-workflow 17.6% (-15pp)
- **Caveat**: Non-workflow includes many trivial gym tasks — apples-to-oranges comparison
- **Caveat**: Workflow NI rate gap (20pp) is partly evaluation artifact — stricter expectations for child sessions

### Previously NEVER-Used Shared Workflows → ARCHIVED 2026-04-04
All 9 dead workflows (2,073 lines) moved to `shared/workflows/archive/`. See "Archived Shared Workflows" section above.

### implement-and-review Failure Analysis
14/16 runs escalated because:
1. `getVerdict()` defaults to "fail" when QA doesn't use exact `### Verdict\n**PASS**` format
2. `isCriticalRejection` matches broad terms ("contradicts") causing premature escalation
3. QA flags environment limitations (no tsc/vitest available) as real failures
4. Result: coder does good work → QA rejects on formatting/environment → workflow escalates → wasted

### Why 9 workflows have 0 runs
Workflows are only invoked when an LLM explicitly calls `workflow.run("name", task)`. No handler
or cron job references these workflows. They rely on spontaneous agent adoption, which never happens
because agents don't know the workflows exist (not in SOUL.md, not in context).

### EXP-028: Workflow Collapse (2026-04-05)
**Root cause**: Heartbeat.md rewrite (commit `db9b0ba9`, Apr 1) removed `workflow.run()` instructions.
- Coach workflow usage: 7-8/day → 0 (immediate)
- Coach done rate: 85% → 34% (51pp degradation)
- System-wide: workflow sessions = 83.9% done, 0% error vs 73.9%/10%
- **Key insight**: LLMs will NOT spontaneously discover workflows. Explicit heartbeat instructions required.
- Fix: Restore `workflow.run()` instructions to heartbeats (sent to May, req:de3c001e).

### EXP-050: implement-and-verify Overhead Analysis (2026-04-07)
Full report: `agents/shared/knowledge/experiments/EXP-050/results.md`

**Headline**: implement-and-verify as designed INCREASES overhead vs direct coder for simple tasks.
- "State Approach" forced externalization adds 1.76–3.78x duration overhead on medium-complexity tasks
- Verification info alone adds zero overhead (coder already runs tests)
- Shell verification takes ~130ms — negligible, but usually redundant
- Most gym scenarios have no executable verification available (1/7 had test command)
- **Action taken**: Removed stateApproach() from implement-and-verify workflow
- **New hypothesis**: H-085 (Prompt Overhead) — forced externalization hurts well-scoped tasks

### Key Findings (corrected 2026-04-04)
1. **Coach pipelines are excellent** — growth-cycle (100%), training-sprint (100%), skill-lifecycle (100%)
2. **implement-and-review is broken** — 6% completion rate, needs verdict parsing fix
3. **9 of 11 shared workflows are dead code** — never used in production, unmaintained
4. **Previous REGISTRY data was fabricated** — run counts and performance numbers were wrong
5. **Workflow adoption requires wiring, not just listing** — agents don't spontaneously discover workflows

### Recommendations (updated 2026-04-04)
1. ✅ **FIX implement-and-review verdict parsing** — DONE. `getVerdict()` now defaults to conditional-pass. Also fixed critical rejection detection.
2. ✅ **ARCHIVE dead workflows** — DONE. 9 files (2,073 lines) moved to `shared/workflows/archive/`.
3. **WIRE active workflows into handlers** — agents don't spontaneously discover workflows; add to cron/handlers
4. **Fix REGISTRY trust** — all future metrics must cite data source (workflow run files, DB queries)
5. **Coach workflows are the model** — growth-cycle's 100% rate should inform shared workflow design
