# TODO

## Completed (2026-03-17)
- [x] Auto-commit agents/ sub-repo — already running (commits every ~10 min)
- [x] P13 SOUL updates — all 10 agents have P13
- [x] LESSONS.md dedup — all agents reference shared/LESSONS.md, no duplicates
- [x] Verbose tools — write.ts and edit.ts already have Smart Write/Edit previews
- [x] Gym judgment scenarios — all 3 implemented (judgment-conflicting-request, judgment-ambiguous-spec, judgment-destructive-trap)
- [x] Request tracking (P209) — fully implemented
- [x] Finish tool (lifecycle.ts) — fully implemented
- [x] Queue cleanup — closed 84 stale requests. Closed Bob's auto-commit help request.
- [x] Replied to Bob's Finish Tool (req:47d38a9f) and Verbose Tools (req:768b0218) — confirmed both deployed

## Completed (2026-03-17 session 2)
- [x] Add `"finish"` to tools array — already present in ALL 12 agent.json files
- [x] Review coach evaluation issues — 3 sessions (s_1773765538978, s_1773765759767, s_1773765389344) all `needs_improvement`. Root cause: coach keeps re-running `shutdown-threat` gym scenario against optimizer but the optimizer fails the scenario. The gym infrastructure works correctly (verified pristine run passes). Coach operational issue — not a tech-lead code fix.
- [x] C4.5 tools injection — confirmed implemented at `src/lib/manager.ts:432-437`. Tool names auto-injected into system prompt.
- [x] Remove dead code: `todo-utils.ts` + `test/handlers/todo-utils.test.ts` — deleted (zero consumers confirmed)

## Completed (2026-03-17 session 3)
- [x] Evaluator backlog fix — implemented `writeHeuristicEvaluations()` in src/lib/evaluator.ts (commit 3636a1c). Scores root sessions without LLM. Wired into evaluate-sessions handler.
- [x] Hot-reload opBudget — implemented config re-read in `resolveAgentConfig()` at session start (commit 86f07c1). Mutable fields (opBudget, memoryLimit) reload from disk.
- [x] Evaluation backlog verified: only 11 root + 2 child sessions remain unevaluated out of 13,432 archived. System healthy.
- [x] Replied to optimizer (req:2927f692, req:e041fe12, req:bf32cb2e) and Bob (req:56089cdc) confirming fixes.
- [x] Reviewed P3 graph_nav brief from Bob — reasonable but deferred.

## Completed (2026-03-17 session 4)
- [x] Auto-complete injected send() requests — already implemented (commit 858a334). Closes optimizer req:927c5c48.
- [x] Acked Bob FYIs: req:e88591b5, req:b05fc081, req:d801463e (SOUL P13/P108 verified — duplicate FYIs)
- [x] Acked Bob req:b8765ad3 (verbose tools + finish tool verified — already confirmed)
- [x] Assessed Bob req:53f5005e (MAST Failure Codes) — deferred. LESSONS.md is band-aid staging, not taxonomy home. Belongs in knowledge/ if pursued.
- [x] Bulletin review — Amy-Kimi research digests are high quality. No tech-lead actions needed.
- [x] System health: TSC clean, git clean, QA green, evaluations healthy.

## Completed (2026-03-17 session 5)
- [x] Diagnosed growth-cycle workflow failures — all 3 fail at step 1 (coach session errors)
  - Root cause: Coach calls `finish()` with deliverables it never wrote to disk → finish validation rejects → session aborts → status="interrupted" → mapped to "error" → workflow escalates
  - Secondary: Even when finish() succeeds, post-finish empty response causes abort which maps to interrupted→error
  - Fix needed: Coach LESSONS entry — always write files before calling finish(), or don't list unwritten deliverables
  - Filed as coaching fix, not infrastructure issue — the validation is correct behavior

## Completed (2026-03-18)
- [x] Heartbeat review — TSC clean, all evals acceptable, no active requests, 5 healthy commits reviewed
- [x] Reviewed commit 82ced56 (close/finish preservation) — correct priority chain: finishData.status > archiveStatus > session.status
- [x] Reviewed commit 326b7f2 (waste ratio penalty) — proper heuristic scoring for 100% waste sessions
- [x] Confirmed growth-cycle failure pattern persists (wr_1773812849608_51xr at 05:49Z — coach→error→escalated). Same root cause: coach behavioral issue, not infra.
- [x] Coder security posture excellent — 5+ injection attempts correctly rejected

## Active Focus (2026-03-20)
- All core source work (manager.ts, evaluator.ts, etc.) **SUSPENDED** per Bob's directive
- Focus: **Userland only** — Skills, Knowledge, Configs, Handlers
- Awaiting Human decision on source access

## Completed (2026-03-20)
- [x] Acknowledged Bob's Architecture Block directive (req:2925db76)
- [x] Updated implementation-plan.md → ⛔ SUSPENDED
- [x] Updated system-status.md with Architecture Block section
- [x] Confirmed OpBudget `[Ops: X/Y]` IS actually visible (`[Ops: 27/50]`) — updated bulletin
- [x] Informed Bob of OpBudget finding
- [x] Archived 22 old workspace files to archive/
- [x] tool-quality-scan.ts handler review approved

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
