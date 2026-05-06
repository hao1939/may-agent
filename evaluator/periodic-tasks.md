# Periodic Tasks (Evaluator)

These tasks are run by `cron:evaluator` every hour.
See `agents/evaluator/periodic-tasks.md` for the definitions.

Note: `sessions` table does **not** have a `createdAt` column; use `startedAt` (and `endedAt`) for recency queries.
Also: `evaluations.createdAt` is stored as an epoch-ms integer (not an ISO datetime string), so recency queries should compare numeric thresholds (e.g., `createdAt > (Date.now()-24*3600*1000)`) rather than `datetime('now', ...)`.

## 1. Score Recent Sessions
**Goal**: Ensure quality feedback loop.
- Filter sessions from last 24h.
- Pick 5 random non-evaluated sessions (use `status='completed'` and join to `evaluations`).
- Run the session-eval pipeline (canonical: `evaluations` table in `.state/may.db`).
  - Note: there is no public `score_session` CLI in this repo; do **not** claim you ran it unless you can cite a real tool/entrypoint + output.

## 2. Monitor Active Sessions (L2 Kinetic Defense)
**Goal**: Catch runtime anomalies (loops, stalls, errors, adversarial attacks) without waiting for session end.
- Run `agents/evaluator/skills/monitor-session.cjs` (Wink Pattern).
- **Hardened (P108)**: Checks for `SELF_VALIDATION`, `FAKE_POLICY`, and `REASONING_MISMATCH`.
- If `status != "OK"`, trigger intervention (e.g., interrupt session, warn operator).
- Log incidents to `agents/shared/bulletin.md` with ⚠️ alert.

## 3. Run Patrol (L3/L4 System Defense)
**Goal**: Detect Integrity Drift (File Tampering) and Coordination Drift (Stuck Tasks).
- Run `agents/evaluator/skills/patrol.cjs`.
- If `status == "CRITICAL"` (File Tampering), log to `agents/shared/bulletin.md` with 🚨 alert and notify Bob.
- If `status == "WARNING"` (Stuck Task), log to `agents/shared/bulletin.md` with ⚠️ alert and notify May.

## 4. Detect Statistical Drift (L3 Defense)
**Goal**: Catch "Boiling Frog" degradation (P30) and "Consensus Hallucination".
- **Detect**: Run the P53 compliance audit.
  - **Current status (2026-04-05):** The documented entrypoint `node agents/evaluator/skills/detect-p53-drift.cjs` is missing; only `agents/evaluator/skills/detect-p53-drift/SKILL.md` exists. Until an entrypoint is restored, treat this step as **blocked** and rely on `patrol.cjs` + receipt audits.
  - **Also required**: `agents/shared/compliance-snapshot.json` baseline must exist for `patrol.cjs` to report meaningful integrity status; otherwise it will return `CRITICAL` with `Missing compliance-snapshot.json`.
  - **Action**: Treat this as an infra/config missing-artifact issue (integrity patrol degraded), not as an actual hash mismatch. File owner: Bob (baseline snapshot source of truth).
- **Respond**: Run `node agents/evaluator/skills/trigger-response.cjs` (Skill) to dispatch tasks (Growth Cycle / Revert).
- **Log**: Append findings to `agents/shared/bulletin.md`.

## 5. Analyze Delegation Metrics (L3 Collective Defense)
**Goal**: Catch "Integration Drift" (P71) where agents succeed individually but fail collectively.
- Run `delegation_metrics` (Skill).
- Check for **Integration Success Rate < 80%** on core pairs (May->Coder, Coder->QA).
- If critical drift found, log to `agents/shared/bulletin.md` with 🚨 alert.

## 6. Backup Agent Configs
**Goal**: Maintain restore points for "Time Machine" (P69).
- Run `manage_backups` with action=`backup`.
- Keeps a daily snapshot of all agent configs/prompts.

## 7. Extract Strategies from Logs (P63)
**Goal**: Turn recent session logs into reusable, high-confidence strategies.
- Run `extract-strategy.cjs` on recent sessions (last 24h).
- Write findings to `agents/evaluator/workspace/proposed-strategies.md`.
- Do NOT update `agents/shared/knowledge/strategies.md` directly (Bob reviews first).
- **After running**: update this file with the last-run timestamp (YYYY-MM-DD HH:MM) and how many logs/lessons were produced.

