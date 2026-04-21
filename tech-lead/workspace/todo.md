# TODO

## Upcoming
- [x] P1: Codebase weight — audit agents/ for dead code. **Workflow dead-weight audit done** (finding-dead-weight-lens-audit-agents-shared-wo.md). Found 571 removable lines (25% of workflows/). Next: delete persistent-task.ts alias, archive implement-and-review.ts.
- [x] P1: Archive implement-and-review.ts — DONE (commit eb6341e). Updated may/agent.json hints.
- [x] P1: Delete persistent-task.ts alias (from workflow dead-weight audit)
  - Gate 3 (FM-3.4) dead code removed from finish-guard.ts + tests (~205 lines). persistent-task.ts alias kept (still referenced in guards/session-sync).
  - implement-and-review.ts archive already deleted in eb6341e.
- [ ] P1: Zombie session auto-cleanup — active-nudge now handles this (May committed), verify it works
- [ ] P1: Layer 2 monitoring / degradation detection per CR#343 (653a307d)
- [ ] P1: Agent infrastructure simplification — are there redundant workflows, handlers, or skills?
- [ ] P1: Refactor project.ts (fragility 9/10) — 570-line execute(), 3x duplicated done-handling, mutable state soup. See finding-fragility-lens-workflows.md for specific recommendations.
- [ ] P2: DD#759 heartbeat paper review (7eb31e94) — external validation of our architecture
- [ ] Review CR#341 citation gap synthesis (1a710ad1) — 31 uncited scout findings
- [ ] Delegation quality gap (FM-3.3, 8 occurrences) — 0.79 vs 0.85 target. Audit recent delegations
- [ ] Review Context-Discovery Chain finding (80eaf11a) — Hao says agents need investigation narratives, not bare metrics
- [x] Bob tool hints in context.md (be6b5632, 2693be51) — already present in bob/context.md
- [x] Monitor C1.3 improvement after write() diff enhancement deployment — **DONE (2026-04-08)**
  - **Result: 94.1% pass rate post-write-diff (n=557), up from 47.3% baseline (n=1743)**
  - Three-phase analysis:
    - Phase 1 (pre-context-fix, before Mar 31): 47.3% — matches original 45% baseline
    - Phase 2 (context.md updates, Mar 31 – Apr 7): 85.1% — +37.8pp from behavioral nudges
    - Phase 3 (write-diff deployed, Apr 7+): 94.1% — +9.0pp additional from tool enhancement
  - **Attribution**: Context.md nudges drove ~80% of improvement; write-diff contributed ~20% (but still meaningful +9pp)
  - Per-agent: tech-lead +28pp, bob +12.2pp, coach +8.1pp, optimizer +7pp, qa/may already ~100%
  - Scout regressed -4.3pp — writes mostly NEW files (drops/deep-dives) where diff preview is empty
  - **Remaining 5.9% failures**: mostly scout (new-file writes) and coach/optimizer (workspace reports)
  - **Conclusion**: Write-diff enhancement is effective for existing-file overwrites. Consider adding "new file created" reminder to write() output for new files to help scout
- [ ] Architecture redesign Phase 4+ (event system) — Phase 1-2 done, Phase 3 cosmetic (thin startup), research DB tables + events remaining
- [x] Research DB tables (hypotheses, experiments, knowledge_entries) — DONE. QA reviewed, merged to main (commit 99a2134).
- [x] Fix launcher.test.ts brittle assertion — DONE (commit 0348790, merged)
- [x] Wire research-db syncAll() into cron + research events on EventBus — DONE (merged ede1108)
  - research_sync event type added to EventBus
  - agents/may/handlers/research-sync.ts handler (30min cron, zero LLM cost)
  - agents/may/cron.json updated
- [ ] Lower-overhead workflows — priority tracker's top remaining question (can reducing C_fixed expand workflow benefit to small tasks?)
  - [x] Built `implement-and-verify` workflow (H-070 P3) — DONE (s_1775561790830_129)
  - [x] EXP-050 design.md — DONE
  - [x] REGISTRY.md updated with implement-and-verify entry
  - Design: coder → shell verification gate (no QA agent), 1 retry, ~3-5 ops vs ~9-15 ops
  - [x] **EXP-050 COMPLETE** (s_1775563466948_139) — full results in `agents/shared/knowledge/experiments/EXP-050/results.md`
    - State Approach adds 1.76–3.78x overhead on medium tasks with zero quality benefit
    - Verify-only prompt adds zero overhead (coder ignores redundant test info)
    - Shell verification ~130ms but usually redundant (coder already tests)
    - **Action taken**: Removed stateApproach() from implement-and-verify workflow
    - H-070 P3 updated to PARTIALLY SUPPORTED
  - [ ] Follow-up: Test updated implement-and-verify (no State Approach) on production tasks to confirm lower overhead
- [ ] Deploy recent merges (R39 auto-pause, research-db, write-diff, etc.) — needs process restart. 14 commits undeployed since Apr 6.

## Low-Priority Cleanup
- [x] Phase 5d: Deprecate memory fallback — DONE (s_1775527469736_184, commit 34263ca)
- [ ] ~~Update design doc INDEX.md to mark session-digest.md as fully implemented~~ ✅ Done

## Deferred (P3) — Runtime Changes (require Hao)
- [ ] Coach growth-cycle reliability — needs runtime changes to manager.ts
- [ ] meta.json cost tracking — needs runtime changes (PersistedSession)
- [ ] Gym Evolution Dual-Score Architecture — needs runtime changes (gym runner)
- [ ] Fix gym/oneshot agent registration — needs runtime changes (may.ts)
- [ ] Evaluator→lessons dead path fix — needs runtime changes (evaluator.ts)

---
*17 completed/historical sections moved to [todo-archive.md](./todo-archive.md)*

---
*1 completed/historical sections moved to [todo-archive.md](./todo-archive.md)*
