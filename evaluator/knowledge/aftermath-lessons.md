# Aftermath review lessons

## Duration-gate sessions
- If a session is duration-gated for being too short, evidence of value must include at least one durable output: (1) an artifact summarizing findings + next steps, (2) a low-risk patch with verification, or (3) an escalation message with concrete evidence. Pure exploration (reads/queries) is not sufficient.

## Rolling research digests
- When a research session appends findings to a rolling workspace digest, judge task value from the session's landed commit diff plus source-fetch evidence, not only from the current digest contents after later sessions have appended more material.

## Hypothesis-hardening heartbeats
- A heartbeat that extends an existing knowledge entry with a quantified baseline and explicit falsifier can be a genuinely valuable success even without code changes. Judge from the landed diff, commit, and post-write verification: if the session turns a vague system complaint into a measurable validation plan, treat it as substantive output rather than routine note-taking.
- A heartbeat that actually runs the cheapest listed falsifier and collapses a broader systems hypothesis into a verified local/config fix is high-value output. Score from the decisive experiment and landed artifact, not from the absence of product-code edits; a one-off `finish()` path correction after the fact is only minor efficiency loss if recovery is immediate.

## No-change heartbeat partials
- When a heartbeat ends `partial` with no write/edit calls, no commit, and unchanged project state, treat it as limited-value maintenance even if the agent behaved correctly and documented the blocker well. Routing hints like `project artifact` or `workflow-linked session` are not material output by themselves; confirm an actual landed diff, artifact write, or escalation before calling it a real success.
