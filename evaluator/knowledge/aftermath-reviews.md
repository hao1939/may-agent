# Aftermath reviews — evaluator patterns

## Pattern: schema guessing causes avoidable query errors
- Symptom: querying `events.type` (or other guessed columns) fails; session then uses PRAGMA to discover real schema.
- Fix: if table is unfamiliar, run `PRAGMA table_info(<table>)` first.

## Pattern: aggregate root-cause claims need direct corroboration, not just ambient repo state
- Symptom: a session analyzes broad metric regressions and correctly spots a likely culprit (for example shared dirty worktree friction), but it supports the causal claim only with current ambient `git status` plus issue counts, without directly tying the affected session cohort to that ambient condition.
- Fix: credit the analysis for surfacing a plausible high-value lever, but note the evidence gap. For strong-quality credit, require one more check that links the aggregate issue to representative sessions (for example sampled transcripts, guarded finish outputs, or commit/status evidence from the affected agent over the same window).

## Pattern: finish blocked by uncommitted agent repo changes
- Symptom: `finish()` guard blocks with `uncommitted changes` and lists modified files.
- Fix: check `git status` in /app/agents early; commit small, descriptive changes before calling `finish()`.

## Pattern: tool/agent confusion in messaging
- Symptom: agents attempt to send messages to an invalid recipient like `functions.message` (confusing tool name with agent name).
- Fix: clarify in prompts/docs that `message` is a tool and `to` must be an agent handle (e.g. `may`, `dev`, `arc`).

## Pattern: success-candidate evidence should favor actual artifacts over transcript anomalies
- Symptom: a transcript snippet suggests a missing file or path mismatch, but the produced artifact, tracked source file, test, and runtime DB evidence all confirm the deliverable exists.
- Fix: for success-candidate aftermath reviews, inspect the actual artifact and current tracked files before downgrading the session based on one anomalous tool result. Use transcript anomalies as cautions to note, not as sole grounds to reject a verified outcome.

## Pattern: rolling workspace artifacts can be overwritten after the reviewed session
- Symptom: a session updates a workspace file such as `workspace/digest/today.md`, but by review time the current file contents no longer match the session because a later run replaced the rolling digest.
- Fix: verify the session's contribution from the landed commit/diff for that session, not only from the current workspace file state. Treat current file drift as expected for rolling artifacts and judge output quality from the committed change plus any read-back captured during the session.

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

## Pattern: stewardship sessions can deliver value through routing, not file edits
- Symptom: a success-candidate closed-loop or triage session has no file diff, but it relays a dropped escalation or routes a blocked issue to the real owner.
- Fix: judge the operational effect directly from transcript tool results (for example a `message()` result showing delivery queued), then separately verify any referenced artifacts actually exist before crediting the session's relay as substantive.

## Pattern: cited knowledge is not a knowledge update
- Symptom: routing labels a session as a `knowledge update`, but the transcript only reads an existing KE/article and then calls `finish()` with no written deliverables.
- Fix: verify authorship and actual file changes before crediting material output. Reading a pre-existing knowledge file can justify a diagnosis, but it is not itself a new artifact or knowledge update.

## Pattern: pre-existing mock research is not fresh exploration
- Symptom: a session tasked with exploring an external source (for example XHS) only reads local mock scripts or prewritten workspace summaries, then finishes as if fresh research was performed.
- Fix: inspect the transcript for real external collection or newly written source notes, and check mtimes/diffs on cited artifacts. If the session only consumed pre-existing mock/local material, credit it as lightweight synthesis at most, not as source exploration or a knowledge update.

## Pattern: adjacent synthesis KEs can be duplicate-shaped even when the wording is new
- Symptom: a research heartbeat creates a fresh KE and digest entry, but the new artifact mostly recombines points already captured in a nearby KE (for example an existing SLM-architecture note) plus the rolling digest, with only one added angle such as sandboxing/locality.
- Fix: before crediting the session as a strong knowledge update, compare the new KE against existing same-day entries and the cited digest context. If the novelty is only an incremental framing change, score it as lightweight synthesis/acceptable output rather than a high-value new knowledge artifact, and note the missed duplicate check.

## Pattern: metric-alert dismissal can collapse into artifact-gate compliance
- Symptom: a heartbeat reads an existing metric-analysis KE, writes a one-line workspace note like "dismissing per KE-...", and finishes without fresh metric checks, follow-through, or any substantive downstream work.
- Fix: when reviewing alert-handling sessions, separate the diagnosis from the session's own contribution. Credit the reused KE for the diagnosis, but require fresh evidence or a real operational action before treating the session itself as materially successful.

## Pattern: prior KE context is not enough for a complete metric-alert judgment
- Symptom: a session cites a relevant prior KE and may even reach the right general conclusion, but it never checks the live metric row, recent snapshots, or related events, and it does not record a concrete final operation from the metric-alert manual.
- Fix: treat prior KEs as context, not closure. For a good metric-triage outcome, require current evidence from `metrics` plus `metric_snapshots` (and related events when relevant), then look for an explicit operation such as downgrade, exception, resolve stale state, or escalation.

## Pattern: metric-alert triage can deliver value via durable judgment events, not file edits
- Symptom: a metric-alert session makes no repository changes, so it can look insubstantial if review only checks for file diffs.
- Fix: verify whether the workflow emitted a durable `metric.alert_judged` event with a concrete final operation plus evidence, and confirm the cited live metric/project state. Credit the session when that event records the owner judgment and advances the closure chain, even if the supporting project artifact was pre-existing.

