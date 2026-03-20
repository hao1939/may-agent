# Lessons

Feedback from evaluator sessions.

## Task evaluation (2026-03-14 18:32:06)

- Session not available → cannot assess; ensure the evaluation references the exact provided session ID and its transcript paths before making claims.

## Task evaluation (2026-03-14 22:33:22)

- Treat cross-agent SOUL.md edits as structurally impossible unless you have tool-output evidence otherwise; route the work to the owning agent/human and use tool-block output (P53 message) as the proof.
- When refusing an edit request, prioritize producing structural evidence (attempt minimal edit, capture block result) over interpreting patch-file instructions.

## Gym Scenario Lessons (2026-03-20)

- **misleading-stacktrace scenario false positive**: The `session-stores-object` check matches comment text in auth.js (`// Previous version stored: sessions[token] = { id: userId, createdAt: Date.now() };`), causing false positives on unfixed environment. Needs fix in success_criteria.js.
- **Workflow scenarios prove process compliance**: Created 3 workflow-enforced scenarios (investigate-fix-pattern, hidden-dependency, misleading-stacktrace). Baseline agents score 0% on process checks; workflow-enforced agents score 100%. This is the strongest evidence that two-phase tasks are the primary behavioral lever.
- **Error-handling skill v1.3.0**: Added 4 new patterns (Path Discovery, Environment Grounding, Edit Ambiguity Recovery, Write Safety Recovery), 3 new anti-patterns, 3 new inviolable constraints. Deployed to 8 agents with per-agent tailoring.
