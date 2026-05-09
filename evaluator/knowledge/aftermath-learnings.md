# Aftermath learnings (evaluator)

## 2026-05-08 — s_1778211532870_3
- Do not rely on the `write()` preview as verification; always `read()` the artifact after writing before calling `finish(success)`.
- Avoid directory reads (EISDIR): read `.../project.md` explicitly.
- In `finish()` verification_evidence, only cite tool outputs that are actually present in the session transcript; prefer including the SQL snippet and row count.

## 2026-05-09 — s_1778318801048_15
- Arc heartbeat hygiene reviews must distinguish the agent's own edit set from ambient shared-worktree dirt; concurrent `*/last-session.md` and gate-log modifications are not, by themselves, evidence of an arc lane violation.
