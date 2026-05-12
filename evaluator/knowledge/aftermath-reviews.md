# Aftermath reviews — evaluator patterns

## Pattern: schema guessing causes avoidable query errors
- Symptom: querying `events.type` (or other guessed columns) fails; session then uses PRAGMA to discover real schema.
- Fix: if table is unfamiliar, run `PRAGMA table_info(<table>)` first.

## Pattern: aggregate root-cause claims need direct corroboration, not just ambient repo state
- Symptom: a session analyzes broad metric regressions and correctly spots a likely culprit (for example shared dirty worktree friction), but it supports the causal claim only with current ambient `git status` plus issue counts, without directly tying the affected session cohort to that ambient condition.
- Fix: credit the analysis for surfacing a plausible high-value lever, but note the evidence gap. For strong-quality credit, require one more check that links the aggregate issue to representative sessions (for example sampled transcripts, guarded finish outputs, or commit/status evidence from the affected agent over the same window).

## Pattern: runtime session rows can understate actual work
- Symptom: the `sessions` row makes a run look like low-value waste (`opCount` 1-2, very short duration), but `.state/sessions/history/<id>/meta.json`, `session.jsonl`, `session_digests`, or landed commits show longer execution and real deliverables.
- Fix: before accepting a waste/no-op classification, cross-check the history directory plus any committed artifacts. Treat DB session rows as hints, not ground truth, when they conflict with transcript/meta evidence.

## Pattern: finish blocked by uncommitted agent repo changes
- Symptom: `finish()` guard blocks with `uncommitted changes` and lists modified files.
- Fix: check `git status` in /app/agents early; commit small, descriptive changes before calling `finish()`.

## Pattern: guard pressure can trigger wrong-scope commits in stewardship sessions
- Symptom: a coordination/triage session correctly determines it should make no repo edits, hits a `finish()` block on an ambient dirty file, explicitly notes the file is unrelated, then commits it anyway because the guard suggests a commit command.
- Fix: score the operational diagnosis separately from the hygiene recovery. If the file was not created/edited/owned by the current task, the correct outcome is `partial`/`blocked` with the exact path and owner, not an opportunistic commit just to satisfy closeout.

## Pattern: tool/agent confusion in messaging
- Symptom: agents attempt to send messages to an invalid recipient like `functions.message` (confusing tool name with agent name).
- Fix: clarify in prompts/docs that `message` is a tool and `to` must be an agent handle (e.g. `may`, `dev`, `arc`).

## Pattern: success-candidate evidence should favor actual artifacts over transcript anomalies
- Symptom: a transcript snippet suggests a missing file or path mismatch, but the produced artifact, tracked source file, test, and runtime DB evidence all confirm the deliverable exists.
- Fix: for success-candidate aftermath reviews, inspect the actual artifact and current tracked files before downgrading the session based on one anomalous tool result. Use transcript anomalies as cautions to note, not as sole grounds to reject a verified outcome.

## Pattern: blocked finishes can be mislabeled as interrupted while still shipping real output
- Symptom: a worker session calls `finish(status="blocked")`, the `sessions` row later shows `status/outcome=interrupted`, or the finish tool prints a deliverable as `MISSING`, but the transcript plus landed commit prove the artifact was written, read back, and committed.
- Fix: before classifying these sessions as failed/no-output aftermaths, check the actual committed artifact and the session transcript's write/read/commit sequence. Credit the shipped investigation/report/output, then note the runtime bookkeeping/display mismatch as the true follow-up item.

## Pattern: rolling workspace artifacts can be overwritten after the reviewed session
- Symptom: a session updates a workspace file such as `workspace/digest/today.md`, but by review time the current file contents no longer match the session because a later run replaced the rolling digest.
- Fix: verify the session's contribution from the landed commit/diff for that session, not only from the current workspace file state. Treat current file drift as expected for rolling artifacts and judge output quality from the committed change plus any read-back captured during the session.

## Pattern: rolling digest commits can batch multiple entries and blur attribution
- Symptom: a session appends one new digest item, but the landed commit also includes earlier uncommitted digest additions from the same rolling file, making the full diff look larger than the session's own fresh contribution.
- Fix: attribute the digest value from the clearly evidenced new section plus transcript timing, not from the whole file-level insertion count. Keep full credit for any separately landed durable artifact (for example a new KE), but cap digest-specific credit when one commit sweeps multiple pending entries.

## Pattern: proposal-ledger updates can be real material output
- Symptom: a success-candidate session edits an existing proposal instead of creating a new KE/file, so the output can look lightweight or purely administrative at first glance.
- Fix: inspect whether the proposal diff adds new recurrence evidence, narrows the implementation surface, or honors a prior falsifier/noise-reduction rule. If the edit materially sharpens the active proposal with fresh evidence, credit it as real value rather than dismissing it as "only a proposal update."
- Review cue: give extra credit when the session avoids spawning another doc-only KE because an earlier falsifier explicitly said to fold later recurrences into the open proposal. That is disciplined noise reduction, not missing output.

