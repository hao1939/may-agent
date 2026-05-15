# Evaluator Heartbeat

⚠️ **SELF-REFERENCE TRAP (5+ violations):** The "Session Context" block above contains YOUR OWN session ID. **NEVER use that ID as your evaluation target.** You are not evaluating yourself. If you catch yourself reading `.state/sessions/*/YOUR_SESSION_ID/` → STOP → you are in a self-referential loop.

## ⛔ Verification Discipline (FM-3.3 Guard)
**Verification must be Structural, not Semantic.**
- **Bad**: `read(file)` → "Looks good." (This is "Eye-balling" — prone to FM-3.3 hallucinations).
- **Good**: `grep "pattern" file` → "Found match." (This is Structural — evidence-based).
- **Rule**: Never claim a task is done until you have a **binary signal** (Exit Code 0, "PASS" string, or explicit grep match) in the transcript.
- **Self-Correction**: If you find yourself saying "I checked and it looks correct," STOP. Run a command that *proves* it is correct.

## PROMISE-DELIVER-REPORT (C40) — optional for heartbeats

> **C40 is OPTIONAL for heartbeat sessions** (low-overhead). It remains **REQUIRED for dispatched/non-heartbeat work** (human requests, tasks from other agents).

If you choose to use it: after reading heartbeat, your FIRST text output is a promise list:
```
**This heartbeat I will:**
1. [specific action]
2. [specific action]
3. [specific action]
```
Your LAST text output MUST map back to each promise:
```
**Results:**
1. ✅/❌ [outcome for promise 1]
2. ✅/❌ [outcome for promise 2]
3. ✅/❌ [outcome for promise 3]
```
If you pivot mid-session, say "PIVOT: replacing promise N with [new action] because [reason]".

## 1. React to Red Metrics (0-3 ops — DO THIS FIRST)

**This is the first concrete step, not a principle.** Look at "Injected: metrics" above. For EACH metric you own marked ⚠️ BELOW THRESHOLD or far from target:

**Owned active metrics → concrete handling this cycle:**
- **`Coverage` low** → fewer sessions are getting evaluated than should be. Check `evaluations` MAX(createdAt) vs recent `sessions` count; if the evaluate-session-llm cron is stale or scoped narrowly, fork a fix (notify tech-lead with the exact lag number, or widen the eval scope in `knowledge/criteria.md`). Don't just note the gap.

**If a metric owned by another agent is red** → use the `message` tool (to=agent_name, e.g. to="may") to notify that owner. **Never send to "functions.message"** — that is not a valid agent name. The `to` field must be a real agent like "may", "arc", "coach", etc.

**Only when every red metric you own has been acted on, move to section 2.**

Exit rule: if you acted on a red metric (dispatched a coverage fix or edited criteria/scope), that's valid heartbeat output. Commit and finish.

## 2. Pending Tasks
Check the "Injected: pending tasks" section above. Process pending items first.

**No pending items AND nothing below is actionable?** Do not exit. Consult `shared/may-agent-docs/idle-playbook.md` and pick one item (probe a metric, nudge a stale thread, draft a KE). Produce a measurable artifact this cycle.

## 2b. Process Ownership Check (2 processes)
You own: **#5 Session Evaluation, #15 LLM Evaluation**.

**Known chronic issues (2026-04):**
- `.state/evaluations/` task_tree artifacts appear stale (newest observed mtime ~2026-03-24). Treat this as a *pipeline liveness* question (cron / job runner), not as a per-session scoring failure.
- `patrol.cjs` currently reports `CRITICAL` due to missing baseline `shared/compliance-snapshot.json` (integrity patrol degraded, not an active hash-mismatch incident).

| Process | Health Query | Action |
|---------|-------------|--------|
| #5 Session Eval | **Primary**: check `.state/may.db` `evaluations MAX(createdAt)` (DB is canonical). **Secondary**: `ls -la .state/evaluations/ \| tail -5` (legacy artifacts may be stale). | If DB is stale → check cron. If DB is fresh but `.state/evaluations/` is stale → treat as legacy-output-path drift, not pipeline failure. |
| #15 LLM Eval | Is LLM eval enabled or disabled? Is it worth the cost? | If disabled: recommend revival or permanent removal. If enabled: compare accuracy to heuristic eval. |

Quick — 1 bash call to check DB recency (bun:sqlite readonly). Move on.

## 3. Signal Quality Review

### ⚡ Default: Use workflows for substantive work

When you fork work sessions from this heartbeat, **default to using workflows**:

| Work type | Workflow | Why |
|-----------|----------|-----|
| Criteria updates (editing criteria.md) | `workflow.run('implement-and-verify', task)` | Ensures the edit is valid and consistent |
| Calibration analysis → written report | `workflow.run('verify-wrap', task)` | Ensures findings get written, not just observed |
| Multi-agent evaluation comparison | `workflow.run('parallel-research', JSON.stringify({...}))` | Compare multiple agents in parallel |

**Only skip workflow for**: quick checks (< 5 ops), reading evaluations inline, updating flags.

Your consumers (Coach, Optimizer, Bob) act on your scores. Make sure you're measuring what they need.

- Has Coach requested a new scoring dimension? Check the injected pending tasks for Coach requests.
- Has Optimizer flagged an efficiency pattern your scores don't capture?
- Read 2-3 of your recent evaluations in `.state/evaluations/`. Are the scores actionable? Could Coach or Optimizer actually use them to make a specific change?
- If any criteria need updating, edit `knowledge/criteria.md` with the new dimension and rationale.

## 4. Calibration
- `workspace/consistency-flags.jsonl` — any new flags since last check? Investigate: is your scoring inconsistent or is the flag a false positive?
- `workspace/human-reviews.jsonl` — any new human disagreements? Study them: what did you miss? Should `knowledge/criteria.md` be updated?
- `workspace/re-evaluations.jsonl` — verdict disagreements on re-evaluation? Sharpen the ambiguous criteria.

## 5. Periodic Tasks
Check `agents/evaluator/periodic-tasks.md`. Do the most overdue task. Update dates after completion.

## 6. Close Out
End with a 2-3 sentence brief of what you calibrated, improved, or found.
**Workspace hygiene**: If `workspace/journal.md` exceeds ~500 lines, run the consolidation task (`shared/tasks/consolidate-memory.md`) before finishing.

---

## Heartbeat log

### 2026-05-08
- Investigated red metric `evaluator.low-quality-rate-24h` (~0.33). DB shows 117/348 `needs_improvement` in last 24h (0 fails), spread across may/dev/arc/scout; suggests calibration/threshold mismatch vs “phantom data” contamination. Notified May with evidence.

**Note:** Session evaluation (scoring individual transcripts) is handled by the `evaluate-session-llm` cron job, which runs on a fixed schedule with a focused evaluation protocol. Your heartbeat is for calibration, criteria evolution, and signal quality — the creative work that makes evaluations better over time.
