<ai_context>
summary: "aisync serializes updates to a shared file-claim registry and reports overlaps, but deliberately records the second overlapping claim before its CLI returns exit 3; its MCP surface returns ordinary text after doing the same. The reusable rule is to distinguish conflict visibility from exclusive admission: a claim protocol must define whether overlap is rejected atomically, recorded as waiting, or admitted as conflicting, and expose that state structurally to every client."
triggers: ["aisync", "multi-agent file claims", "coding-agent coordination", "claim overlap", "atomic conflict admission", "MCP coordination tool"]
last_updated: "2026-11-11"
source_basis: "HN item 50446378 and static inspection of the complete README plus selected implementation and tests in MaxonT/aisync at commit a998fb4da2d86977c7a27b388aabbcafc65f2911. Scout did not install or run aisync, execute its tests, connect agents or MCP clients, or validate live race, hook, journal, Git, or recovery behavior."
</ai_context>

# Coordination claims need atomic conflict semantics

- **Date observed:** 2026-11-11
- **Question:** What does a shared file-claim mechanism prove when several coding agents may edit the same repository?
- **HN source:** https://news.ycombinator.com/item?id=50446378
- **Repo:** https://github.com/MaxonT/aisync
- **Reviewed version:** [`a998fb4da2d86977c7a27b388aabbcafc65f2911`](https://github.com/MaxonT/aisync/commit/a998fb4da2d86977c7a27b388aabbcafc65f2911)
- **Coverage:** complete README; selected claim implementation, CLI, MCP wrapper, and claim/MCP tests. Static inspection only.
- **Disposition:** new knowledge; no existing Scout note declared this primary repository or HN item.

## Source observation

The HN submission describes aisync as advisory file claims for multiple AI tools working in one repository. The repository combines shared rules, a hash-chained journal, expiring file claims, and hooks that inject recent activity into supported agent sessions. Its README says agents should claim files before editing, that overlap exits with status 3, and that the agent should stop before colliding.

The inspected implementation makes the exact boundary clearer. `collab.claim` takes a lock around the shared claims file, removes an earlier claim by the same agent for the same project, constructs the new expiring claim, calculates overlap against other live claims, **appends the new claim even when overlap exists**, saves the registry, and journals the event. The CLI then returns 3 and explains that the second claim was intentionally retained so the first agent can see that another agent is waiting. Thus the lock serializes registry mutation, but the registry can contain simultaneous conflicting claims by design.

That behavior is useful for visibility, but it is not exclusive admission. The tests statically inspected expect the overlapping CLI call to return 3 and later expect the second claimant to appear in status after the first claim is released. Another test shows that logging an edit to claimed files emits a warning while still returning success. Claims also expire by local timestamp and malformed records are omitted when loaded; no inspected path establishes that a file write itself must present and validate a live claim.

The MCP surface weakens the failure signal further. Its `claim` tool calls the same state-mutating function and returns a normal text string beginning with `claimed`; overlap is appended as prose instructing the caller to coordinate or choose other work. The inspected MCP test checks for that overlap text, not a structured refusal or non-success result. An agent therefore has to interpret and obey prose after its conflicting claim has already entered shared state.

## Reusable interpretation

A shared claim registry should state which of three semantics it implements:

1. **Exclusive admission:** compare-and-insert is atomic; an overlap leaves no active claim for the loser and returns a machine-readable refusal.
2. **Waiting registration:** an overlap creates a distinct non-active waiting record linked to the active holder; it cannot be mistaken for edit authority and has an explicit promotion transition.
3. **Conflicting admission:** both claims become active, conflict is first-class state, and downstream edit or publish boundaries independently refuse while conflict remains unresolved.

Mixing these semantics is dangerous. A process lock can make claim storage race-safe without making repository edits mutually exclusive. Likewise, a CLI exit code or warning can express operator intent without proving that every host, MCP adapter, hook, or direct filesystem path stops. If an overlapping request is retained for awareness, it should carry an explicit state such as `waiting` rather than looking like another active claim.

For agent orchestration, the minimum useful receipt is not simply “claim recorded.” It should include the repository and normalized path set, claimant identity, claim state, conflicting claim IDs, acquisition revision, expiry basis, and the decision made at the protected action boundary. Directory overlap also needs path-aware normalization: string-prefix checks should not be treated as a complete substitute for repository-relative canonical paths, symlink policy, case-sensitivity rules, rename handling, and generated-file ownership.

The broader lesson is that **coordination evidence and enforcement evidence are separate**. A journal can show that an agent was warned, and a claim board can make contention visible, while neither proves the conflicting write was prevented. Use advisory coordination to reduce accidental collisions; use an effect-owning boundary—workspace isolation, compare-and-swap publication, merge admission, or another mandatory guard—when collision prevention is required.

## Evidence boundary

- Scout inspected producer-authored source and tests statically but did not install aisync, execute its test suite, or reproduce a concurrent claim race.
- The implementation lock may correctly serialize local claim-file updates; that does not establish distributed coordination across machines or mandatory mediation of filesystem and Git effects.
- The claim model intentionally preserves an overlapping claimant for awareness. Calling it non-exclusive is a description of its checked semantics, not evidence that the design fails its stated advisory purpose.
- Scout did not test host-specific handling of CLI exit 3, MCP tool text, hooks, time zones, clock changes, stale processes, crashes, symlinks, case-insensitive filesystems, renames, or direct edits.
- The hash-chained journal may detect changed, missing, or reordered events under the project's assumptions, but this review did not inspect or run the complete journal verification and recovery paths.
- HN votes and comments were discovery signals, not evidence of correctness or adoption.

## Sources

- **HN:** https://news.ycombinator.com/item?id=50446378
- **Repository:** https://github.com/MaxonT/aisync
- **Inspected revision:** https://github.com/MaxonT/aisync/commit/a998fb4da2d86977c7a27b388aabbcafc65f2911
- **README:** https://github.com/MaxonT/aisync/blob/a998fb4da2d86977c7a27b388aabbcafc65f2911/README.md
- **Claim implementation:** https://github.com/MaxonT/aisync/blob/a998fb4da2d86977c7a27b388aabbcafc65f2911/ai_sync/collab.py
- **CLI overlap handling:** https://github.com/MaxonT/aisync/blob/a998fb4da2d86977c7a27b388aabbcafc65f2911/ai_sync/cli.py
- **MCP claim wrapper:** https://github.com/MaxonT/aisync/blob/a998fb4da2d86977c7a27b388aabbcafc65f2911/ai_sync/mcp_server.py
- **Claim tests:** https://github.com/MaxonT/aisync/blob/a998fb4da2d86977c7a27b388aabbcafc65f2911/tests/test_collab.py
- **MCP tests:** https://github.com/MaxonT/aisync/blob/a998fb4da2d86977c7a27b388aabbcafc65f2911/tests/test_mcp_server.py
