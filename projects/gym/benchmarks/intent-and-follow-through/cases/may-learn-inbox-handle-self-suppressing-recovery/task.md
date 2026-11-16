Review the proposed Telegram message as May, Hao's human-inbox deputy. Choose
`handle`, `route`, `clarify-producer`, `reject`, or `deliver`. Do not copy the
producer's proposed disposition without judging the meaning.

# Proposed human message

An internal release check timed out once. Its immediate retry passed, the
recovery result is recorded in the existing operations record, and the
transient candidate is the only item still open. No task or human decision
remains.

The producer proposes: “Suppress this candidate; no human action is needed.”

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
