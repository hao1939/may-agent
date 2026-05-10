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

## 2026-05-10 — s_1778390743041_660
- In aftermath reviews, do not equate a final `partial` status with empty output when guard friction intervened. If the transcript and git evidence show committed, readable artifacts, score efficiency down for the retry loop but keep quality credit for the landed work.

## 2026-05-10 — s_1778405107928_828
- When a session writes shared knowledge entries with low bare IDs (for example `KE-001.md`, `KE-002.md`), inspect both the commit snapshot and the parent snapshot with `git show <commit>^:<path>` before crediting success. A clean commit and readable file can still hide destructive overwrite of canonical knowledge, so parent-vs-commit comparison is required for shared-KB aftermath reviews.

## 2026-05-10 — s_1778406713013_848
- For success-candidate scout heartbeat reviews, compare adjacent same-day KEs before over-crediting novelty, but keep quality credit when the new note adds a concrete local lever (for example turning nearby SLM/sandbox observations into a recommendation for finer-grained micro-agent decomposition). Immediate recovery from ignored-path `git add` friction or a first blocked `finish()` should reduce efficiency only, not erase a landed knowledge artifact.

## 2026-05-10 — s_1778405207348_835
- For success-candidate arc heartbeat reviews, treat a duration-gate recovery as genuinely substantive when the agent moves from surface metric scanning to implementation-vs-spec diagnosis, verifies it against live DB/event samples, and commits a reusable knowledge entry. Minor tool friction (for example assuming `rg`) is an efficiency nick, not a quality failure, when the landed artifact materially sharpens future triage.

## 2026-05-10 — s_1778409019793_881
- In artifact-gate aftermath reviews, verify that the committed deliverable lives under the same agent namespace as the runtime `sessions.agent` record. A session can have a real commit and readable artifact yet still need triage if it satisfied the gate by writing another agent's workspace file.

## 2026-05-10 — s_1778408835466_878
- In artifact-gate success-candidate reviews, keep quality credit when the agent recovers by writing a meaningful, evidence-backed note in its own workspace and committing only that file. Downgrade efficiency for schema-guess retries and hygiene loops, but do not treat a final `partial` caused by ambient unrelated worktree dirt as empty output.

## 2026-05-10 — s_1778408748359_875
- For success-candidate heartbeat reviews, credit a process-correction session as real value when the agent directly addresses a prior aftermath/review request with a committed, evidence-backed per-signal disposition artifact. The lack of a new KE/project is acceptable if the session closes the specific behavioral gap, but finish/commit retry loops should still reduce efficiency.

## 2026-05-10 — s_1778417468380_979
- In XHS scout aftermath reviews, treat `xhs-browse.mjs search` output as only partial evidence. If `read <id>` results fall back to generic explore/landing-page content or unrelated posts, keep credit for the lightweight trend synthesis and committed artifacts, but cap output-quality confidence because the post-level claims were not fully verified.
