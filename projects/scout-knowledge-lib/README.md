# Scout Knowledge Library

This is the portable domain workspace for Scout's knowledge library.

The library captures source-grounded findings, reusable agent-system patterns,
and synthesis notes that Scout and other agents can build on. It is a project
workspace, not Scout heartbeat scratch.

## Layout

- `knowledge/` - durable notes, indexes, findings, and insights.
- `reports/` - review reports, library health summaries, and adoption notes.
- `design/` - domain design notes for library structure and quality standards.

## Operating Principles

- Prefer updating an existing note over creating a duplicate.
- Keep notes source-grounded and agent-readable.
- Maintain `knowledge/INDEX.md` as the entry point.
- Record contradictions, stale notes, and consolidation opportunities instead
  of silently accumulating more files.
- Treat Scout heartbeat as one possible contributor, not the owner of the
  library process.

The May-agent control plane that drives this workspace lives in
`../scout-knowledge-lib.app/`.