**Last run**: 2026-05-03 20:20Z — DB canonical check: `MAX(evaluations.createdAt)=1777837490436`; `MAX(sessions.startedAt)=1777839587988` → eval lag ≈35m at check time (pipeline appears live but slightly behind). Legacy `.state/evaluations/` artifacts: latest `task_tree_*.json` mtime still 2026-03-24 → treat as legacy path drift, not DB liveness.

Ran `monitor-session.cjs --running`: 4 checked, 3 healthy, 1 `DRIFT` (arc `s_1777839263183_2631`; recommended action: warn). (Did not run `patrol.cjs` this cycle.) Confirmed Process #15 still absent: `.state/may.db` has no `*llm*` tables.

**Last run**: 2026-05-04 05:50Z — DB canonical check: `MAX(evaluations.createdAt)=1777867838078`; `MAX(sessions.startedAt)=1777873810596` → eval lag ≈99.5m at check time. Legacy `.state/evaluations/` artifacts: newest mtime observed 2026-04-29; `task_tree_*.json` mtimes still 2026-03-24 → treat as legacy path drift, not DB liveness.

Did **not** run `monitor-session.cjs` or `patrol.cjs` this cycle.

(Also confirmed schema detail: `sessions` uses `startedAt`/`endedAt` not `createdAt`; `evaluations` does have `createdAt`.)

**Last run**: 2026-05-05 06:00Z — DB canonical check: `MAX(evaluations.createdAt)=1777951000889`; `MAX(sessions.startedAt)=1777958394689` → eval lag ≈2.06h at check time (pipeline appears live). Legacy `.state/evaluations/` artifacts: `task_tree_*.json` mtimes still 2026-03-24; newest `s_*.json` mtime observed 2026-04-29 → treat as legacy path drift, not pipeline failure.

LLM vs heuristic mix (last 7d): `evaluatedByHeuristic=1` → 809; `evaluatedByHeuristic=0` → 1833.

Did **not** run `monitor-session.cjs` or `patrol.cjs` this cycle.

**Last run**: 2026-05-05 15:55Z — DB canonical check: `MAX(evaluations.createdAt)=1777992401741` (2026-05-05T14:46:41Z); `MAX(sessions.startedAt)=1777996220920` (2026-05-05T15:50:20Z) → eval lag ≈63.6m at check time (pipeline live).

Legacy `.state/evaluations/` artifacts: newest file mtime still 2026-04-29; `task_tree_*.json` mtimes still 2026-03-24 → treat as legacy output-path drift, not DB liveness failure.

Did **not** run `monitor-session.cjs` or `patrol.cjs` this cycle.

**Last run**: 2026-05-06 06:51Z — DB canonical check: `MAX(evaluations.createdAt)=1778028402653` (2026-05-06T00:46:42Z); `MAX(sessions.startedAt)=1778050217108` (2026-05-06T06:50:17Z) → eval lag ≈6h03m at check time (pipeline still updating; lag notable).

Legacy `.state/evaluations/` artifacts: `task_tree_*.json` mtimes still 2026-03-24; newest `s_*.json` mtime observed 2026-04-29 → treat as legacy output-path drift, not DB liveness.

Ran `monitor-session.cjs --running`: 3 checked, 3 healthy.

Ran `patrol.cjs`: **CRITICAL** due to missing `agents/shared/compliance-snapshot.json` baseline (integrity patrol degraded — not a hash mismatch event).

**Last run**: 2026-05-06 14:20Z — DB canonical check: `MAX(evaluations.createdAt)=1778066602681` (2026-05-06T11:23:22Z); `MAX(sessions.startedAt)=1778077117818` (2026-05-06T14:18:37Z) → eval lag ≈175.3m (~2h55m) at check time.

Last-24h volume: `sessions`=1038 vs `evaluations`=21 → coverage appears very low (pipeline running but not keeping up / scope narrowed / job stalled intermittently).

Legacy `.state/evaluations/` artifacts: newest mtime observed 2026-04-29; `task_tree_*.json` mtimes still 2026-03-24 → continue treating as legacy path drift, not DB liveness.

**Previous run**: 2026-05-03 01:13Z — DB canonical check: `MAX(evaluations.createdAt)=1777768954999` (2026-05-03T00:42:34Z; eval pipeline live). `MAX(sessions.createdAt)=1777768954999` (2026-05-03T00:42:34Z). Investigation note: bob’s depressed average score (~0.408) appears strongly explained by `shallow_session` tagging (50% of bob evals); when shallow-tagged, avg score ≈0.20 vs non-shallow ≈0.617. Similar pattern for coach/optimizer (shallow avg ≈0.20).

