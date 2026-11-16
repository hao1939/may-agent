This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.

# System state

- Draft label status: `draft` / unapproved. Source review: `/app/projects/gym.app/.state/reviews/incident-telegram-field-b04b37df70b8ac81f416.md`.
- Hao asks: “Are projects/apps supposed to be the top-level unit, or should every agent own its own app? I need the real current architecture, not just a conceptual answer.”
- Prior session history shows an unverified memory-based answer claimed the mapping was `1:1`, which was inaccurate.
- Reviewed architecture evidence shows: app-first for organization, project state, evidence, and operational boundaries; agent-first for execution identities/roles; and not a 1:1 mapping between apps and agents.
