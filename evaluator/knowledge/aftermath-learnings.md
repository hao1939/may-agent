# Aftermath learnings (evaluator)

## 2026-05-08 — s_1778211532870_3
- Do not rely on the `write()` preview as verification; always `read()` the artifact after writing before calling `finish(success)`.
- Avoid directory reads (EISDIR): read `.../project.md` explicitly.
- In `finish()` verification_evidence, only cite tool outputs that are actually present in the session transcript; prefer including the SQL snippet and row count.
