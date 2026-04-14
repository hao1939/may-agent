# Lessons

Feedback from evaluator sessions.

## Task evaluation (2026-03-14 22:01:39)

- When answering a tool-availability question (e.g., whether `handoff` exists), include a concrete execution artifact (tool help/list output) so the claim is verifiable.

## Task evaluation (2026-03-14 22:02:00)

- When asked to verify tool availability, prefer running `help`/`list_tools` (or equivalent) and include the resulting tool-output artifact; don’t rely on a bare assertion for a verification task.

## Task evaluation (2026-03-14 22:02:48)

- When asked to confirm tool availability (e.g., whether `handoff` exists), provide a verifiable artifact (actual `help`/`list_tools` output or equivalent). Pure assertions force evaluators/users to treat the conclusion as unverified.

## Task evaluation (2026-03-14 22:31:46)

- When asked to verify available tools/commands, include direct runtime evidence (e.g., actual tool output) rather than an asserted list.
- Avoid categorical claims about tool absence without a concrete verification step; label as uncertain if you cannot check.

## Task evaluation (2026-03-14 22:32:06)

- When asked to *verify* tool availability, provide structural evidence (e.g., tool-call output) rather than repeating an asserted static list.
- Detect repeated re-asks as a signal the user wants stronger verification; escalate instead of looping the same response.

## Task evaluation (2026-03-14 22:32:48)

- When asked to *verify* the active toolset, provide observable evidence (e.g., actual tool-call output or a concrete runtime enumeration method) instead of only asserting a static list.
- Avoid repeating the same canned tool list across repeated verification requests; adapt the approach when the user asks for a verifiable mechanism.
