# Periodic Tasks (Evaluator)

These tasks are run by `cron:evaluator` every hour.
See `agents/evaluator/periodic-tasks.md` for the definitions.

## 1. Score Recent Sessions
**Goal**: Ensure quality feedback loop.
- Filter sessions from last 24h.
- Pick 5 random non-evaluated sessions.
- Run `score_session` on each.

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

**Last run**: 2026-04-12 11:53Z — DB canonical check: `.state/may.db` `max(evaluations.createdAt)=1775950088090` (≈2026-04-11T21:28:08Z; eval pipeline appears **stale ~14h25m** at check time). Querying `llm_evaluations` raised `no such table` (so Process #15 still appears disabled/unimplemented or renamed). Legacy `.state/evaluations/` artifacts still stale — newest mtime observed: 2026-03-24.

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
- Check for existence of a `llm_evaluations` (or similarly named) table.
- If missing: treat as "LLM eval disabled or not implemented" and open a tracked item to either (a) add it back, or (b) remove/rename docs that imply it exists.

**Last check**: 2026-04-09 19:23Z — `.state/may.db` tables include `evaluations` but no `llm_evaluations` (LLM eval appears disabled/unimplemented).
