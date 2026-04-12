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

## Completed (2026-04-07)
- [x] Phase 5: Digest-based context injection — fully implemented & merged (commit 7c35f23)
  - `buildDigestBriefing()` replaces memory JSONL in `buildSessionContext()`
  - Cross-agent digests, unresolved items, overflow protection
  - 19 tests passing, all 1977 tests green
- [x] Session digest system phases 1-5 all complete (Phase 4a-4c classifier switchover done)
- [x] EXP-048 H-058 proxy-satisfying detection (commits b77e611, 4549190)
- [x] EXP-049 frustration detector (commit a09d564)
- [x] H-085 forced externalization utility + 34 tests (commits 27383ed, 5c948c2)
- [x] 66 tests for classify-error and evaluator-failure-chain (commit 1ffe6ef)
- [x] Efficiency score corruption bug fix in evaluate-sessions.ts handler

## Completed (2026-04-07 session 2)
- [x] Merged review/phase5d-deprecate-memory to main (commit 3bfec52)
- [x] Merged review/write-diff-enhancement to main (commit 7ded765)
  - Write() now shows unified diff for existing file overwrites
  - 19 tests passing, TSC clean
  - Bob's Option B from common-sense infra review 2026-04-06 — DONE
- [x] Amy-kimi errors diagnosed: API provider billing issue (429 insufficient balance), not code

## Completed (2026-04-07 session 3)
- [x] R39: Auto-pause on 3 consecutive failures — merged to main (src/lib/auto-pause.ts, cron.ts integration, 13 tests)
  - Self-healing: if agent succeeds, pause auto-lifts
  - Fail-open: DB errors don't block agents
  - Amy-kimi will be auto-paused until billing is fixed and a session succeeds

## Completed (2026-04-08)
- [x] **Workflow auto-loop analysis** (req:56824397 from May) — delivered comprehensive analysis at `agents/tech-lead/workspace/analysis-workflow-autoloop.md`
  - Engine supports loops, composition, persistence, resume — all primitives present
  - Zero engine changes needed. Gap is ~100-line orchestrator workflow
  - Recommended `auto-task.ts` shared workflow: loop → implement-and-verify → shell verify → next
  - 229 workflow runs analyzed for production data

## Completed (2026-04-08 session 2)
- [x] **Federation Sync Redesign (P0 from Hao)** — ownership-aware conflict resolution in agents-auto-commit.ts
  - Replaced `-X ours` fallback with per-file ownership-based resolution
  - Added `InstanceConfig`: `agents/shared/federation/instance-config.json` maps agents to local/k3s instances
  - New functions: `resolveConflicts()`, `resolveSharedConflict()`, `isAppendOnlyFile()`, `mergeAppendOnly()`
  - Shared files: append-only (.jsonl, INDEX.md) get auto-merged; others keep both versions (.conflict-{instance})
  - Federation directory structure: `shared/federation/{instance-config.json, requests/, heartbeats/}`
  - Instance heartbeat: each cycle writes `heartbeats/{instanceId}.json` for liveness monitoring
  - TSC clean, no behavior change for happy path (rebase succeeds → same as before)

## Completed (2026-04-08 session 3)
- [x] **P0 Bug Fix: Context overflow crash loop** (req:a4594970)
  - Chat sessions (`autoClose="never"`) that overflow now get archived instead of going idle
  - Three-layer fix: manager.ts handleCompletion, chat-session.ts resumeExistingSession + trackCompletion
  - TSC clean, 32/32 relevant tests pass
  - Review branch: `review/s_1775691066225_16` (commit 9ea5b5a)

## Completed (2026-04-09)
- [x] **Gym-runner multi-session ENOENT bug** (req:b2f0039c) — Fixed transcript export crash blocking EXP-108
  - Root cause: agent process could delete workDir (its CWD) during execution
  - Fix: Three defensive `mkdirSync` guards in `runMultiSessionScenario()` — before env overlay, after agent run, before scoring
  - Committed to `review/gym-runner-enoent-fix` (e3f53b5), 36/36 gym tests pass
  - Verified with destructive agent (`rm -rf $(pwd)`) — now shows warning and completes instead of crashing

## Completed (2026-04-10)
- [x] **Dead code removal sprint** — Removed ~2,500+ lines across 5 work sessions:
  - Forced externalization module (610 lines)
  - Stuck detector module (657 lines)
  - Socket-watch module (706 lines)
  - 6 dead functions from session-digest, persistence, manager (~65 lines)
  - Dead memory JSONL system: writer, reader, subscriber, tests (589 lines)
  - composeGuards fail-open try-catch added
  - All review branches merged to main, 2041 tests pass, TSC clean
