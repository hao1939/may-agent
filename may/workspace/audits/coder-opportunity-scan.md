# Coder Utilization Opportunity Scan

**Date**: 2026-04-12  
**Author**: May (supervisor)  
**Data sources**: may.db sessions, dispatch board, tech-lead todo.md, optimizer findings, review branches

---

## Current State

- **Coder sessions/6h**: 3 (avg 19 ops each) — all forked by tech-lead as tool-agent calls
- **No independent heartbeat**: Coder's heartbeat.md is Web UI-specific but has NO cron entry to fire it
- **No work queue**: No pending requests targeting coder in the DB
- **Web UI status**: Phases 1-4 complete on main. Phase 5 (Request Tracker) on review branch awaiting merge. Spec only defined Phases 1-3 — coder has exceeded the spec.
- **Tech-lead feature rotation**: Last 5 cycles show "no pending features on dispatch board" — tech-lead is running pure infra lens rotation because there's nothing to delegate to coder

## Identified Implementation Opportunities

### Task 1: Convention Investigation Script (P0 — ~110 ops/day savings)

**Source**: Optimizer finding `finding-coach-investigation-tool-gaps-0412.md`  
**Status**: Analyzed but NOT dispatched  

Coach convention investigation sessions follow an identical 76-op archetype (32 ops DB querying + 29 ops code searching + 16 ops git archaeology). A reusable script could replace the entire manual protocol.

**Concrete deliverable**: `scripts/convention-investigate.sh <convention> <agent>`  
**Output**: Trend data (pass/fail over time), failing sessions, check logic excerpt, recent git changes  
**Estimated effort**: ~25 ops for coder (straightforward bash + sqlite queries)  
**Estimated value**: ~110 ops/day (4-5 investigation sessions × ~22 ops saved per session)  
**Dispatch via**: Fork tech-lead with spec → tech-lead delegates to coder

### Task 2: Code Search / Grep-Then-Read Tool (P1 — ~120-180 ops/day savings)

**Source**: Optimizer finding `finding-git-review-tool-feasibility-0412.md`  
**Status**: Recommended as higher ROI than git-review tool, NOT dispatched  

The grep-then-read pattern appears in 93% of sessions (906 references across 30 sessions). Agents grep for a pattern, then read the file, then grep again with different context — a 3-step pattern that could be a single tool invocation.

**Concrete deliverable**: `scripts/code-search.sh <pattern> [--context N] [--path filter]`  
**Output**: Grep results with surrounding context and file path, deduplicated, with line numbers  
**Estimated effort**: ~15-20 ops for coder  
**Estimated value**: ~120-180 ops/day (highest ROI of any identified tool)  
**Dispatch via**: Fork tech-lead with spec → tech-lead delegates to coder

### Task 3: Fix Wrong DB Path Problem (P1 — eliminates 91 wasted queries/6h)

**Source**: Optimizer finding `finding-tool-gap-scan-0412b.md`  
**Status**: Root cause identified, NOT fixed  

91 DB queries in 6h hit the empty root `may.db` (172KB, stale) instead of `.state/may.db` (93MB, live). Optimizer has 30% error rate, coach 38%. The fix is two-fold:
1. Delete or rename the stale root `may.db` to prevent confusion
2. Update optimizer and coach context.md files to use correct path

**Concrete deliverable**: Delete `may.db` from root + update 2 context.md files  
**Estimated effort**: ~5 ops (trivial)  
**Estimated value**: ~91 wasted queries eliminated every 6h  
**Dispatch via**: Direct — this is a context/config fix, not code. May can dispatch to optimizer/coach via message, or do the context.md edits directly.

### Task 4: Merge & Verify 4 Pending Review Branches (P2 — unblock deployed features)

**Source**: `git branch -v | grep review/`  
**Status**: 4 branches awaiting merge to main  

| Branch | Commits | Description |
|--------|---------|-------------|
| `review/fix-originSessionId-fork` | 1 | Bug fix: pass originSessionId through runAgent() |
| `review/h107-difficulty-threshold` | 1 | H-107 difficulty threshold experiment |
| `review/s_1775993060635_2078` | 1 | Bob Mode D investigation (agents/ repo) |
| `review/s_1775996696850_2117` | 2 | Web UI Phase 5 — Request Tracker tab |

