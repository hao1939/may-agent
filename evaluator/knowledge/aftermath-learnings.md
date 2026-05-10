# Aftermath learnings (evaluator)

## 2026-05-08 — s_1778211532870_3
- Do not rely on the `write()` preview as verification; always `read()` the artifact after writing before calling `finish(success)`.
- Avoid directory reads (EISDIR): read `.../project.md` explicitly.
- In `finish()` verification_evidence, only cite tool outputs that are actually present in the session transcript; prefer including the SQL snippet and row count.

## 2026-05-09 — s_1778318801048_15
- Arc heartbeat hygiene reviews must distinguish the agent's own edit set from ambient shared-worktree dirt; concurrent `*/last-session.md` and gate-log modifications are not, by themselves, evidence of an arc lane violation.

## 2026-05-09 — s_1778349968391_145
- In success-candidate aftermath reviews, inspect adjacent knowledge artifacts for novelty, not just correctness: a cleanly committed KB entry can still be low-leverage if it substantially overlaps an existing entry (here KE-1020 vs KE-1011).

## 2026-05-09 — s_1778359911953_268
- For creative heartbeat reviews, separate prompt compliance from delivered value: a session can ship a real, committed synthesis artifact yet still miss required pre-work (for example, not reading the mandated metric-analysis KEs/manual first). Credit the durable insight, but note the skipped prerequisite as an output-quality downgrade rather than treating the whole run as empty.

## 2026-05-10 — s_1778374268813_450
- When reviewing scout digest sessions, inspect the session's specific commit snapshot (for example `git show <commit>:scout/workspace/digest/today.md`) instead of only HEAD. `digest/today.md` is a rolling file and later scout sessions can overwrite or shrink it, which otherwise makes a good session look missing or corrupt.

## 2026-05-10 — s_1778388949256_641
- For success-candidate heartbeat reviews, treat a small update as substantive when the agent reopens an existing knowledge artifact, tests a previously declared falsifier/follow-up condition with fresh evidence from the current session, and commits the result in the canonical file. A recovered finish-path mistake should hit efficiency, not erase quality.
