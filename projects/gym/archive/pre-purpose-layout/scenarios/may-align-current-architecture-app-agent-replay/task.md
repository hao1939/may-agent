This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.

# System state

- Draft label status: `draft` / unapproved. Source review: `/app/projects/gym.app/.state/reviews/incident-telegram-field-b04b37df70b8ac81f416.md`.
- Hao asks: “I’m confused about whether this system should be organized by app or by agent. What is the difference/value of each, and what does the current design actually implement?”
- Prior session history shows an unverified memory-based answer claimed the mapping was `1:1`, which caused confusion.
- Reviewed architecture evidence shows: apps/projects organize ownership, state, evidence, review responsibility, and operational boundaries; agents are execution identities/roles used for routing and task work; and apps and agents are not inherently 1:1.
