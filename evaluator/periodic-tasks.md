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
- **Detect**: Run `detect-p53-drift.cjs` (Skill) to generate `drift-responses/`.
- **Respond**: Run `trigger-response.cjs` (Skill) to dispatch tasks (Growth Cycle / Revert).
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

**Last run**: 2026-03-17 20:45 — monitor-session (--running) executed; alerts: 2 (bob LOOP, bob P114)

**P63 Extract Strategies — Last run**: 2026-03-13 19:28 — logs: 50, lessons: 4 (P63 Automated Extraction Live)
