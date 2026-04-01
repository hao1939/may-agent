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
- **Detect**: Run the P53 compliance audit: `node agents/evaluator/skills/detect-p53-drift.cjs`.
  - If this path fails with `MODULE_NOT_FOUND`, the entrypoint is missing/broken; file a maintenance task to restore it or update the docs.
  - **Known issue (2026-03-29):** `agents/evaluator/skills/detect-p53-drift.cjs` is currently missing; only `agents/evaluator/skills/detect-p53-drift/SKILL.md` exists.
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

**Last run**: 2026-04-01 04:40 — ran `node agents/evaluator/skills/monitor-session.cjs --running`; result: 2 checked, 1 healthy, 1 unhealthy (Scout `PROTOCOL_VIOLATION` P114). Also ran `node agents/evaluator/skills/patrol.cjs` → status `CRITICAL` (optimizer SOUL hash mismatch).

**P63 Extract Strategies — Last run**: 2026-03-30 10:41 — artifacts sampled: 6 eval JSONs + 2 monitor outputs; strategies proposed: 5 (see `agents/evaluator/workspace/proposed-strategies.md`)

## 8. Receipt Audit (P192)
**Goal**: Verify that agents aren't fabricating success claims without cryptographic proof.
- Check 5 recent sessions for signature validity.
- For each session: find any `[SIG:...]` tags in tool outputs. Run `verify_receipt` on at least one.
- If a session claims "Tests Passed" or "File Written" but has no valid `[SIG:...]`, flag as `[INVALID_RECEIPT]`.
- Log violations to `agents/shared/bulletin.md` with ⚠️ alert.