Ran `monitor-session.cjs --running`: 1 alert (`STALL` amy `s_1777626616591_0` idle 1158m; recommended action: kill). Ran `patrol.cjs`: CRITICAL due to missing `agents/shared/compliance-snapshot.json` baseline (patrol degraded, not a mismatch event).

**Previous run**: 2026-04-30 19:49Z — DB canonical check: `sessions` last 24h=2504; `evaluations` last 24h=706; `MAX(evaluations.createdAt)=1777576635974` (2026-04-30T19:17:15.974Z; eval pipeline live). Legacy `.state/evaluations/` shows newer `s_*.json` (Apr 29) but `task_tree_*.json` mtimes remain Mar 24 → treat as legacy path drift, not pipeline failure. Confirmed DB has **no** tables matching `*llm*` (Process #15 appears disabled/unimplemented or renamed). Ran `monitor-session.cjs --running`: 2 checked, 2 healthy. Ran `patrol.cjs`: CRITICAL due to missing `agents/shared/compliance-snapshot.json` baseline (patrol degraded, not a mismatch event).

**Previous run**: 2026-04-14 03:51Z — DB canonical check: `.state/may.db` table inventory includes `evaluations`; `MAX(evaluations.createdAt)=1776137757747` (eval pipeline live). Confirmed DB has **no** `llm_evaluations`/`llm_evals` tables (Process #15 appears disabled/unimplemented or renamed). Legacy `.state/evaluations/` artifacts still stale — newest mtime observed: 2026-03-24. Ran `monitor-session.cjs --running`: 9 checked, 7 healthy, 2 alerts (`STALL` coach `s_1776133354975_536`, `PROTOCOL_VIOLATION` may `s_1776138677801_562`). Ran `patrol.cjs`: CRITICAL due to missing `agents/shared/compliance-snapshot.json` baseline (patrol degraded, not a mismatch event).

**Previous run**: 2026-04-13 21:21Z — DB canonical check: `.state/may.db` `MAX(evaluations.createdAt)=1776115016561` (eval pipeline live). Confirmed DB table inventory includes `evaluations` and **no** `llm_evaluations`/`llm_evals` table (Process #15 still appears disabled/unimplemented or renamed). Legacy `.state/evaluations/` artifacts still stale — newest mtime observed: 2026-03-24. Ran `monitor-session.cjs --running`: 8 checked, 8 healthy.

**Previous run**: 2026-04-13 18:21Z — DB canonical check: `.state/may.db` `MAX(evaluations.createdAt)=1776103615992` (eval pipeline live). Confirmed DB table inventory includes `evaluations` and **no** `llm_evaluations`/`llm_evals` table (Process #15 still appears disabled/unimplemented or renamed). Legacy `.state/evaluations/` artifacts still stale — newest mtime observed: 2026-03-24. Ran `monitor-session.cjs --running`: 8 checked, 8 healthy. (Patrol not rerun in this heartbeat; known CRITICAL is baseline-missing `agents/shared/compliance-snapshot.json`.)

**Previous run**: 2026-04-13 16:52Z — DB canonical check: `.state/may.db` `MAX(evaluations.createdAt)=1776098815746` (eval pipeline live). Confirmed DB has **no** `llm_evaluations` table (Process #15 still appears disabled/unimplemented or renamed). Legacy `.state/evaluations/` artifacts still stale — newest mtime observed: 2026-03-24. Ran `monitor-session.cjs --running`: 14 checked, 11 healthy, 3 alerts (2×`PROTOCOL_VIOLATION` P114, 1×`STALL`). (Patrol not rerun in this heartbeat; known CRITICAL is baseline-missing `agents/shared/compliance-snapshot.json`.)

**Previous run**: 2026-04-13 16:21Z — DB canonical check: `.state/may.db` `MAX(evaluations.createdAt)=1776097013968` (2026-04-13T16:16:53Z; eval pipeline live). Confirmed DB has **no** `llm_evaluations` table (Process #15 still appears disabled/unimplemented or renamed). Legacy `.state/evaluations/` artifacts still stale — newest mtime observed: 2026-03-24. Ran `monitor-session.cjs --running`: 9 checked, 9 healthy. Ran `patrol.cjs`: CRITICAL due to missing `agents/shared/compliance-snapshot.json` baseline (patrol degraded, not a mismatch event).

**Previous run**: 2026-04-13 09:52Z — DB canonical check: `.state/may.db` `MAX(evaluations.createdAt)=1776073012830` (2026-04-13T09:36:52.830Z; eval pipeline live/recent at check time). Confirmed DB tables include `evaluations` but no `llm_evaluations`/`llm_evals` (no `llm_*` tables present; Process #15 appears disabled/unimplemented or renamed). Legacy `.state/evaluations/` artifacts still stale — newest mtime observed: 2026-03-24.

**Previous run**: 2026-04-13 07:51Z — DB canonical check: `.state/may.db` `MAX(evaluations.createdAt)=1776065811986` (2026-04-13T07:36:51.986Z; eval pipeline live/recent at check time). Also observed `.state/may.db` `MAX(requests.createdAt)=1776066697508` (2026-04-13T07:51:37.508Z; DB actively being written). Confirmed DB tables include `evaluations` but no `llm_evaluations`/`llm_evals` (Process #15 appears disabled/unimplemented or renamed). Legacy `.state/evaluations/` artifacts still stale — newest mtime observed: 2026-03-24.

**Previous run**: 2026-04-13 07:22Z — DB canonical check: `.state/may.db` `MAX(evaluations.createdAt)=1776064011794` (2026-04-13T07:06:51.794Z; eval pipeline live/recent at check time). Confirmed DB tables include `evaluations` but no `llm_evaluations`/`llm_evals` (Process #15 appears disabled/unimplemented or renamed). Legacy `.state/evaluations/` artifacts still stale — newest mtime observed: 2026-03-24.

**Previous run**: 2026-04-13 06:51Z — DB canonical check: `.state/may.db` `MAX(evaluations.createdAt)=1776062211823` (2026-04-13T06:36:51.823Z; eval pipeline live/recent at check time). Confirmed DB has no `llm_evaluations` table (Process #15 still appears disabled/unimplemented or renamed). Legacy `.state/evaluations/` artifacts still stale — newest mtime observed: 2026-03-24.

**Previous run**: 2026-04-13 05:52Z — DB canonical check: `.state/may.db` `MAX(evaluations.createdAt)=1776059208071` (2026-04-13T05:46:48Z; eval pipeline live/recent at check time). Confirmed DB has no `llm_evaluations` table (Process #15 still appears disabled/unimplemented or renamed). Legacy `.state/evaluations/` artifacts still stale — newest mtime observed: 2026-03-24.

**Previous run**: 2026-04-12 11:53Z — DB canonical check: `.state/may.db` `max(evaluations.createdAt)=1775950088090` (≈2026-04-11T21:28:08Z; eval pipeline appears **stale ~14h25m** at check time). Querying `llm_evaluations` raised `no such table` (so Process #15 still appears disabled/unimplemented or renamed). Legacy `.state/evaluations/` artifacts still stale — newest mtime observed: 2026-03-24.

**Previous run**: 2026-04-10 06:24 — DB canonical check: `.state/may.db` `max(evaluations.createdAt)=1775800578748` (pipeline live). DB table inventory shows **no LLM-eval table** (`llm_evals`/`llm_evaluations` absent) → Process #15 appears disabled/unimplemented (or renamed). Legacy `.state/evaluations/` artifacts still stale — newest mtime observed: 2026-03-24. Ran `node agents/evaluator/skills/monitor-session.cjs --running`; result: 8 checked, 8 healthy. Ran `node agents/evaluator/skills/patrol.cjs`; result: CRITICAL due to missing `agents/shared/compliance-snapshot.json` baseline (patrol degraded, not a mismatch event).

**Previous run**: 2026-04-09 13:53 — DB canonical check: `.state/may.db` `max(evaluations.createdAt)=1775741955442` (pipeline live). DB table inventory: includes `evaluations`, `sessions`, `session_digests` and **no `llm_evaluations` table** → treat Process #15 as disabled/unimplemented (or renamed). Legacy `.state/evaluations/` artifacts still stale — newest mtime observed: 2026-03-24. Ran `node agents/evaluator/skills/monitor-session.cjs --running`; result: 10 checked, 9 healthy, 1 `STALL` (coach session `s_1775741109622_382`, idle 12m; recommended action: investigate). Ran `node agents/evaluator/skills/patrol.cjs` → status `CRITICAL` with error `Missing compliance-snapshot.json` (baseline missing; patrol degraded, not a mismatch event).

**Previous run**: 2026-04-09 05:53 — DB canonical check: `.state/may.db` `max(evaluations.createdAt)=1775712356004` (pipeline live). Legacy `.state/evaluations/` artifacts still stale — newest mtime observed: 2026-03-24. Ran `node agents/evaluator/skills/monitor-session.cjs --running`; result: 7 checked, 7 healthy. (Patrol not rerun in this heartbeat; known CRITICAL is baseline-missing `agents/shared/compliance-snapshot.json`.)

**Previous run**: 2026-04-08 16:33 — DB canonical check: `.state/may.db` `evaluations MAX(createdAt)=2026-04-08T16:32:17Z` (`MAX(createdAt)=1775665937198`, pipeline live). Legacy `.state/evaluations/` artifacts still stale (newest mtime observed: 2026-03-24). Ran `node agents/evaluator/skills/monitor-session.cjs --running`; result: 7 checked, 6 healthy, 1 `STALL` (coach session `s_1775662404124_67`, idle 34m; recommended action: kill). Ran `node agents/evaluator/skills/patrol.cjs` → status `CRITICAL` with error `Missing compliance-snapshot.json` (baseline missing; patrol degraded, not a mismatch event).

**Previous run**: 2026-04-08 05:32 — DB canonical check: `.state/may.db` `evaluations MAX(createdAt)=2026-04-08T05:04:08Z` (pipeline live; `MAX(createdAt)=1775624647947`). Legacy `.state/evaluations/` artifacts still stale (newest mtime observed: 2026-03-24). Ran `node agents/evaluator/skills/monitor-session.cjs --running`; result: 9 checked, 9 healthy. Ran `node agents/evaluator/skills/patrol.cjs` → status `CRITICAL` with error `Missing compliance-snapshot.json` (baseline missing; patrol degraded, not a mismatch event).

**Previous run**: 2026-04-07 23:02 — checked `.state/evaluations/` (still stale; newest mtime observed: 2026-03-24). Ran `node agents/evaluator/skills/monitor-session.cjs --running`; result: 8 checked, 8 healthy. Ran `node agents/evaluator/skills/patrol.cjs` → status `CRITICAL` with error `Missing compliance-snapshot.json` (baseline missing; patrol degraded, not a mismatch event).

**Previous run**: 2026-04-04 08:46 — ran `node agents/evaluator/skills/monitor-session.cjs --running`; result: 5 checked, 4 healthy, 1 `PROTOCOL_VIOLATION` (coach P114 Experience Replay missing). Also ran `node agents/evaluator/skills/patrol.cjs` → status `CRITICAL` with error `Missing compliance-snapshot.json`.

**P63 Extract Strategies — Last run**: 2026-03-30 10:41 — artifacts sampled: 6 eval JSONs + 2 monitor outputs; strategies proposed: 5 (see `agents/evaluator/workspace/proposed-strategies.md`)

## 8. Receipt Audit (P192)
**Goal**: Verify that agents aren't fabricating success claims without cryptographic proof.
- Check 5 recent sessions for signature validity.
- For each session: find any `[SIG:...]` tags in tool outputs.
- **Note (2026-04-05):** there is currently no `verify_receipt` tool/entrypoint available in this repo; treat receipt audit as **presence-only** (does the session have a `[SIG: ...]` tag?) until an actual verifier is implemented.
- If a session claims "Tests Passed" or "File Written" but has no `[SIG:...]`, flag as `[MISSING_RECEIPT]` (HB#389).
- Log violations to `agents/shared/bulletin.md` with ⚠️ alert.

## 9. LLM Eval Liveness (Process #15)
**Goal**: Determine whether LLM evaluation is enabled; if disabled, decide revive vs remove.
- Canonical source: `.state/may.db` (do not rely on legacy artifact directories).
- Check for existence of any `*llm*` table names (e.g., `llm_evaluations`) and/or a dedicated LLM-eval job/cron.
- If missing: treat as "LLM eval disabled or not implemented" and open a tracked item to either (a) add it back, or (b) remove/rename docs that imply it exists.

**Last check**: 2026-04-29 — `.state/may.db` has **no** tables matching `*llm*` (query: `sqlite_master WHERE name LIKE '%llm%'` returned empty). Latest evaluator pipeline DB write still healthy: `MAX(evaluations.createdAt)=1777498157440` (2026-04-29T21:29:17Z).
