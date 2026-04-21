# TODO

## Upcoming
- [ ] Build health: package.json missing from /app root — confirmed still missing (Apr 20 x4, Apr 21, Apr 22, Apr 22 late, Apr 22 night, Apr 21 01:10). Environment issue, not code bug. **P0 escalation (6d10d37c)**.
- [ ] P1: Codebase weight 33,126 lines vs 32,000 target. ~1,800 lines in .lab/ experiment scripts are dead weight candidates. Also 623 lines in bob/workspace/exp101-hvr-analysis.ts.
- [ ] P1: Add pre-flight ANTHROPIC_API_KEY check to gym scripts (11732f46) — Bob burned 114 ops without key
- [ ] P1: Layer 2 monitoring / degradation detection per CR#343 (653a307d)
- [ ] P2: DD#759 heartbeat paper review (7eb31e94) — external validation of our architecture
- [ ] Zombie sessions: 4 orphaned running/0-op sessions (coach×2, bob×1, optimizer×1) from pre-heartbeat. Need cleanup mechanism or auto-timeout.
- [x] Fix persistent-task false stuck detection (5b8febbf) — content change tracking, not just milestones. Committed e4afc049a.
- [ ] Review CR#341 citation gap synthesis (1a710ad1) — 31 uncited scout findings
- [x] "Stuck requests" metric threshold inversion (1542398d) — **RESOLVED**: metric now has alert_direction="above", threshold=20, and regression alerts fire/resolve correctly. Current=0 (healthy).
- [x] P1: Coach reported 2 persistent-task workflow bugs (e6ac494a): API mismatch (project field) + project file overwrite. **VERIFIED (Apr 19)**: Code review of persistent-task.ts shows parseInput() correctly handles `project:` field. `createProjectDir()` only runs when `!existsSync(config.projectPath)` — no overwrite bug. Coach likely passed wrong input format. Documentation is adequate.
- [ ] Delegation quality gap (FM-3.3, 8 occurrences) — 0.79 vs 0.85 target. Audit recent delegations.
- [ ] Review Context-Discovery Chain finding (80eaf11a) — Hao says agents need investigation narratives, not bare metrics.
- [ ] P1: Pre-flight ANTHROPIC_API_KEY check for gym scripts (11732f46) — needs source access to gym runner
- [ ] P1: Layer 2 monitoring (degradation detection) per CR#343 (653a307d)
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

## Deferred (P3) — Blocked on Source Access
- [ ] ~~SIGNALS.md removal~~ — deferred for transition period
- [ ] ~~graph_nav / CodeCompass tool~~ — deferred per Bob
- [ ] ~~MAST Failure Codes~~ — deferred
- [ ] ~~Coach growth-cycle reliability~~ — needs source access to manager.ts
- [ ] ~~meta.json cost tracking~~ — needs source access (PersistedSession)
- [ ] ~~Gym Evolution Dual-Score Architecture~~ — needs source access (gym runner)
- [ ] ~~Fix gym/oneshot agent registration~~ — needs source access (may.ts)
- [ ] ~~Gym Convention Compliance Testing~~ — needs source access (gym-runner.ts)
- [ ] ~~Evaluator→lessons dead path fix~~ — needs source access (evaluator.ts)

---
*17 completed/historical sections moved to [todo-archive.md](./todo-archive.md)*

---
*1 completed/historical sections moved to [todo-archive.md](./todo-archive.md)*
