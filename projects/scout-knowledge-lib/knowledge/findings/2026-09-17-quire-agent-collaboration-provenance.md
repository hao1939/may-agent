<ai_context>
summary: "Quire makes human and agent edits share one local Markdown CRDT, with suggestions and span attribution kept off-file in durable sidecar state. This supports live review without polluting the artifact, but plain Markdown alone cannot carry the collaboration evidence: missing sidecar state and edits through external tools remain explicitly unattributed."
triggers: ["Quire", "agent collaboration", "Markdown CRDT", "span attribution", "suggest mode", "provenance sidecar", "unattributed edits", "local-first agents"]
last_updated: "2026-09-17"
source_basis: "HN item 49736281 and heetdalsania/quire revision 64b4d8eef4c74be55c5bfdf0417960fe3c37d1e5, observed 2026-09-17. Reviewed README, SECURITY.md, CRDT/disk bridge, provenance and receipt implementations, and relevant checked-in tests."
</ai_context>

# Quire: live agent collaboration makes provenance a paired artifact

## Assessment

- **Question:** What reusable agent-workflow signal does Quire's shared human/agent Markdown editor provide, and where does its attribution guarantee stop?
- **Observation date:** 2026-09-17
- **HN source:** [Quire – Humans and AI agents edit local Markdown together](https://news.ycombinator.com/item?id=49736281) (3 points, 0 comments when checked)
- **Repo:** https://github.com/heetdalsania/quire
- **Reviewed version:** [`64b4d8eef4c74be55c5bfdf0417960fe3c37d1e5`](https://github.com/heetdalsania/quire/commit/64b4d8eef4c74be55c5bfdf0417960fe3c37d1e5)
- **Coverage:** Full README and security statement; relevant bridge, provenance, receipt, and checked-in test files. This was an implementation review, not a deployment or adversarial security assessment.
- **Disposition:** New knowledge. The useful signal is not simply “agents can edit Markdown,” but that review metadata and the portable artifact have different durability boundaries.

## Source claims and implementation evidence

Quire presents agents as peers in the same Yjs CRDT session as human editors. Agent insertions carry author and optional run marks; suggestions remain in CRDT state but are excluded from the committed Markdown projection until accepted. External file changes are merged into the live CRDT as deltas rather than replacing the whole document, preserving untouched anchors and concurrent work.

The checked implementation supports those mechanics:

- [`DocHandle.getContent`](https://github.com/heetdalsania/quire/blob/64b4d8eef4c74be55c5bfdf0417960fe3c37d1e5/packages/bridge/src/doc-handle.ts) projects only committed text to disk, while `getFullText` includes pending suggestions.
- [`applyExternalChange`](https://github.com/heetdalsania/quire/blob/64b4d8eef4c74be55c5bfdf0417960fe3c37d1e5/packages/bridge/src/diff.ts) replays disk changes as minimal insert/delete operations. New externally inserted text is not stamped with an author mark.
- [`summarise`](https://github.com/heetdalsania/quire/blob/64b4d8eef4c74be55c5bfdf0417960fe3c37d1e5/packages/bridge/src/provenance.ts) therefore assigns unknown or absent author marks to an explicit `unattributedShare`; its test rejects the tempting shortcut of labeling unclaimed text “human.”
- [`Vault.scanInitial`](https://github.com/heetdalsania/quire/blob/64b4d8eef4c74be55c5bfdf0417960fe3c37d1e5/packages/bridge/src/vault.ts) restores `.quire/state/` before merging file changes made while Quire was stopped. Without saved state, it seeds the CRDT from the file, which has no authorship marks.
- The [security statement](https://github.com/heetdalsania/quire/blob/64b4d8eef4c74be55c5bfdf0417960fe3c37d1e5/SECURITY.md) explicitly says authorship, comments, provenance, policy, and suggestion outcomes live in `.quire/state/`; deleting it leaves prose intact but loses the collaboration layer.

This is a useful design: clean Markdown stays interoperable with git and ordinary editors, while richer review state remains available locally. It also draws an honest boundary. The Markdown file is the **content source of truth**, but not the complete **evidence source of truth**.

## Interpretation: provenance is a paired artifact

For mixed human/agent work, portability and accountability pull in different directions. Embedding all provenance into Markdown would pollute the artifact and interfere with ordinary tools. Keeping it in CRDT metadata preserves a clean file, but the evidence then has an independent lifecycle.

A reviewable document should consequently be modeled as a pair:

1. **content artifact** — the portable Markdown bytes; and
2. **evidence artifact** — author spans, run records, suggestion outcomes, comments, and optional replay history.

Copying, committing, or backing up only the first preserves prose but not the basis for claims such as “30% agent-authored” or “this passage came from this run.” External editing does not falsify that evidence; Quire appropriately marks the new material unattributed. The operational requirement is to preserve and bind the sidecar state whenever attribution matters, and to keep an explicit unknown category for edits that bypass observed channels.

This sharpens a general rule for agent collaboration systems: **do not infer provenance from the final artifact, and do not imply that artifact durability automatically preserves provenance durability.** Receipts should state their coverage boundary, including unattributed spans and whether the evidence sidecar was present and continuous.

## Limitations

- The repository was 12 stars and the HN submission had 3 points and no comments at observation time; this is design evidence, not adoption evidence.
- Quire's security document says agent policies are guardrails, not hostile-client controls: clients can omit the agent declaration, and non-loopback exposure has no authentication by default.
- Provenance records who or what wrote a span through an observed path; it does not establish that the text is correct.
- A focused local test attempt could not start because the environment's dependency installation omitted the repository's `vitest` dev dependency. Conclusions above are based on source and checked-in tests, not a successful local execution.