## Pattern: shell-appended digest updates can accidentally commit truncation
- Symptom: a session intends to append one digest entry, but the landed commit shows large deletions in the rolling digest because the agent used shell append/redirection, skipped an immediate read-back of the digest, then force-added the ignored workspace path.
- Fix: for digest/workspace artifacts, compare the session commit against the parent blob and check whether the change is truly append-only. If the diff shows broad deletions, treat it as a real output-quality problem even when the session also produced a valid new knowledge entry. Encourage agents to read the exact final digest before any `git add -f`.

## Pattern: analysis artifacts can go stale if they skip live DB verification
- Symptom: a session produces a useful calibration/report artifact, but it relies only on file reads and repeats outdated status claims (`retired`, old coverage values) that runtime DB queries would have corrected.
- Fix: when an artifact makes claims about metric status or current values, verify those claims against `metrics` and, if timing matters, `metric_snapshots` before crediting the analysis as fully accurate. Keep the strategic value if rankings/mappings still hold, but note the stale-status root cause.

## Pattern: copied example timestamps can silently invalidate “live” DB triage
- Symptom: an agent copies literal epoch values from a prompt/example into `query_db`, so a supposed “last 6h” or “current running sessions” query actually scans an old window and yields impossible results like negative ages.
- Fix: treat hardcoded time literals in operational queries as a review smell. When the session goal is live triage, require evidence that the time window was computed at runtime or at least sanity-check the returned ages/counts before crediting the conclusions.

## Pattern: omitted WHERE can relabel all-time rollups as a time-window snapshot
- Symptom: a session publishes a table labeled “last 6h” or similar, but the numbers match all-time totals exactly because the aggregate query dropped the time predicate and only kept `GROUP BY agent`.
- Fix: when reviewing operational rollups, compare the claimed windowed counts against a direct bounded query and, if needed, against all-time totals. If the “windowed” numbers match all-time totals, treat the conclusion as fabricated-by-query, not a minor arithmetic slip.

## Pattern: global TOP-N grouped results can be misread as exhaustive per-agent distributions
- Symptom: a session runs `GROUP BY agent, reason ORDER BY count DESC LIMIT N`, gets only the largest `(agent, reason)` buckets, then wrongly concludes each shown bucket represents 100% of that agent's sessions.
- Fix: when a claim is about an individual agent's full distribution, rerun a direct per-agent breakdown (`WHERE agent=... GROUP BY reason`) or remove the global `LIMIT`. Never infer "all sessions" from a leaderboard-style grouped query.

## Pattern: partial file reads can create fake “missing config” mismatches
- Symptom: an agent reads only the top of a long config file, does not see the relevant entry, and concludes a cron/job/handler is missing even though `grep` or a later offset read shows it exists.
- Fix: when checking for the presence of a config entry in a long file, use `grep -n` first, then read the matching region by offset before making an absence claim.

## Pattern: path-prefix confusion can fake source-of-truth mismatches
- Symptom: a transcript or artifact references `agents/may/...` while the actual tracked file lives at `may/...` within the agents repo, leading reviewers to infer the handler/config is missing.
- Fix: confirm the active repo root and normalize path prefixes before treating ENOENT as evidence of a missing implementation. Re-check with the repo-relative path actually used by tracked files.

## Pattern: guard read-back checks can be path-string sensitive even when the file is the same
- Symptom: a session really does read the edited file back, but `finish()` still rejects success until the agent repeats `read()` using the exact absolute/relative path form associated with the prior write/edit call.
- Fix: when reviewing these sessions, verify the landed artifact and final successful read-back before downgrading the outcome. As operator guidance, after `write()`/`edit()`, prefer re-reading with the exact same path string used in the mutating call (or the canonical absolute path if the first call used one) to avoid avoidable guard churn.

## Pattern: stewardship sessions can deliver value through routing, not file edits
- Symptom: a success-candidate closed-loop or triage session has no file diff, but it relays a dropped escalation or routes a blocked issue to the real owner.
- Fix: judge the operational effect directly from transcript tool results (for example a `message()` result showing delivery queued), then separately verify any referenced artifacts actually exist before crediting the session's relay as substantive.

## Pattern: stale continuation prompts can turn prior deliverables into false current-session credit
- Symptom: a project iteration prompt asks for concrete artifacts that were already produced in earlier commits, and the session simply observes those existing files/commits then finishes `success` as if it delivered them.
- Fix: separate project state from session contribution. Credit the underlying artifacts only to the sessions that created or verified them. For the reviewed session, require either fresh verification/action (for example read the actual artifacts, update plan state, send a routing message) or classify it as a no-op/partial rather than a material success.

## Pattern: cited knowledge is not a knowledge update
- Symptom: routing labels a session as a `knowledge update`, but the transcript only reads an existing KE/article and then calls `finish()` with no written deliverables.
- Fix: verify authorship and actual file changes before crediting material output. Reading a pre-existing knowledge file can justify a diagnosis, but it is not itself a new artifact or knowledge update.

## Pattern: routing signals should key off write/edit evidence, not prose path mentions
- Symptom: a route classifier marks a session as `success_candidate` with signals like `knowledge update` because the transcript text merely mentions a path under `agents/.../knowledge/`, even though the session only cited or read an existing KE.
- Fix: inspect the routing heuristic itself and prefer anchors tied to `write`/`edit` tool-call payloads or committed diffs. Path-shape regexes over free-form transcript prose are too broad and create false-good aftermath reviews.

