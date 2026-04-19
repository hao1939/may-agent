# Workflow Registry

**Owner**: Optimizer (accountable for quality, deduplication, effectiveness tracking)
**Last audit**: 2026-04-11T11:24 (Tech Lead — Lens C cleanup of stale references to archived workflows)

## Shared Workflows (active — available to all agents)

| Name | File | Lines | Purpose | 48h Usage |
|------|------|-------|---------|-----------|
| `implement-and-verify` | `shared/workflows/implement-and-verify.ts` | 197 | Lightweight code workflow (H-070 P3): coder Plan → Write → Verify. No QA agent. **Workhorse — 85% of all workflow usage.** | ~79 sessions |
| `implement-and-review` | `shared/workflows/implement-and-review.ts` | 150 | Code changes: coder implements → QA reviews → one retry → escalate. Phase 1 DIAGNOSE / Phase 2 VERDICT QA prompts. | 0 (but 143 all-time) |
| `parallel-research` | `shared/workflows/parallel-research.ts` | 184 | Fork N research threads → collect → synthesize. Promise.allSettled for resilience. Max 5 threads. | ~12 sessions |
| `verify-wrap` | `shared/workflows/verify-wrap.ts` | 154 | Minimal 2-phase verification wrapper (EXP-138). Phase 1: execute task. Phase 2: separate session reads back all written files. For reliant agents (scout, optimizer, may). | 0 (new — pending production pilot) |

**Note**: `fewshot-inject-helpers.ts` is in this directory but is NOT a workflow (no `execute()` function). It's a keyword-based utility for prepending few-shot examples, excluded by the `-helpers` filename filter.

## Archived Shared Workflows

12 workflows were previously archived and have now been **deleted from disk** (2026-04-11). All recoverable from git history only.

Deleted workflows (3,480+ lines total): `code-review-loop`, `context-learn`, `evidence-gate`, `gated-exploration`, `predict-then-verify`, `reviewed-delivery`, `two-phase`, `verify-and-finish`, `verify-parallel`, `research-to-production`, `auto-loop`, `implement-and-adversarial-review`, `skill-lifecycle` (removed 2026-04-19, 0 recent usage).

## Agent-Specific Workflows

### Bob
| Name | File | Lines | Purpose |
|------|------|-------|---------|
| `deliver-or-report` | `bob/workflows/deliver-or-report.ts` | 185 | Attempt delivery, report back if blocked |

### Coach
| Name | File | Lines | Purpose |
|------|------|-------|---------|
| `convention-review` | `coach/workflows/convention-review.ts` | 50 | Review agent output against conventions |
| `growth-cycle` | `coach/workflows/growth-cycle.ts` | 318 | Full training cycle: assess → train → measure |
| `gym-helpers` | `coach/workflows/gym-helpers.ts` | 206 | Helper functions for gym scenarios (not a workflow) |
| `training-sprint` | `coach/workflows/training-sprint.ts` | 286 | Focused training session on a specific skill |
| `verify-setup` | `coach/workflows/verify-setup.ts` | 42 | Verify gym/training infrastructure is ready |

### May
| Name | File | Lines | Purpose |
|------|------|-------|---------|
| `design-then-build` | `may/workflows/design-then-build.ts` | 94 | Design phase then implementation |
| `project-monitor` | `may/workflows/project-monitor.ts` | 97 | Actively monitor external projects — verify work, give feedback, escalate |
| `research-pipeline` | `may/workflows/research-pipeline.ts` | 84 | Multi-step research workflow |
| `test-and-fix` | `may/workflows/test-and-fix.ts` | 45 | Run tests, fix failures |

### Optimizer
| Name | File | Lines | Purpose |
|------|------|-------|---------|
| `design-review` | `optimizer/workflows/design-review.ts` | 119 | Review a design doc before implementation |
| `enhance-cron` | `optimizer/workflows/enhance-cron.ts` | 351 | Safely modify cron configuration |
| `safe-edit` | `optimizer/workflows/safe-edit.ts` | 291 | Edit with rollback capability |

### QA
| Name | File | Lines | Purpose |
|------|------|-------|---------|
| `vet-skill` | `qa/workflows/vet-skill.ts` | 266 | Evaluate a skill proposal end-to-end |

### Tech-Lead
| Name | File | Lines | Purpose |
|------|------|-------|---------|
| `verified-coder` | `tech-lead/workflows/verified-coder.ts` | 176 | Code with built-in verification |

## Consolidation Status (completed 2026-04-04)

All three duplicate sets have been consolidated:

### ✅ P1: `verify-and-finish` — DONE
- may and tech-lead versions were byte-identical
- Promoted to `shared/workflows/verify-and-finish.ts`
- Deleted `may/workflows/verify-and-finish.ts` and `tech-lead/workflows/verify-and-finish.ts`

### ✅ P2: `verify-parallel` — DONE
- may/optimizer were identical; tech-lead had evolved better QA prompts (Phase 1 DIAGNOSE / Phase 2 VERDICT, pre-existing failure detection)
- Promoted tech-lead's version to `shared/workflows/verify-parallel.ts`
- Deleted all 3 local copies

### ✅ P3: `implement-and-review` — DONE
- 3 versions with divergent improvements. Tech-lead's was the superset: includes Phase 1/2 pattern, pre-existing failure detection, Phase 4 verification, better critical rejection detection, plus the "frame as claims" note from may's version.
- Promoted tech-lead's version to `shared/workflows/implement-and-review.ts`
- Deleted all 3 local copies

### Not duplicates (agent-specific, keep local):
- All coach workflows (training-specific)
- bob/deliver-or-report (bob-specific delivery pattern)
- optimizer/safe-edit, enhance-cron, design-review (optimizer-specific safety patterns)
- qa/vet-skill (QA-specific)
- tech-lead/verified-coder (tech-lead-specific)

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
| skill-lifecycle | shared/workflows/ | 12 | 12 | 0 | **100%** | Excellent |
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