**Concrete deliverable**: All 4 branches reviewed, tested, merged to main  
**Estimated effort**: ~30-40 ops for tech-lead (review + merge + verify TSC/tests)  
**Dispatch via**: Fork tech-lead — this is their standard review workflow

### Task 5: Auto-commit Reentrancy Guard (P2 — structural fix)

**Source**: Tech-lead analysis `analysis-autocommit-fragility.md`, Finding F6  
**Status**: Identified, not yet fixed (3 of 5 fragility patterns fixed, this is #4)  

Auto-commit has no reentrancy guard — if a commit takes >10min (the cron interval), two instances can run simultaneously. Currently untriggered (986 runs, 0 failures) but a latent risk.

**Concrete deliverable**: Add mutex/lock file guard to auto-commit script  
**Estimated effort**: ~15-20 ops for coder  
**Dispatch via**: Fork tech-lead with spec → tech-lead delegates to coder

### Task 6: Wire gym-batch.sh into growth-cycle.ts (P2 — fix 0% tool adoption)

**Source**: Optimizer conversion audit, `finding-tool-adoption-patterns-0412.md`  
**Status**: Tool built, analyzed, adoption pattern proven, fix NOT deployed  

gym-batch.sh has 0% adoption despite being available for 2+ days. Coach still runs 20-30+ individual gym-run.sh calls per experiment. The fix is to edit growth-cycle.ts to use gym-batch.sh as default execution path.

**Concrete deliverable**: Edit `agents/coach/workflows/growth-cycle.ts` + `training-sprint.ts` to reference gym-batch.sh  
**Estimated effort**: ~10 ops for coder  
**Estimated value**: ~10-70 ops/session for gym-heavy experiments (~200+ ops/day)  
**Dispatch via**: Fork tech-lead with spec → tech-lead delegates to coder

---

## Dispatch Recommendations

### Immediate (fork today)

1. **Task 3 (DB path fix)** — Trivial, high-value. May can do context.md edits directly or message optimizer/coach.
2. **Task 1 (Convention investigation script)** — Highest ops-saved-per-effort ratio. Fork to tech-lead.
3. **Task 4 (Review branch merges)** — Unblocks deployed features including Web UI Phase 5.

### Next cycle

4. **Task 2 (Code search tool)** — Highest absolute value but needs a design spec first.
5. **Task 6 (gym-batch wiring)** — Quick fix, meaningful daily savings.
6. **Task 5 (Reentrancy guard)** — Low urgency (0 failures so far) but good preventive fix.

### Structural recommendation

The coder has **no independent work queue**. It only runs when tech-lead forks it. To increase utilization:

- **Option A (recommended)**: Keep current model but ensure tech-lead's dispatch board always has 2-3 queued implementation tasks. Tech-lead already has a feature/infra rotation — the problem is the feature queue is empty because there are no Hao priorities.
- **Option B**: Give coder its own heartbeat cron that checks a work queue file (e.g., `agents/coder/workspace/queue.md`). Risk: coder has no review gate — could produce low-quality code without tech-lead oversight.
- **Option C**: Add the optimizer's unactioned findings as a feed into tech-lead's dispatch board. Tech-lead already checks "pending features" each cycle — if those checks also scanned optimizer findings with "Recommended Fix" sections, the pipeline would auto-generate implementation work.

**Preferred**: Option A + Option C. Keep tech-lead as the quality gate, but feed optimizer findings into the pipeline so tech-lead always has implementation tasks to delegate.

---

## Summary

| Priority | Task | Est. Ops | Daily Value | Dispatch To |
|----------|------|----------|-------------|-------------|
| P0 | Convention investigation script | 25 | ~110 ops/day saved | tech-lead→coder |
| P1 | Code search tool | 20 | ~120-180 ops/day saved | tech-lead→coder (needs spec) |
| P1 | Fix wrong DB path | 5 | ~91 queries/6h saved | May direct / optimizer+coach |
| P2 | Merge 4 review branches | 35 | Unblocks features | tech-lead |
| P2 | gym-batch wiring | 10 | ~200 ops/day saved | tech-lead→coder |
| P2 | Reentrancy guard | 20 | Preventive | tech-lead→coder |

**Total identified value**: ~420-560 ops/day savings from Tasks 1-3+6 alone.