## Pattern: heartbeat routing can inherit stale "material output" signals from prompt/history context
- Symptom: a heartbeat/session-review route arrives as `success_candidate` because the prompt or pending-event context mentions an earlier commit, project artifact, or verification command, but the reviewed session itself only performs live checks and finishes `partial`/`done` with no new writes.
- Fix: separate prior-session context from current-session contribution. For aftermath review, require current-session `write`/`edit`/commit evidence or a durable operational action in the reviewed session before calling it material output; otherwise grade it as lightweight maintenance/false-good routing.

## Pattern: classifier-bug aftermath sessions create value when they land durable follow-up artifacts
- Symptom: a reviewed session spends much of its effort proving that a router/guard/classifier made the wrong call, so the work can look meta or circular if the reviewer checks only whether the original route was false.
- Fix: inspect whether the session verified the real classifier source, connected the incident to prior evidence, and converted the diagnosis into durable follow-up artifacts such as a KE, proposal, queue entry, or implementation request. If those artifacts land and are actionable, credit the session as real system improvement even when part of the transcript is spent on guard/finish recovery.

## Pattern: apparent knowledge updates can be net-destructive if they overwrite existing KEs
- Symptom: a research session lands a real commit and read-back evidence for new `KE-xxx.md` files, but the committed diff shows those paths already existed and the session replaced canonical knowledge entries with unrelated content.
- Fix: for claimed knowledge updates, inspect the parent-vs-commit diff (or prior blob) for each KE path, not just the final file contents. If the path pre-existed, verify the change is an intentional revision rather than an ID collision/overwrite. Credit any safe side artifact like a digest append separately, but downgrade the session overall and escalate restoration to the owner.

## Pattern: pre-existing mock research is not fresh exploration
- Symptom: a session tasked with exploring an external source (for example XHS) only reads local mock scripts or prewritten workspace summaries, then finishes as if fresh research was performed.
- Fix: inspect the transcript for real external collection or newly written source notes, and check mtimes/diffs on cited artifacts. If the session only consumed pre-existing mock/local material, credit it as lightweight synthesis at most, not as source exploration or a knowledge update.

## Pattern: adjacent synthesis KEs can be duplicate-shaped even when the wording is new
- Symptom: a research heartbeat creates a fresh KE and digest entry, but the new artifact mostly recombines points already captured in a nearby KE (for example an existing SLM-architecture note) plus the rolling digest, with only one added angle such as sandboxing/locality.
- Fix: before crediting the session as a strong knowledge update, compare the new KE against existing same-day entries and the cited digest context. If the novelty is only an incremental framing change, score it as lightweight synthesis/acceptable output rather than a high-value new knowledge artifact, and note the missed duplicate check.

## Pattern: adjacent-KE synthesis can still be real value when it names a distinct failure mode
- Symptom: a research heartbeat mainly synthesizes several just-created local KEs, so it can look like repackaging rather than fresh work.
- Fix: check whether the new KE contributes a clearly distinct concept name, a non-trivial causal link across the prior entries, and concrete system implications that were not already stated in the source KEs. If those are present, credit it as substantive synthesis even without same-session external fetching; penalize only hygiene friction such as late commit/read-back recovery.

## Pattern: same paper can be re-added under a new KE id without an actual id collision
- Symptom: a research session ships a clean new file path like `KE-010-...md`, but the paper/source already exists under another KE id (for example `KE-002-...md`). The transcript claims a new KB addition even though the net result is duplicate knowledge rather than fresh exploration.
- Fix: when a session claims a new paper finding, search existing `shared/knowledge/entries/` by title or source URL, not just by target KE id. Credit any digest summary that really landed, but downgrade the KB value when the "new" entry duplicates an existing paper under a different id.

## Pattern: bypassing the KE id helper can create out-of-sequence knowledge entries
- Symptom: a scout session manually scans `shared/knowledge/entries` (for example `ls ... | grep ... | tail -n 1`) instead of running `bash agents/scout/tools/next-ke-id.sh`, then writes a new KE with a much lower id than the real current max.
- Fix: treat the helper as mandatory shared infrastructure, because it already handles the current filename conventions. In aftermath review, check the transcript for helper usage and compare the chosen id against the helper's current output. Downgrade sessions that land real content under a stale/out-of-sequence id, because they make the KB harder to navigate and increase duplicate-check risk.

## Pattern: metric-alert dismissal can collapse into artifact-gate compliance
- Symptom: a heartbeat reads an existing metric-analysis KE, writes a one-line workspace note like "dismissing per KE-...", and finishes without fresh metric checks, follow-through, or any substantive downstream work.
- Fix: when reviewing alert-handling sessions, separate the diagnosis from the session's own contribution. Credit the reused KE for the diagnosis, but require fresh evidence or a real operational action before treating the session itself as materially successful.

