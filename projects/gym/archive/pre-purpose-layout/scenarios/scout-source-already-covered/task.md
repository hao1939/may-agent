# Reconcile the current HN source packet

Review `current-source.md` and integrate any useful AI-agent signal into the
knowledge library under `knowledge/`.

Rules:

- Treat `current-source.md` as the current authoritative source packet for this
  isolated run; do not use simulated or invented items.
- Search existing knowledge before creating anything.
- Prefer updating an existing topical finding over creating a new finding.
- Update `digest/today.md` only when the source packet justifies a useful new
  library change.
- If the current items are already represented, change nothing and finish with
  an evidence-backed no-op that names what you checked.
- Do not create new project roots or write outside this workspace.

Return a concise summary and verification evidence when finished.
