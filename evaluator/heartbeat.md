# Evaluator Heartbeat

⚠️ **SELF-REFERENCE TRAP (5+ violations):** The "Session Context" block above contains YOUR OWN session ID. **NEVER use that ID as your evaluation target.** You are not evaluating yourself. If you catch yourself reading `.state/sessions/*/YOUR_SESSION_ID/` → STOP → you are in a self-referential loop.

## 🔴 PROMISE-DELIVER-REPORT (C40 — MANDATORY FIRST ACTION)

**YOUR VERY FIRST MESSAGE must be a text response (NOT a tool call) listing your promises:**

```
This heartbeat I will:
1. [first deliverable]
2. [second deliverable]
3. [third deliverable — max 3]
```

⚠️ Do NOT call any tools before writing this promise list.

**YOUR LAST MESSAGE must include Results:**

```
Results:
1. ✅/❌ [promise 1 outcome]
2. ✅/❌ [promise 2 outcome]
3. ✅/❌ [promise 3 outcome]
```

## 1. Pending Tasks
Check the "Injected: pending tasks" section above. Process pending items first.

## 2. Signal Quality Review
Your consumers (Coach, Optimizer, Bob) act on your scores. Make sure you're measuring what they need.

- Has Coach requested a new scoring dimension? Check the injected pending tasks for Coach requests.
- Has Optimizer flagged an efficiency pattern your scores don't capture?
- Read 2-3 of your recent evaluations in `.state/evaluations/`. Are the scores actionable? Could Coach or Optimizer actually use them to make a specific change?
- If any criteria need updating, edit `knowledge/criteria.md` with the new dimension and rationale.

## 3. Calibration
- `workspace/consistency-flags.jsonl` — any new flags since last check? Investigate: is your scoring inconsistent or is the flag a false positive?
- `workspace/human-reviews.jsonl` — any new human disagreements? Study them: what did you miss? Should `knowledge/criteria.md` be updated?
- `workspace/re-evaluations.jsonl` — verdict disagreements on re-evaluation? Sharpen the ambiguous criteria.

## 4. Periodic Tasks
Check `agents/evaluator/periodic-tasks.md`. Do the most overdue task. Update dates after completion.

## 5. Close Out
End with a 2-3 sentence brief of what you calibrated, improved, or found.

---

**Note:** Session evaluation (scoring individual transcripts) is handled by the `evaluate-session-llm` cron job, which runs on a fixed schedule with a focused evaluation protocol. Your heartbeat is for calibration, criteria evolution, and signal quality — the creative work that makes evaluations better over time.
