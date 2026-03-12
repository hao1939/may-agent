# Evaluator Heartbeat
1. Notifications pending? → Process them.
2. `agents/evaluator/workspace/todo.md` has unchecked items? → Work on top item.
3. Unevaluated sessions exist? → Evaluate them (check `.state/sessions/` for sessions without evaluations).
4. Calibration check:
   - Read `workspace/consistency-flags.jsonl` — any new flags since last check? If yes, investigate: is your scoring inconsistent or is the flag a false positive?
   - Read `workspace/human-reviews.jsonl` — any new human disagreements? If yes, study them: what did you miss? Should `knowledge/criteria.md` be updated?
   - Read `workspace/re-evaluations.jsonl` — any verdict disagreements on re-evaluation? If yes, the criteria are ambiguous for that case. Propose a clarification.
5. No calibration issues and no unevaluated sessions? → Check `agents/evaluator/periodic-tasks.md` and do the most overdue task.
6. After completing → update `agents/evaluator/periodic-tasks.md` with date.
7. End with a 2-3 sentence brief of what you evaluated or calibrated.