## Pattern: short-interval follow-up reviews can still add value through delta tracking
- Symptom: a follow-up review happens minutes after a fuller report, so there is little new raw data and the session risks repeating prior analysis.
- Fix: if the underlying evidence is still fresh, verify the live state, then produce a compact status tracker that answers "what changed / what remains unacted on" instead of redoing the whole review. Credit sessions that transform prior findings into explicit recommendation-tracking with current unresolved items.

## Pattern: no-action worker tasks can collapse into compliance-only status reports
- Symptom: a worker session with "no actionable work" writes a short status note that mostly restates the orchestrator prompt or project blocker, sometimes with stale template residue like an incorrect generated date.
- Fix: credit the session only for the narrow value it actually delivered: an auditable receipt that the blocked/no-action state was recorded. Downgrade output quality if there is no fresh metric/project verification, and note the workflow incentive that pushed the agent toward artifact compliance over substantive progress.

## Pattern: evidence-backed no-op heartbeats can still deliver operational value
- Symptom: a heartbeat makes no repo edits or new artifacts, but it runs live checks that confirm a previously observed incident has actually stayed recovered and that apparent hygiene dirt is ambient rather than the agent's responsibility.
- Fix: do not require file output as the only signal of value. Verify the fresh DB/query evidence and lane-aware judgment directly from the transcript and current repo state; credit the session as acceptable/good operational maintenance when it prevents unnecessary churn, while still noting that it is not a material knowledge update or code change.

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

## Pattern: cross-agent tracked artifacts can be real output but still weakly scoped
- Symptom: a session under one agent label ships a committed artifact inside another agent's tracked tree (for example an `arc` session appending `may/heartbeat-log.md`).
- Fix: separate deliverable integrity from scope quality. If the commit landed and the file content is real, do not mark it as fake output; instead credit the narrow operational value and note the ownership/lane miss as an output-quality downgrade unless there is explicit cross-agent handoff authority.

## Pattern: ignored workspace artifact can still count when explicitly force-added and shipped
- Symptom: a session writes a useful artifact under an ignored `workspace/` path, hits an initial `git add` failure, then force-adds the exact file and lands a clean commit containing that artifact.
- Fix: do not dismiss the output just because the first add failed or because the file lives under `workspace/`. Inspect the landed commit/diff: if the agent explicitly used `git add -f <exact path>`, committed only the intended artifact, and the reviewed content matches the diff, treat it as real shipped output. Penalize only the minor recovery overhead, not the final deliverable.

## Pattern: explicit `git add` does not prove the commit was scoped to that file
- Symptom: the transcript shows `git add <intended-path>` or even `git add -f <intended-path>`, but the landed commit also contains another staged file from a different lane/agent.
- Fix: verify the full commit contents with `git show --stat --name-only <commit>`, not just the transcript's add command. Credit the intended artifact if it is real, but downgrade hygiene/output quality when unrelated staged paths were swept into the commit or omitted from `finish()` deliverables.

## Pattern: shell echo can silently corrupt markdown artifacts
- Symptom: the transcript shows a plausible `echo "...\n..." >> file` append, but the landed artifact contains literal `\n` sequences on one line instead of real markdown line breaks.
- Fix: inspect the actual file content, not just the write command or the agent's summary. Credit the session only for the information that really landed, and note output-quality loss when shell-based writes produce malformed markdown or weak read-back via `cat` instead of the platform `read()` tool.

## Pattern: a blocked first finish does not negate a good outcome when recovery is immediate
- Symptom: a session's first `finish(success)` is rejected for missing read-back verification, which can make the whole run look low-quality if the review stops there.
- Fix: continue through the transcript. If the agent immediately performs the required read() calls, verifies the edited files, and then finishes cleanly with a real deliverable, score the outcome from the recovered end state and count the initial finish block as minor efficiency waste rather than a failed session.

## Pattern: finish can reject repo-relative deliverables even when the committed file is real
- Symptom: a session writes and commits a file under `/app/agents/...`, then `finish(success)` fails with `Deliverables not found on disk` when the deliverable is reported as a repo-relative path like `may/workspace/heartbeat-log.md`.
- Fix: verify the artifact actually exists and inspect the landed commit/diff. If the outcome is otherwise valid, treat the first finish failure as a path-normalization hiccup and expect immediate recovery by retrying with the absolute `/app/agents/...` path. Penalize efficiency lightly, not outcome quality.

## Pattern: finish-hygiene self-repair includes retrying `finish(success)` after the commit
- Symptom: a session hits `finish() blocked [uncommitted changes]`, commits the intended file, then retries `finish(success)` directly without an extra `git status`; naive heuristics may still mark it `needs_improvement`.
- Fix: judge the recovery window after the blocked finish, not just the presence of a later `git status`. A post-blocked successful terminal `finish(...)` after the commit is enough evidence of a clean self-repair unless the session later ends interrupted/error.

## Pattern: partial closeout can still be a successful builder outcome when the blocker is unrelated ambient dirt
- Symptom: a session edits code, adds tests, commits only its intended files, then ends `partial` because post-commit `git status` still shows unrelated runtime/log/project dirt owned elsewhere.
- Fix: inspect the actual commit and artifact state before downgrading. If the patch is committed, verified, and the agent correctly refused to stage unrelated files, credit the substantive outcome and treat the `partial` as a hygiene/environment blocker rather than proof the work failed.
