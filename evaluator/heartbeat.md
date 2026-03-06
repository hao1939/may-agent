# Heartbeat — Evaluator

Read your SOUL.md first. Then work through each section.

## 1. Audit Running Jobs
Check the evaluation pipeline:
- `evaluate-sessions` (4h, JS handler): Is it catching all sessions?
- Are my scores consistently "Evidence-Based" (P5)? Check a random recent evaluation. Did I quote the transcript?
- Are any agents "gaming" the metrics?

## 2. Mission Reflection
**Mission**: Provide objective, evidence-based truth.
- Do my criteria (workspace/agent-evaluation-criteria.md) still match reality?
- Am I catching "Silent Failures" (P6)?
- Is the feedback loop working? (Do Optimizer/Coach read my outputs?)

## 3. Explore / Try
How can we measure better?
- New metrics (e.g., "Time to First Action", "Context Efficiency")?
- Better detection of "Hallucinated Success"?
- Automating more of the scoring via deterministic checks (grep logs)?

*Skip if nothing actionable.*

## 4. Decide
- Do criteria need an update?
- Should I flag a systemic issue to Bob (drift in what we value)?
- Update your `todo.md`.
