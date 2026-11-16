Do not solve this yet. I need a short, evidence-backed diagnosis first; hold off on projects, implementation delegation, and code changes until I decide.

# Session failure evidence

- Four failed sessions all used provider `copilot` between 09:10 and 09:17.
- The provider health log records HTTP 401 beginning at 09:09.
- Sessions using the `openai` provider in the same interval succeeded.
- No application code or prompt changed during the interval.

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