- [x] **Dead code scan complete** — remaining exports all have consumers. No more easy dead code wins. Future simplification requires architectural refactoring.

## Upcoming
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

## Lens Rotation Tracker
- 2026-04-11 06:28: Lens A (guard system architecture) — well-architected, no action
- 2026-04-11 07:27: Lens B (session lifecycle flow complexity) — 7 context layers, complex but well-factored
- 2026-04-11 08:25: Lens C (disabled cron entries) — removed 16 entries
- 2026-04-11 09:01: Lens B (coach high-op pattern) — analysis + P1 message sent
- 2026-04-11 09:28: Lens C (federation sync usage) — audit forked (req:3ac8e858)
- 2026-04-11 09:54: Lens D (auto-commit conflict fragility) — 6 patterns found, 3 fixes committed (68a6fc6c)
- 2026-04-11 10:23: Lens A (workflow engine consolidation) — audit complete, 5 unused workflows identified
- 2026-04-11 10:54: Lens B (session startup flow complexity) — forked (s_1775904983997_1382)
  - 9 layers from cron.fire() to LLM first token, 7 sub-items in context injection
  - 10 guards in composeGuards chain
  - Analysis + recommendations forked
- 2026-04-11 11:24: Lens C (unused workflow cleanup) — COMPLETE: 3/5 already archived, 2 kept (active consumers), stale refs cleaned from workflow-first.md
- 2026-04-11 12:24: Lens D (scout FM-3.3 fragility / verify-wrap integration) — COMPLETE: verify-wrap NOT viable for scout (doesn't fork, no dispatch point). Root cause: scout does all work inline in heartbeats. See workspace/verify-wrap-assessment.md
- 2026-04-11 12:53: Responded to Bob's P1 verify-wrap deployment request with pushback (req:c14204a4). Scout has no fork dispatch point. Recommended fixing scout's dispatch pattern first.
- 2026-04-11 13:23: Lens A (cron/scheduling architecture) — COMPLETE: 6 findings, disabled duplicate auto-pause-recovery handler. See workspace/audit-cron-architecture.md
- 2026-04-11 13:53: Lens B (auto-pause dual-system flow) — COMPLETE: deleted auto-pause-recovery handler (523 lines dead code), 39 tests pass, TSC clean
- 2026-04-11 14:23: Lens C (may handler dead weight audit) — COMPLETE: 27 handlers, perfect 1:1 mapping, clean state
- 2026-04-11 14:53: Lens D (cron.ts blast radius / god-file fragility) — forked (s_1775919250996_1476)
- 2026-04-11 15:23: Lens A (HandlerContext surface area) — COMPLETE: see workspace/audit-handler-context.md
- 2026-04-11 15:53: Lens B (workflow execution path complexity) — COMPLETE: 8-layer call depth, ~14 I/O ops/step, triple-redundant persistence. See workspace/audit-workflow-execution-path.md
- 2026-04-11 16:23: Lens C (workflow dead weight cleanup) — COMPLETE: 29 workflow JSONs (down from 295), archive dir deleted, TSC clean
- 2026-04-11 16:53: Lens D (workflow engine error handling fragility) — COMPLETE: see workspace/audit-workflow-error-handling.md
- 2026-04-11 17:23: Lens A (manager.ts god-object architecture) — forked
- 2026-04-11 17:53: Lens B (persistence write path complexity) — COMPLETE: 15+ I/O ops per session lifecycle, triple-redundant status persistence (meta.json + SQLite sessions + SQLite digests), dead `archiveSession()` causing unbounded session directory growth (2,654 active). See workspace/audit-persistence-write-path.md
- 2026-04-11 18:23: Lens C (session-subscribers dead weight) — COMPLETE (13 ops, 3m23s)
- 2026-04-11 18:53: Lens D (persistence failure cascade blast radius) — COMPLETE: 7 failure scenarios traced, critical finding: meta.json write failure prevents ALL downstream bus subscribers (total write blackout). 6 fixes proposed (P0: try-catch around meta.json write in completion pipeline). See workspace/audit-persistence-failure-cascade.md
- 2026-04-11 19:23: Lens A (completion pipeline architecture) — COMPLETE: 5 pipeline stages clean, subscriber layer has 11 consumers with triple-redundant status writes and double escalation bug. See workspace/audit-completion-pipeline.md
- 2026-04-11 19:53: Lens B (event bus subscriber ordering/coupling) — COMPLETE (s_1775937266960_1600, 19 ops)
- 2026-04-11 20:23: Lens C (digest system dead weight) — COMPLETE: 6,422 rows audited, ~43 lines removable (logShadowComparison Phase 3 artifact, dead classifyError re-export, silently failing recovery_requeue write). See workspace/audit-digest-dead-weight.md
- 2026-04-11 20:53: Lens D (session startup failure modes) — COMPLETE: 9-layer startup path traced from cron tick to first LLM token. Critical finding: `activeSessions.set()` runs 28 lines before `buildSessionContext()` which has 5 unprotected function calls — a throw creates a permanent ghost session (no promise set, never completes). See workspace/audit-startup-failure-modes.md
- 2026-04-11 21:23: Lens A (status persistence consolidation) — COMPLETE: 5-phase proposal to consolidate triple-redundant status writes (meta.json + SQLite sessions + SQLite digests) into single-writer SQLite architecture. Phase 1 (try-catch around meta.json) is zero-risk P0. See workspace/proposal-status-consolidation.md
- 2026-04-11 21:53: **CODE FIX**: P0 meta.json write failure resilience — COMPLETE. Try-catch around `updateSessionStatus()` in `handleCompletionInner()` prevents total downstream write blackout. Review branch: `review/s_1775944449042_1644` (commit 3230b31). Phase 1 of status-consolidation proposal.
- 2026-04-11 22:23: Lens B (context injection pipeline complexity) — COMPLETE: 7 sub-items traced, 3 DB queries + 3-4 file reads (~10ms total). Well-factored, no redundant fetches. Only dead weight is unused `contextFiles` feature (6 lines). See workspace/audit-context-injection-pipeline.md
- 2026-04-11 22:53: Lens C (active sessions directory dead weight) — COMPLETE: 99.6% of sessions in active dir are stale (2,765/2,775). archiveSession() was deliberately removed from completion pipeline but history infra left in place. 562MB dead weight. loadAllSessionMetas() scans 19K+ files (1.7s/call). Fix: re-wire archiveSession() + one-time cleanup. See workspace/audit-active-sessions-dead-weight.md
- 2026-04-11 23:23: Lens D (cron tick overlap fragility) — COMPLETE: 804 sessions analyzed, 270 overlapping pairs. Zero are bugs — overlap guard works correctly. 245 are agent-forked child sessions (intentional), 25 are different cron jobs for same agent firing at same tick (by design). Error rates comparable (2.2% vs 1.3%). See workspace/analysis-cron-overlap.md
- 2026-04-11 23:53: **P1 Investigation**: evaluation-sync handler outage — forked (s_1775951649843_1706). 440 unevaluated sessions accumulated since 05:57 UTC. May manually recovered but root cause unknown.
- 2026-04-12 00:23: Lens A (evaluation system architecture) — COMPLETE: 4 evaluation paths mapped (evaluateTask LLM, writeSkippedEvaluations, writeHeuristicEvaluations, evaluation-sync handler). 3 of 4 overlap. Consolidation proposal: keep evaluateTask + evaluation-sync, remove the 2 startup sweeps. evaluate-sessions cron is disabled, evaluate-session-llm also disabled. See workspace/audit-evaluation-architecture.md
- 2026-04-12 00:53: Lens B (cron handler registration flow) — COMPLETE: 6 layers of indirection traced (file watch → reload → resolveMode → handler lookup → fire → execute), 2 remaining silent failure paths (no-retry on missing handler file, valid entry with no handler/agent silently skips). handlerResolver fix closed primary gap. 4 fixes proposed. See workspace/audit-cron-handler-registration-flow.md
- 2026-04-12 01:23: Lens C (knowledge directory dead weight) — COMPLETE: 5,326→5,158 files (-168), 44MB→41MB (-3MB). Deleted conflict files, experiment raw data/scripts/prompts (145+ files), merged 3 duplicate directory pairs, consolidated hypothesis archives, moved orphaned file. Remaining TODO: consolidate 51 repetitive findings, 182 insights-archive files, mark 8 abandoned experiments, library archival. See workspace/audit-knowledge-dead-weight.md
- 2026-04-12 01:53: Lens D (ghost session fragility in manager.ts) — COMPLETE: Wrapped post-activation code in try-catch. If buildSessionContext() or 4 other unprotected calls throw, catch cleans up activeSessions + timeout + meta.json, preventing permanent ghost sessions. Review branch: review/s_1775958848156_1768. See workspace/fix-ghost-session-fragility.md
- 2026-04-12 03:24: Lens C (evaluation-sync outage root cause) — COMPLETE: Handler file created 44h after process start. loadAgentHandlers() only runs at startup, so new handler files are never registered. evaluation-sync has NEVER fired. Immediate fix: restart process. Medium-term: dynamic handler registration on cron.json reload. See workspace/audit-evaluation-sync-outage.md
- 2026-04-12 03:53: Lens D (cron handler registration fragility) — forked (s_1775966053478_1835). New handlers added after startup are silently ignored, caused evaluation-sync outage. Fix: auto-register missing handlers on cron.json reload.
- 2026-04-12 04:23: Lens A (handler resolution architecture) — COMPLETE: 5 layers + meta-handler sublayer, 3 registries, inference-based resolveMode() is root architectural weakness (temporal coupling between registration timing and mode decisions). 5 consolidation opportunities ranked. See workspace/audit-handler-resolution-architecture.md
- 2026-04-12 04:54: Lens B (evaluation flow complexity) — COMPLETE: 4 paths traced end-to-end, 57+ total layers of indirection. Key findings: double full-directory scan (38K file reads at startup), two incompatible heuristic scoring implementations (computeHeuristicScores 400 lines vs computeEvaluation 80 lines with different outputs), findUnevaluatedChildren full-registry walk (1.9M checks/hr), WAL persistence causing evaluation data races. Consolidation: keep Path 1 (LLM) + Path 4 (sync), port Path 3's scoring into Path 4, delete Paths 2-3. See workspace/audit-evaluation-flow-complexity.md
- 2026-04-12 05:23: Lens C (evaluation dead weight cleanup) — **COMPLETE**: Removed Paths 2-3 (writeSkippedEvaluations, writeHeuristicEvaluations, computeHeuristicScores, detectFrustrationSignals, extractFinishCallParams). evaluator.ts: 1640→831 lines (-49%), total -2,373 lines across 9 files. Review branch: review/s_1775971448515_1880. See workspace/cleanup-evaluation-dead-weight.md
- 2026-04-12 05:24: **C1.5 ghost-deliverables false positive fix** — COMPLETE (commit 7d54e506). Changed convention-check.ts to use transcript-based verification instead of post-hoc existsSync(). The lifecycle.ts finish tool already validates at call time; re-checking hours later caused false positives when KB archival/cleanup moved files. Also fixes false positives from blocked finish calls (FM-3.1/FM-3.3/uncommitted).
- 2026-04-12 06:23: Lens D (analyze-failures cron bug fragility) — forked (s_1775975059405_1919). Persistent `db.query is not a function` error. Silent cron failure wastes resources.
- 2026-04-12 06:53: **Coder Skill Pruning P1** — forked (s_1775976871478_1936). Remove 4 untested skills (14.4KB), coder 7→3 skills.
- 2026-04-12 07:23: **Cron handler resolver** — forked (s_1775978657790_1948). 34 uncommitted lines in src/app/cron.ts for dynamic handler registration. Verify + commit to review branch.
- 2026-04-12 07:53: **P2 Fix**: Coder fewshot regex false positives — COMPLETE (s_1775980510847_1965). Fixed `.bin` and `consumer` pattern matches.
- 2026-04-12 08:23: Lens A — review branch hygiene audit forked (s_1775982270346_1978).
- 2026-04-12 08:53: **Feature/fix rotation**: deliver-or-report Phase 3 file detection fix forked (s_1775984075740_1996). Root cause diagnosed prior session, now applying fix.
- **Next**: Lens B
- 2026-04-12 05:53: **P1 Workflow Adoption** (req:afa5607f) — forked deliver-or-report escalation investigation (s_1775973259186_1900). Coach's plan has 3 Phase 1 items: (1) fix deliver-or-report 41% done rate, (2) wire implement-and-verify, (3) audit verify-wrap vs C1.5. Item 3 likely resolved by C1.5 fix from last session.
- **NOTE**: P1 QA heartbeat fix (req:5e23d82f/fe94b906) — write-blocked (heartbeat.md is identity file). Coach should apply the edit themselves or ask May.

## Low-Priority Cleanup
- [x] Phase 5d: Deprecate memory fallback — DONE (s_1775527469736_184, commit 34263ca)
- [ ] ~~Update design doc INDEX.md to mark session-digest.md as fully implemented~~ ✅ Done

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
