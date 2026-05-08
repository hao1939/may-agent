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
