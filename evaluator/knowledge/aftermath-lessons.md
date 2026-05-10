# Aftermath review lessons

## Duration-gate sessions
- If a session is duration-gated for being too short, evidence of value must include at least one durable output: (1) an artifact summarizing findings + next steps, (2) a low-risk patch with verification, or (3) an escalation message with concrete evidence. Pure exploration (reads/queries) is not sufficient.

## Rolling research digests
- When a research session appends findings to a rolling workspace digest, judge task value from the session's landed commit diff plus source-fetch evidence, not only from the current digest contents after later sessions have appended more material.
- A small scout digest append is a real success when the session turns fetched external results into a specific reusable implication and lands a clean single-file commit; an initial ignored-path `git add` failure and a first `finish(success)` blocked for missing read-back are minor efficiency losses if recovery is immediate and the final diff is correct.

## Hypothesis-hardening heartbeats
- A heartbeat that extends an existing knowledge entry with a quantified baseline and explicit falsifier can be a genuinely valuable success even without code changes. Judge from the landed diff, commit, and post-write verification: if the session turns a vague system complaint into a measurable validation plan, treat it as substantive output rather than routine note-taking.
- A heartbeat that actually runs the cheapest listed falsifier and collapses a broader systems hypothesis into a verified local/config fix is high-value output. Score from the decisive experiment and landed artifact, not from the absence of product-code edits; a one-off `finish()` path correction after the fact is only minor efficiency loss if recovery is immediate.

## No-change heartbeat partials
- When a heartbeat ends `partial` with no write/edit calls, no commit, and unchanged project state, treat it as limited-value maintenance even if the agent behaved correctly and documented the blocker well. Routing hints like `project artifact` or `workflow-linked session` are not material output by themselves; confirm an actual landed diff, artifact write, or escalation before calling it a real success.

## Metric-triage completeness
- A repeated-alert session is not complete just because one prior KE explains part of the situation. For aftermath review, require separate live evidence for each red metric named in the task. If a schema-guessing query fails and the session never retries against the real table/columns, treat any claim that the alert was "triaged" as incomplete.
- When routing labels suggest "project artifact" or "knowledge update," verify attribution from actual files: check session IDs in `last-session.md`, current diffs, or committed artifacts before crediting nearby modified files to the reviewed session.