## Pattern: prior KE context is not enough for a complete metric-alert judgment
- Symptom: a session cites a relevant prior KE and may even reach the right general conclusion, but it never checks the live metric row, recent snapshots, or related events, and it does not record a concrete final operation from the metric-alert manual.
- Fix: treat prior KEs as context, not closure. For a good metric-triage outcome, require current evidence from `metrics` plus `metric_snapshots` (and related events when relevant), then look for an explicit operation such as downgrade, exception, resolve stale state, or escalation.

## Pattern: metric-alert triage can deliver value via durable judgment events, not file edits
- Symptom: a metric-alert session makes no repository changes, so it can look insubstantial if review only checks for file diffs.
- Fix: verify whether the workflow emitted a durable `metric.alert_judged` event with a concrete final operation plus evidence, and confirm the cited live metric/project state. Credit the session when that event records the owner judgment and advances the closure chain, even if the supporting project artifact was pre-existing.

## Pattern: repeated `waiting_with_evidence` appends can be real maintenance but weak material output
- Symptom: a metric-alert triage session re-runs the live checks correctly, but the only shipped change is another project-journal entry restating the same historical row and same wait condition that were already documented minutes earlier.
- Fix: separate operational soundness from output materiality. Credit the fresh DB validation and correct hold judgment, but downgrade from strong `good`/material-output language when the artifact adds little delta, especially if the canonical project status/resume fields remain unchanged or inconsistent with the newest evidence.

## Pattern: repeated `document_exception` re-logs can be correct but low-delta output
- Symptom: a metric-alert triage session rechecks the live raw-vs-strict evidence and then appends another `document_exception` paragraph with essentially the same rationale and resume trigger already documented earlier that day.
- Fix: credit the live validation and correct exception judgment, but treat the session as maintenance-level output unless it changes the canonical exception state, updates the project status/resume fields, or adds materially new classification/source evidence.

## Pattern: partial metric-alert triage can miss the durable judgment event
- Symptom: a metric-alert workflow does the live checks and even lands a supporting artifact/commit, but the session ends `partial` because of unrelated worktree dirt, and no fresh `metric.alert_judged` event appears afterward.
- Fix: review the operational judgment and artifact separately from closure completeness. Credit the live analysis and durable note if they are real, but mark the session incomplete for alert-lifecycle purposes when the workflow never records the judgment event that downstream closure tracking expects.

## Pattern: back-to-back metric-alert sessions can duplicate a just-landed judgment
- Symptom: a follow-up heartbeat re-runs the same metric checks and lands a tiny supporting commit, but a fresh `metric.alert_judged` event for the same `metricId`/`alertId` already exists from another session minutes earlier, so the second session adds little beyond wording drift.
- Fix: before crediting strong material output, query recent `metric.alert_judged` events for the same alert. If the current evidence was already durably recorded, score the later session as low-delta maintenance unless it resolves a new discrepancy or advances the alert lifecycle.

## Pattern: metric-alert triage can still be good when `partial` closeout follows a durable judgment
- Symptom: a metric-alert workflow ends `partial` because unrelated ambient dirt keeps the repo worktree non-clean, but the session already committed its evidence artifact and emitted a fresh `metric.alert_judged` event with a concrete final operation.
- Fix: score the analytical/operational result from the durable evidence chain, not the terminal status alone. If the live metric checks are sound, the shipped artifact is real, and the judgment event landed, treat the session as successful alert handling with a hygiene caveat rather than as an incomplete triage.

## Pattern: paired raw-vs-strict metrics can justify a strong `waiting_with_evidence` outcome
- Symptom: a metric-alert triage session leaves the raw alert open, which can look like non-action if review checks only whether the threshold is still breached.
- Fix: inspect whether the session compared the noisy/raw metric against a stricter companion metric, then classified the current breached population into repaired, terminal, and unresolved buckets. If the session also records a durable `metric.alert_judged` event and ships an evidence artifact or commit, credit it as real value even when the chosen operation is still `waiting_with_evidence`.

## Pattern: metric-alert calibration can still be a good outcome even after transient wrong-tool attempts
- Symptom: a triage session first tries to mutate runtime state with the wrong mechanism (for example `query_db` UPDATE or `sqlite3` from bash), then pivots to the documented `bun:sqlite` update and lands the calibration safely.
- Fix: judge the session from the recovered end state, not only the false starts. Keep an efficiency penalty for the avoidable wrong-tool calls, but if live DB reads show the metric definition changed as intended and the alert row was resolved with corroborating evidence, credit the session as real value rather than marking it as a failure.

## Pattern: empty-signal heartbeats can be real work even with no file output
- Symptom: a heartbeat session ships no file diff, commit, or message, but it explicitly verifies empty inbox/owned-signal state, checks recent session context, and consciously avoids producing filler artifacts that a guard would otherwise incentivize.
- Fix: do not force-fit these into `knowledge update` or `ghost deliverable` narratives. Judge them as lightweight operational maintenance: credit the no-op decision when transcript evidence shows the agent checked the relevant signals and avoided log-padding, while still penalizing any guard-churn retries as efficiency loss.

