# Aftermath reviews — evaluator patterns

## Pattern: schema guessing causes avoidable query errors
- Symptom: querying `events.type` (or other guessed columns) fails; session then uses PRAGMA to discover real schema.
- Fix: if table is unfamiliar, run `PRAGMA table_info(<table>)` first.

## Pattern: finish blocked by uncommitted agent repo changes
- Symptom: `finish()` guard blocks with `uncommitted changes` and lists modified files.
- Fix: check `git status` in /app/agents early; commit small, descriptive changes before calling `finish()`.

## Pattern: tool/agent confusion in messaging
- Symptom: agents attempt to send messages to an invalid recipient like `functions.message` (confusing tool name with agent name).
- Fix: clarify in prompts/docs that `message` is a tool and `to` must be an agent handle (e.g. `may`, `dev`, `arc`).

## Pattern: success-candidate evidence should favor actual artifacts over transcript anomalies
- Symptom: a transcript snippet suggests a missing file or path mismatch, but the produced artifact, tracked source file, test, and runtime DB evidence all confirm the deliverable exists.
- Fix: for success-candidate aftermath reviews, inspect the actual artifact and current tracked files before downgrading the session based on one anomalous tool result. Use transcript anomalies as cautions to note, not as sole grounds to reject a verified outcome.

## Pattern: analysis artifacts can go stale if they skip live DB verification
- Symptom: a session produces a useful calibration/report artifact, but it relies only on file reads and repeats outdated status claims (`retired`, old coverage values) that runtime DB queries would have corrected.
- Fix: when an artifact makes claims about metric status or current values, verify those claims against `metrics` and, if timing matters, `metric_snapshots` before crediting the analysis as fully accurate. Keep the strategic value if rankings/mappings still hold, but note the stale-status root cause.

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

## Pattern: metric-alert dismissal can collapse into artifact-gate compliance
- Symptom: a heartbeat reads an existing metric-analysis KE, writes a one-line workspace note like "dismissing per KE-...", and finishes without fresh metric checks, follow-through, or any substantive downstream work.
- Fix: when reviewing alert-handling sessions, separate the diagnosis from the session's own contribution. Credit the reused KE for the diagnosis, but require fresh evidence or a real operational action before treating the session itself as materially successful.

## Pattern: short-interval follow-up reviews can still add value through delta tracking
- Symptom: a follow-up review happens minutes after a fuller report, so there is little new raw data and the session risks repeating prior analysis.
- Fix: if the underlying evidence is still fresh, verify the live state, then produce a compact status tracker that answers "what changed / what remains unacted on" instead of redoing the whole review. Credit sessions that transform prior findings into explicit recommendation-tracking with current unresolved items.
