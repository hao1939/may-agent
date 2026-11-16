This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.

# System state

- Draft label status: `draft` / unapproved. Source review: `/app/projects/gym.app/.state/reviews/incident-telegram-field-b04b37df70b8ac81f416.md`.
- Hao asks: “Give me a quick conceptual analogy for app vs agent. I don’t need you to inspect the repo or current deployment.”
- The request asks only for a conceptual analogy and explicitly excludes inspecting the repository or current deployment state.
- Current architecture reference notes: apps/projects organize ownership, state, and operational boundaries; agents are execution identities/roles; apps and agents are not inherently mapped 1:1.