## Pattern: source commit is not enough for metric calibration if live runtime state disagrees
- Symptom: a metric-alert triage commits the threshold change in source and may even print a successful direct DB write from bash, but `query_db` still shows the live metric row at the old threshold afterward.
- Fix: treat this as incomplete calibration, not a full success. For alert-triage reviews, always verify the runtime `metrics` row with `query_db` in addition to the committed source diff, and flag direct shell writes against guessed DB paths as unsafe evidence unless the live row confirms the change.

## Pattern: short-interval follow-up reviews can still add value through delta tracking
- Symptom: a follow-up review happens minutes after a fuller report, so there is little new raw data and the session risks repeating prior analysis.
- Fix: if the underlying evidence is still fresh, verify the live state, then produce a compact status tracker that answers "what changed / what remains unacted on" instead of redoing the whole review. Credit sessions that transform prior findings into explicit recommendation-tracking with current unresolved items.

## Pattern: no-action worker tasks can collapse into compliance-only status reports
- Symptom: a worker session with "no actionable work" writes a short status note that mostly restates the orchestrator prompt or project blocker, sometimes with stale template residue like an incorrect generated date.
- Fix: credit the session only for the narrow value it actually delivered: an auditable receipt that the blocked/no-action state was recorded. Downgrade output quality if there is no fresh metric/project verification, and note the workflow incentive that pushed the agent toward artifact compliance over substantive progress.

## Pattern: duplicate helper-script commits can look stronger than they are
- Symptom: a blocked session writes a fresh shell helper and lands a clean commit, but the new script largely merges logic already present in nearby project scripts/runbooks and adds guessed environment constants (for example KV hostnames) without validating them against repo/runtime evidence.
- Fix: in success-candidate aftermath review, compare the new helper against adjacent artifacts before giving strong credit. Treat the commit as only moderate value unless it closes a real workflow gap or validates the environment-specific parameters it introduces.

## Pattern: evidence-backed no-op heartbeats can still deliver operational value
- Symptom: a heartbeat makes no repo edits or new artifacts, but it runs live checks that confirm a previously observed incident has actually stayed recovered and that apparent hygiene dirt is ambient rather than the agent's responsibility.
- Fix: do not require file output as the only signal of value. Verify the fresh DB/query evidence and lane-aware judgment directly from the transcript and current repo state; credit the session as acceptable/good operational maintenance when it prevents unnecessary churn, while still noting that it is not a material knowledge update or code change.

## Pattern: heartbeat review-request triage can be substantive output even when the fix predates the session
- Symptom: a low-signal heartbeat picks up a pending review request about a suspected bug, and the actual implementation fix was already landed by an earlier session. The current session can look like "just confirming old work" if review checks only whether new code changed.
- Fix: inspect whether the heartbeat turned the request into a durable disposition by verifying the reviewed artifact, the landed source/test diff, current test results, and a committed follow-up note or reopen trigger. Credit that as real value when it closes inbox noise with evidence rather than spawning duplicate work.

## Pattern: recap-heavy success candidates can be operationally sound but not material-output sessions
- Symptom: routing labels a session as a `success_candidate` with signals like `knowledge update` because the heartbeat discusses or re-checks a recently created KE/proposal, but transcript/tool evidence shows the reviewed session only verified that the prior artifact already exists and wisely produced no duplicate write.
- Fix: inspect artifact authorship/timing, not just artifact mentions. If the current session only confirms prior work and does fresh live triage, score it as acceptable/good maintenance rather than a fresh knowledge-producing success; separately note the routing false-positive so heuristics can key on write/edit or new-commit evidence.

## Pattern: material-output routing can be false even when the no-op heartbeat is good
- Symptom: routing says `knowledge update` or other material-output language, but the transcript shows only live checks (inbox, metrics, events, git status) and the session explicitly decides there is nothing new to write.
- Fix: separate session quality from output materiality. Credit the evidence-backed no-op as operational maintenance if the checks are relevant and lane-aware, but overturn the material-output framing unless there is an actual written artifact, diff, message, or durable state change from the reviewed session.

## Pattern: claimed escalation in prose is not an actual escalation
- Symptom: a session summary or heartbeat log says a blocker was "escalated to human" or similar, but the transcript shows no `message()` call, no project update, and no other durable state change that actually performed the escalation.
- Fix: verify the operational action from tool evidence, not prose. Credit the underlying diagnosis if it is supported by live checks, but downgrade output quality when the session only documents intended escalation instead of performing one.

## Pattern: heartbeat-to-project escalation can be substantive output
- Symptom: a heartbeat does not ship code, but it uses fresh runtime evidence to identify a repeated cross-workflow problem with no active owner and turns it into a new shared project with baselines, validation queries, and a concrete next intervention.
- Fix: inspect the created project artifact and commit rather than downgrading the session as mere maintenance. Credit it as good material output when the project is properly scoped, grounded in live evidence, and creates a durable ownership/validation path for follow-through.

## Pattern: local failure pattern upgraded to shared lever is substantive output
- Symptom: a self-maintenance session starts from one agent's recurring mistake, then checks live cross-agent evidence, verifies the same failure cluster elsewhere, and converts the finding into a shared knowledge entry plus reprioritized proposal/work-queue movement.
- Fix: judge the landed shared artifact and queue movement directly. If the session quantified the broader pattern, inspected real artifacts from multiple agents, and strengthened a system-level intervention, score it as real value rather than dismissing it as merely "another heartbeat note."

