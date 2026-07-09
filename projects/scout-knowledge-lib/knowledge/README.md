# Scout Knowledge Library

This library stores reusable knowledge about AI agents, evaluation, safety,
runtime systems, protocols, and cross-source research signals.

Use this page when you need to understand where knowledge belongs. Use
`INDEX.md` when you need the exhaustive file map.

## How To Read It

- Durable answers belong in topic notes.
- Raw observations belong in `findings/`.
- Maintenance decisions belong in `../reports/`.
- Old provenance belongs in archive folders after it has been merged or
  replaced.

## Current Main Topics

- Agent architecture and runtime patterns
- Agent evaluation and verification
- Agent security, governance, and runtime hardening
- Agent protocols and interoperability
- Memory, context, and state management
- Multi-agent coordination
- XHS, HN, GitHub, and arXiv trend synthesis
- System-level operating lessons for agent projects

## Working Rule

Prefer updating an existing durable note over creating a new top-level file.
When a raw finding is useful, either mark it covered by an existing note or
absorb the durable part into the right note.

## Current Cleanup Focus

- Reduce `Not yet sourced` entries in `INDEX.md`.
- Fix or explain future-dated library references.
- Continue merging useful `/app/shared/knowledge` material into this library and
  removing replaced source files.
- Move reports into `reports/health`, `reports/merge`, `reports/triage`,
  `reports/migration`, or `reports/operations` in small verified batches.
