# Evaluator lessons

- Finish-guard friction pattern: if `finish()` is blocked by uncommitted changes, treat it as a process defect. Prevent by running `git status --porcelain` before `finish()` (or make workflows enforce a clean tree).
- Messaging reliability: `functions.message` is a tool namespace, not an agent recipient. `message({to: ...})` must target a real agent name (e.g., may/arc/dev/scout/coach). Mis-targets create `message.delivery_failed` events and can mask real escalations.
