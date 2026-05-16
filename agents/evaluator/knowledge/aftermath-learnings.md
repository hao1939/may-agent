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

## 2026-05-10 — s_1778422912399_1043
- In scout success-candidate reviews, credit a creative heartbeat as real value when the agent converts scattered source findings into a new shared abstraction with a concrete local implication, even if finish hygiene needed one retry. Recovered ignored-path `git add` friction and a first blocked `finish(success)` should reduce efficiency, not erase quality, when the committed KE and digest diff show substantive synthesis.

## 2026-05-11 — s_1778507996409_211
- When a persistent-task iteration inherits already-landed deliverables and an external blocker prevents core completion, a small consolidation artifact can still be real value if it accurately inventories the committed outputs, states the live blocker, and gives explicit next steps. Score any finish-path retry separately as an efficiency loss, not as an output-quality failure.

## 2026-05-11 — s_1778508075199_215
- In metric-alert success-candidate reviews, keep quality credit for a `document_exception` session when it refreshes live counts/classification, records concrete resume conditions, and commits the decision in the canonical project file. If the file already has nearby same-alert entries, note the duplication as an output-quality limitation rather than treating the session as empty.

## 2026-05-11 — s_1778523977812_429
- For repeated metric-alert triage on the same alert, check recent `metric.alert_judged` events before giving strong material-output credit. A fresh event plus live revalidation can still be real value, but when another identical judgment landed minutes earlier the session is best framed as low-delta maintenance rather than a major new advance.

## 2026-05-11 — s_1778511595334_259
- When a persistent-task iteration inherits already-complete primary deliverables and an external blocker still prevents the headline success condition, credit a focused support artifact if it is grounded in the observed failure, committed under the project outputs, added to the project index, and read back after write/edit. A recovered finish-path mistake such as wrong deliverable path format should lower efficiency only.

## 2026-05-11 — s_1778523668727_426
- A scout arXiv sweep can fully satisfy the source-side research constraints (HTTPS `export.arxiv.org` query, `sortOrder=descending`, abstract inspection, readable KEs) and still require aftermath repair if it updates the rolling `scout/workspace/digest/today.md` with a whole-file `write()`. For scout digest sessions, compare the parent-vs-commit diff for net deletions; if the only defect is destructive replacement, a low-risk repair is to restore the parent digest body and append the new session entries.

## 2026-05-12 — s_1778562089031_767
- For remote-devbox investigation sessions, treat initial `PATH_HALLUCINATION` failures on `bash ssh ... /home/...` as efficiency loss only when the agent quickly pivots to the remote-execution tool, gets verbatim evidence from the remote host, and lands a focused blocker/status artifact. Judge the committed artifact and live findings, not the first local-shell misfire.

## 2026-05-12 — s_1778578479477_4
- In classifier/guard-repair aftermath reviews, do not downgrade a session to low-value just because it finishes `partial` after committing. If the transcript shows bug reproduction, the commit lands a scoped fix plus regression test, and the remaining blocker is unrelated ambient worktree dirt that the agent correctly refuses to commit, keep strong quality credit and mark only the closeout friction as efficiency loss.

## 2026-05-12 — s_1778587481691_3
- For arc coherence-audit heartbeats, give strong quality credit when the agent verifies a design-vs-runtime mismatch against live registry/data, updates the stale design doc in-lane, and queues the remaining implementation choice as a proposal. A quick recovery from missing-`rg` friction or a first blocked `finish(success)` due to missing read-back should reduce efficiency only, not erase the value of the landed KE/design correction.

## 2026-05-12 — s_1778581737427_12
- For persistent-task investigation sessions, give strong quality credit when the agent isolates the active blocker with a narrower validation run, proves a later stage of the workflow works in practice, and lands reusable project documentation. A first `finish(success)` failure from wrong deliverable-path format should reduce efficiency only; it should not erase the value of a committed, evidence-backed run report and setup update.

## 2026-05-12 — s_1778600083313_76
- In scout success-candidate aftermath reviews, do not infer material output from the current contents of `scout/workspace/digest/today.md` or same-day KE files alone. First check the session transcript and `session_digests.files_modified`: a deliberate-decline session can be correctly judged as useful restraint while having no artifact writes, and rolling digest/KE HEAD state may belong to earlier sessions.

## 2026-05-13 — s_1778648112424_47
- For project-driver success-candidate reviews, give strong credit when the session resolves a prior source-of-truth mismatch by checking the produced artifact against the real tracked handler/cron files, a runnable smoke test, and live DB metrics, then moves the project to `pending-review`/`WAITING` with explicit reopen conditions. Path-mismatch or partial-read anomalies in earlier review context should be treated as hypotheses to re-check against actual files, not as disproof once the tracked source and runtime state verify cleanly.

## 2026-05-14 — s_1778771966310_131
- In success-candidate aftermath reviews, verify `session_digests.files_modified` and transcript tool calls before trusting a "knowledge update" route signal. A scout restraint session can read a rolling digest that already contains prior syntheses, making HEAD content look like fresh output even when the session performed no `write`/`edit` and landed no new artifact.

## 2026-05-14 — s_1778791768331_224
- In scout heartbeat aftermath reviews, separate operationally sound restraint from lane-fit success: a bounded saturation check can be the right session choice, but if transcript evidence shows only `read` + listing existing KEs and `session_digests.files_modified = []`, it should not be credited as a material knowledge-update success. Rolling `digest/today.md` content is especially prone to false-positive routing because it already carries earlier same-day outputs.

## 2026-05-15 — s_1778896437235_260
- For success-candidate heartbeat aftermath reviews, confirm material-output routing against transcript write/edit calls, commits, or landed artifacts before crediting durable output. A clean no-change heartbeat that only performs bounded health checks and coherence review can be a valid maintenance success, but it should be labeled as maintenance rather than a project/knowledge artifact win.

## 2026-05-15 — s_1778898198102_270
- In closed-loop steward aftermath reviews, do not treat a still-breaching alert as effectively closed just because a prior triage plausibly fixed the root cause. If the alert is still red, require one of: fresh validation evidence, a documented valid exception, a routed/nudged owner action, or a concrete blocker/data gap. Predicted auto-recovery alone is not closure progress.
