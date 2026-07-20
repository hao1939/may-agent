# Integrate the current GitHub source packet

Review `current-source.md` and integrate its useful AI-agent signals into the
knowledge library under `knowledge/`.

The suggested historical scan path is
`knowledge/findings/2026-07-20-github-scan-536.md`, but paths are not allocated
identities. Inspect it before writing. If it represents different primary
sources, preserve it and choose an unused descriptive topic path for the new
finding.

Rules:

- Treat `current-source.md` as authoritative source evidence for this isolated
  run; do not invent items.
- Preserve all existing primary `Source:` and `Repo:` declarations.
- Do not allocate another scan number in the new path or title. Use the subject
  itself as the identity, with the required `YYYY-MM-DD-<topic>.md` date prefix.
- This packet is useful enough to record. Update `digest/today.md` with a
  distinct subject-based heading and short highlight. Do not reuse an occupied
  explicit scan identity.
- The existing accumulator is exactly `digest/today.md` at the workspace root.
  Open and append that file; never create `knowledge/digest/`.
- Read every changed output back before finishing.
- Do not write outside this workspace.

Return a concise summary and verification evidence when finished.
