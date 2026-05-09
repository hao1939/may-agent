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