## Pattern: artifact-gated recovery sessions can still produce substantive value
- Symptom: a session starts from a low-bar prompt like "produce any artifact," which makes the resulting write look like mere compliance at first glance.
- Fix: inspect the actual artifact and source evidence before judging. If the agent used live sources and turned the forced write into a concrete, system-relevant analysis, credit the substantive output while separately noting any scoping or verification hiccups (for example writing into another agent's workspace or missing the first read-back).
- Extra caution: verify that the recovery artifact is both **tracked/committable** and **in-lane** before treating it as the session's real output. A workspace write can satisfy the local gate yet fail to ship if the path is gitignored, and a write into another agent's workspace can look readable while still violating ownership/lane rules. If the agent catches that quickly and pivots to a tracked in-lane file, score the pivot as recovery rather than as a failed outcome; if it does not, treat the artifact as structurally invalid even when the content itself is useful.

## Pattern: duration-gate warning does not negate a strong outcome when the agent pivots into mechanism-level analysis
- Symptom: a session begins under a "too short / dig deeper" warning, so the routing context makes the later artifact look like forced compliance.
- Fix: judge the shipped result, not the warning banner. If the agent uses the prompt to move from surface status notes into live DB checks, code/spec comparison, and a tracked committed artifact with a real repair path, score it as genuine value. Penalize only the recoverable guard friction (for example an initial read-before-edit miss), not the entire session.

## Pattern: cross-agent tracked artifacts can be real output but still weakly scoped
- Symptom: a session under one agent label ships a committed artifact inside another agent's tracked tree (for example an `arc` session appending `may/heartbeat-log.md`).
- Fix: separate deliverable integrity from scope quality. If the commit landed and the file content is real, do not mark it as fake output; instead credit the narrow operational value and note the ownership/lane miss as an output-quality downgrade unless there is explicit cross-agent handoff authority.

## Pattern: tracked status beats `.gitignore` line-reading for workspace artifacts
- Symptom: a session or review infers that `*/workspace/*` output was unshippable just from the `.gitignore` rule text, but `git check-ignore` returns non-matching and `git ls-files` shows the file is already tracked (grandfathered), so the artifact really did land.
- Fix: when judging workspace-path validity, verify the specific file's status with `git check-ignore -v <path>` and `git ls-files -- <path>` before downgrading the output. Treat blanket `.gitignore` reasoning as weaker than file-specific tracked-status evidence.

## Pattern: shared repo-level workspace writes can hide an ownership mismatch
- Symptom: a session satisfies an artifact gate by writing to `/app/agents/workspace/...` (the repo-level shared workspace), but the content is branded as another agent's heartbeat or operating log and does not advance the current session owner's lane.
- Fix: inspect both the artifact path and the artifact identity. A real read-backed commit in shared `workspace/` still counts as shipped output, but downgrade scope/output quality when the content belongs to another agent or another lane. Judge it as partial operational value, not as a clean success for the session owner.

## Pattern: ignored workspace artifact can still count when explicitly force-added and shipped
- Symptom: a session writes a useful artifact under an ignored `workspace/` path, hits an initial `git add` failure, then force-adds the exact file and lands a clean commit containing that artifact.
- Fix: do not dismiss the output just because the first add failed or because the file lives under `workspace/`. Inspect the landed commit/diff: if the agent explicitly used `git add -f <exact path>`, committed only the intended artifact, and the reviewed content matches the diff, treat it as real shipped output. Penalize only the minor recovery overhead, not the final deliverable.

## Pattern: explicit `git add` does not prove the commit was scoped to that file
- Symptom: the transcript shows `git add <intended-path>` or even `git add -f <intended-path>`, but the landed commit also contains another staged file from a different lane/agent.
- Fix: verify the full commit contents with `git show --stat --name-only <commit>`, not just the transcript's add command. Credit the intended artifact if it is real, but downgrade hygiene/output quality when unrelated staged paths were swept into the commit or omitted from `finish()` deliverables.

## Pattern: path-specific force-add still sweeps pre-staged files into the commit
- Symptom: a session correctly force-adds an ignored deliverable path, but `git status --short` already showed unrelated staged files before the commit, so `git commit` sweeps them in anyway.
- Fix: before crediting the commit as isolated, compare transcript pre-commit status with the final `git show --stat`. If unrelated files were already staged, treat `git add -f <path>` as insufficient isolation and recommend `git restore --staged <unrelated>` or a blocked/partial finish instead of committing ambient staged work.

## Pattern: concurrent repo activity can ship a real artifact under the wrong commit identity
- Symptom: the agent edits a valid file, but its own `git commit` fails (for example on an index lock or concurrent git process) and the staged change later appears inside another agent's successful commit with an unrelated subject/author.
- Fix: inspect the landed diff and current file content first. If the artifact really shipped, keep substance credit, but downgrade hygiene because the session did not secure an isolated commit or clean closeout. Treat this as stronger than minor inefficiency when the session then relies on that unrelated commit in `finish()`.

## Pattern: raw `ls | wc -l` can fake repo-structure regressions
- Symptom: a session re-verifies a directory tree with `ls <dir> | wc -l`, sees a higher count than prior documentation, and starts editing docs as if the repo structure changed, but the extra lines are non-directory files such as `BUILD.bazel` or `owners.go`.
- Fix: when the claim is specifically about subdirectories/SIGs/packages, use a directory-only command (`find <dir> -maxdepth 1 -type d` or equivalent) before crediting a structural change. If the agent later corrects the mistake, keep the outcome credit but note the avoidable churn.

## Pattern: success-candidate sessions can create real value yet still fail delivery
- Symptom: a routed `success_candidate` session performs sound live investigation, lands or influences a real implementation/test path, and produces passing targeted verification, but the reviewed session itself never completes `finish()`, leaves part of the worktree dirty, or has its in-flight changes later swept up by another session/commit.
- Fix: separate technical value from delivery integrity. Credit the session for the real diagnosis/implementation evidence, but downgrade the overall outcome from clean success unless the reviewed session itself shipped and closed the work. Check for missing `finish()` tool calls, remaining dirty files, and whether later commits only partially captured the session's edits.

## Pattern: `git log --author` is not reliable agent attribution in the shared agents repo
- Symptom: a review or heuristic tries to verify that agent X shipped work by checking `git log --author=<agent>-agent`, but the landed commit subject/path clearly matches agent X while the author is `may-agent` or another shared identity.
- Fix: do not use git author alone to decide ownership or whether a deliverable shipped. Verify by touched paths, commit subject prefix, landed diff content, and the session's own read-back/finish evidence. In `/app/agents`, author identity can be dominated by shared commit plumbing, so content beats author for attribution.

## Pattern: a later falsifier can preserve the symptom but overturn the first session's mechanism claim
- Symptom: a success-candidate session ships a useful KE or proposal with strong empirical evidence for a real symptom, but a near-term follow-up session from the same owner explicitly fires one of the artifact's own falsifiers and shows the stated mechanism was wrong.
- Fix: review the follow-up artifact before scoring the first session as fully good. Keep credit for the durable empirical finding if it still stands, but downgrade output quality/root-cause quality when the original session overclaimed mechanism and the correction landed shortly after.

## Pattern: reused shared knowledge IDs can silently overwrite established entries
- Symptom: a research session creates `shared/knowledge/entries/KE-0xx.md` for a fresh external finding without checking whether that ID already anchors an existing canonical knowledge entry. The landed commit then replaces an established KE with unrelated content while transcript self-report still calls it a "new" KB entry.
- Fix: before crediting a KB addition, inspect the pre-change file (`git show <commit>^:path`) and search indexes/references for that KE id. If the id was already in active use, treat the session as partial value at best: preserve any rolling digest insight, but downgrade the KB output for destructive overwrite and recommend allocating a new unique KE id.

## Pattern: KE-id collisions can happen even when the filename is new
- Symptom: a session creates a seemingly fresh file like `shared/knowledge/entries/KE-022.md`, but the logical id `KE-022` is already assigned elsewhere (for example `KE-022-early-exploration-errors.md`) in `shared/knowledge/INDEX.md` and downstream references.
- Fix: verify both the target path and the logical KE id. Search `shared/knowledge/INDEX.md` and existing `entries/` filenames for the intended id before crediting a "new" KE. If the id already exists under another filename, treat the output as a numbering collision rather than a valid new KB entry.

## Pattern: shell echo can silently corrupt markdown artifacts
- Symptom: the transcript shows a plausible `echo "...\n..." >> file` append, but the landed artifact contains literal `\n` sequences on one line instead of real markdown line breaks.
- Fix: inspect the actual file content, not just the write command or the agent's summary. Credit the session only for the information that really landed, and note output-quality loss when shell-based writes produce malformed markdown or weak read-back via `cat` instead of the platform `read()` tool.

## Pattern: rolling digest append tasks can silently become destructive overwrites
- Symptom: a session says it is appending new findings to a rolling digest, but the transcript uses shell redirection like `cat <<'EOF' > file` or similar overwrite semantics. The read-back shows correct new content, yet the landed diff reveals large deletions because the prior digest body was replaced.
- Fix: for rolling digests and cumulative workspace artifacts, inspect the landed diff or compare against the pre-change file, not only the post-write read-back. Treat `>` on an existing digest as a destructive-overwrite smell unless the task explicitly called for replacement.

## Pattern: a blocked first finish does not negate a good outcome when recovery is immediate
- Symptom: a session's first `finish(success)` is rejected for missing read-back verification, which can make the whole run look low-quality if the review stops there.
- Fix: continue through the transcript. If the agent immediately performs the required read() calls, verifies the edited files, and then finishes cleanly with a real deliverable, score the outcome from the recovered end state and count the initial finish block as minor efficiency waste rather than a failed session.

## Pattern: repeated finish-block friction can be a workflow-prompt gap, not an agent-specific hygiene failure
- Symptom: many sessions from the same workflow keep hitting `finish() blocked [uncommitted changes]` or read-back guards, but sampled transcripts show the agents reliably recover once the guard spells out the exact closeout steps.
- Fix: inspect the source workflow prompt before blaming the agent. If the workflow does not tell the agent to read back files, stage exact paths, commit, and re-check status *before the first* `finish(success)`, credit sessions that patch the workflow prompt itself as a system-level fix rather than treating the friction as mere user error.

## Pattern: finish can reject repo-relative deliverables even when the committed file is real
- Symptom: a session writes and commits a file under `/app/agents/...`, then `finish(success)` fails with `Deliverables not found on disk` when the deliverable is reported as a repo-relative path like `may/workspace/heartbeat-log.md`.
- Fix: verify the artifact actually exists and inspect the landed commit/diff. If the outcome is otherwise valid, treat the first finish failure as a path-normalization hiccup and expect immediate recovery by retrying with the absolute `/app/agents/...` path. Penalize efficiency lightly, not outcome quality.

## Pattern: blocked finish rows can look interrupted even when output landed
- Symptom: a worker session calls `finish(status="blocked")`, the session table later shows `status=interrupted`/`outcome=interrupted`, and the finish tool may even print a repo-relative deliverable under `shared/projects/...` as `MISSING` despite a real write/read/commit.
- Fix: do not treat the interrupted row or `MISSING` marker as dispositive. Check the transcript for write/read/commit evidence, inspect the landed artifact and commit, and compare against current guard path-resolution logic before routing the session as lost output. Credit the session if the blocked closeout still produced a valid committed artifact and useful diagnosis.

## Pattern: failed write attempts can poison read-back guards
- Symptom: a session first calls `write()` on a wrong-base relative path like `may/workspace/...`, gets `EACCES`/`ENOENT`, then successfully writes the real file under `/app/agents/...`; later `finish(success)` keeps demanding read-back of the failed path as if it had been modified.
- Fix: inspect the transcript for the original write result before blaming the agent for missing verification. If the first write failed and no file was created, score the repeated finish blocks as workflow/guard friction, then judge the outcome from the real landed artifact and any eventual partial closeout.

## Pattern: finish-hygiene self-repair includes retrying `finish(success)` after the commit
- Symptom: a session hits `finish() blocked [uncommitted changes]`, commits the intended file, then retries `finish(success)` directly without an extra `git status`; naive heuristics may still mark it `needs_improvement`.
- Fix: judge the recovery window after the blocked finish, not just the presence of a later `git status`. A post-blocked successful terminal `finish(...)` after the commit is enough evidence of a clean self-repair unless the session later ends interrupted/error.

## Pattern: partial closeout can still be a successful builder outcome when the blocker is unrelated ambient dirt
- Symptom: a session edits code, adds tests, commits only its intended files, then ends `partial` because post-commit `git status` still shows unrelated runtime/log/project dirt owned elsewhere.
- Fix: inspect the actual commit and artifact state before downgrading. If the patch is committed, verified, and the agent correctly refused to stage unrelated files, credit the substantive outcome and treat the `partial` as a hygiene/environment blocker rather than proof the work failed.

## Pattern: internal-evidence-first synthesis can produce strong creative heartbeat output
- Symptom: a research/heartbeat session starts by reading recent internal knowledge entries and current working notes, then imports one external source and turns the overlap into a concrete architectural proposal rather than another trend summary.
- Fix: for success-candidate review, inspect the landed artifact for named components or an actionable design recommendation. When the session clearly converts prior internal findings plus one outside signal into a reusable proposal, credit it as real substantive output even if there is minor hygiene friction like an ignored-path `git add` failure or a first blocked `finish()`.

## Pattern: adjacent synthesis KEs can still be good when they add a concrete system lever
- Symptom: a new knowledge entry lands very near a same-day or same-topic KE, so it initially looks duplicate-shaped, but the newer note combines the nearby observations into a more specific recommendation for the local system.
- Fix: do a two-part judgment. First, compare against adjacent KEs to avoid over-crediting novelty. Second, inspect whether the new artifact adds a concrete lever (for example a specific architectural pivot, workflow change, or design principle for May-Agent). If yes, score it as real but incremental value: good/acceptable output depending on evidence strength, not a breakthrough and not a throwaway duplicate.

## Pattern: rolling digest replacement can coexist with a valid new knowledge artifact
- Symptom: a research heartbeat creates a genuinely useful new KE, but the same commit rewrites `workspace/digest/today.md` by deleting the prior digest body and leaving only the latest entry, often via `rm` plus shell redirection.
- Fix: split the judgment by artifact. Credit the new KE if it is substantively novel and verified, but downgrade the overall session from clean success when the rolling digest update is net-destructive. For rolling digests, inspect the parent-vs-commit diff rather than trusting post-write read-back of the new entry alone.

## Pattern: recurrence-led proposal sharpening is substantive output when it adds a cheaper implementation path
- Symptom: a heartbeat revisits an already-open proposal after another recurrence, which can look like mere bookkeeping or duplicate logging.
- Fix: inspect whether the session gathered fresh runtime evidence (for example a new `guard.triggered` row, commit diff, or real artifact) and used it to tighten the mechanism claim or implementation surface. If the update converts a repeated symptom into a lower-cost or more direct intervention path, credit it as real substantive output rather than dismissing it as another recurrence note.
