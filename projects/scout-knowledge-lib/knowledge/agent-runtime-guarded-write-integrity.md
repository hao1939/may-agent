<ai_context>
summary: "Companion to agent-runtime-effect-integrity.md for guarded writes: transactional review versus atomic commit, review-bound configuration plans, recovery evidence, apply-time revalidation, post-write observation, and concurrency-safe snapshots."
triggers: ["guarded write", "transactional review", "atomic commit", "configuration plan", "apply-time revalidation", "preview fingerprint", "post-write readback", "configuration backup", "conditional update"]
last_updated: "2026-10-04"
source_basis: "Extracted intact from agent-runtime-effect-integrity.md during its 2026-10-04 oversized-note review. Each retained section preserves stable source links, pinned revisions, reproduced checks where performed, and explicit evidence limitations."
</ai_context>

# Agent Runtime Guarded Write Integrity

**Companion note** to [Agent Runtime Effect Integrity](./agent-runtime-effect-integrity.md).

These patterns separate review, base-state freshness, recovery evidence, write completeness, and observed postconditions. They show why a preview, backup, atomic rename, or successful API response proves only its own layer rather than making an entire multi-resource or external mutation transactional.

## Transactional Review Is Not the Same as Atomic Commit — Overlord (HN / GitHub, September 2026)

Overlord is an early Linux “agent hypervisor” that gives a command a writable
overlay over a target directory, records its changes, and exposes an explicit
commit or rollback decision. The checked implementation has several concrete
protections: jailed agent mode uses namespace and overlay primitives; commit
checks touched paths against the initial size-and-mtime manifest; protected
harness files require a fresh complete countersignature; replay validates every
destination before mutation to reject symlink escapes; and MCP connectors are
explicitly classified as host-side external actions that cannot be undone by
discarding the filesystem session. Its audit chain uses an HMAC key and can
optionally pin the signed head to an off-box witness.

Those controls make **review before publication** and **atomic publication** easy
to confuse. The README says changes commit “all or nothing,” but the pinned commit
path calls `apply_layers`, which copies, removes, and replaces target entries one
at a time. There is no staging-tree swap, write-ahead recovery record, or exception
handler that restores already-applied entries if a later filesystem operation
fails. `rollback_session` deletes the pending overlay; it does not reverse target
writes already made by a failed commit attempt.

A narrow injected-failure check reproduced the boundary. Scout ran the repository's
`replay_safety_test.py` successfully, confirming that invalid destinations are
rejected before replay and that a leaf symlink is replaced rather than followed.
Scout then applied an upper layer containing `a.txt` and `b.txt` while injecting an
`OSError` on the second `_copy_entry`: `a.txt` remained in the real target while
`b.txt` was absent. This is not a claim about how often ordinary filesystems fail,
but it disproves an unconditional all-or-nothing commit guarantee at the inspected
revision.

**Runtime rule:** label the guarantees separately. Overlay execution can keep
unreviewed writes away from the base tree; preflight can reject known drift and
unsafe destinations before the first write; review can authorize an exact diff;
and a keyed log can preserve accountable history. None makes a multi-file publish
atomic. An all-or-nothing claim additionally needs an atomic namespace switch or a
durable apply/undo protocol with crash recovery, followed by a post-commit check.
External connector effects remain outside even that filesystem transaction and
need their own settlement and reconciliation semantics.

This is source inspection and a local failure injection against a very new,
low-adoption repository (two GitHub stars and an HN item with three points and no
comments at retrieval), not a full security audit or production reliability
assessment. The pure replay-safety test ran in Scout's environment; kernel jail,
AppArmor, network isolation, daemon policy, and live connector behavior were not
exercised.

- **HN:** https://news.ycombinator.com/item?id=49735668
- **Repo:** https://github.com/B1tR0n1n/overlord
- **Inspected revision:** [`7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3`](https://github.com/B1tR0n1n/overlord/commit/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3)
- **Primary sources:** [commit and replay implementation](https://github.com/B1tR0n1n/overlord/blob/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3/overlord.py), [connector boundary](https://github.com/B1tR0n1n/overlord/blob/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3/mcp.py), [keyed audit chain](https://github.com/B1tR0n1n/overlord/blob/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3/audit.py), [replay-safety tests](https://github.com/B1tR0n1n/overlord/blob/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3/test/replay_safety_test.py), and [integration guide](https://github.com/B1tR0n1n/overlord/blob/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3/docs/INTEGRATION.md)

## A Safe Configuration Write Needs Four Different Proofs — n8n-mcp-guard (GitHub, September 2026)

`n8n-mcp-guard` turns agent edits to live n8n workflows into a concrete
plan/apply protocol. Planning reads the live workflow, computes a reviewable
diff, records both the platform version and a behavioral fingerprint, and
writes a checksum-verified backup before returning a short-lived plan. Applying
then re-reads the workflow and refuses the write if either version or
fingerprint moved, refuses if the exact-version backup is missing or damaged,
and reads the saved workflow back to compare it with the planned target.
Consumed plans are deleted, so the same in-process authority cannot be applied
twice.

The implementation is useful because its checks answer four distinct questions:

1. **Was this change reviewed?** The diff and target are frozen into the plan.
2. **Is the write still based on current state?** Version plus behavioral hash
   detect both ordinary edits and content drift under an unchanged version ID.
3. **Is the prior state recoverable?** Apply requires a readable backup whose
   definition hash matches its contents and whose workflow/version identity
   matches the planned base.
4. **Did the configuration service store the intended graph?** A post-write GET
   must match the target fingerprint rather than trusting the PUT response.

That composition is stronger than calling the whole operation “two-phase
commit”: it combines review binding, optimistic concurrency, rollback evidence,
and postcondition checking. Each check covers a different failure, so one
cannot substitute for another. In particular, a valid backup does not prove the
live state is unchanged, and a successful API response does not prove the
intended graph was persisted.

The boundary is narrower than workflow correctness or durable distributed
transactions. Plans live only in an in-memory map for 30 minutes; the behavioral
signature covers workflow name, nodes, credential bindings, and connections but
intentionally excludes activation state and other metadata; backups are local
files that may contain production configuration; and readback proves stored
configuration, not downstream effects. The repository reports 68 unit tests, a
live integration suite, and a 99-workflow validation corpus, but Scout inspected
source and project-authored tests rather than rerunning those claims. Publication
of an active workflow also remains an external-effect boundary that may need
separate reconciliation if its response is lost.

**Runtime rule:** admit an agent-authored configuration change only when review
identity, current-base identity, recovery evidence, and observed postcondition
are independently represented. Call the result “stored as intended,” not
“worked as intended,” unless execution outcomes are observed too.

- **Repo:** https://github.com/FarazHayder/n8n-mcp-guard
- **Inspected revision:** [`7ec7c7daa556f98803c11b346a268282b0889d94`](https://github.com/FarazHayder/n8n-mcp-guard/commit/7ec7c7daa556f98803c11b346a268282b0889d94)
- **Primary sources:** [guarded plan/apply implementation](https://github.com/FarazHayder/n8n-mcp-guard/blob/7ec7c7daa556f98803c11b346a268282b0889d94/src/n8n/guardedUpdate.ts), [behavioral fingerprint](https://github.com/FarazHayder/n8n-mcp-guard/blob/7ec7c7daa556f98803c11b346a268282b0889d94/src/n8n/graph.ts#L123-L148), [backup verification](https://github.com/FarazHayder/n8n-mcp-guard/blob/7ec7c7daa556f98803c11b346a268282b0889d94/src/n8n/backup.ts), and [guard tests](https://github.com/FarazHayder/n8n-mcp-guard/blob/7ec7c7daa556f98803c11b346a268282b0889d94/test/unit/guardedUpdate.test.ts)
- **Discovery query:** GitHub Repository Search API `"AI agent" (security OR sandbox OR evaluation OR observability) created:>=2026-09-11`, sorted by stars; `incomplete_results: false`

## A Fingerprinted Preview Still Needs One Apply-Time Snapshot — Coucou (GitHub, October 2026)

Coucou's Claude Code hook installer is a compact example of configuration
mutation treated as a reviewable effect rather than a setup convenience. It
parses the existing `settings.json`, preserves unrelated fields and other
hooks, shows a unified diff, and returns a fingerprint of the bytes behind that
preview. The later write refuses a stale fingerprint, takes a byte-for-byte
backup, creates the replacement beside the target with permissions no broader
than the original, and renames it over the target. Unreadable or malformed
configuration aborts instead of being treated as empty. Project-authored tests
cover BOM parsing, preservation of another tool's hook, backup fidelity,
permission preservation, and rejection after a file changes between preview
and write.

This supports a useful minimum for local agent-hook installation: **preserve,
preview, bind, back up, and replace**. Each verb covers a different failure.
Merging only owned entries avoids taking over a shared configuration; a diff
makes the proposed authority expansion visible; a base fingerprint rejects
ordinary stale approval; a faithful backup preserves recovery evidence; and a
same-directory replacement avoids exposing a partially written JSON file.

Static inspection also exposes why those controls should not be summarized as
an atomic compare-and-swap. `write()` parses the current file, then separately
re-reads the path to compare its fingerprint, then separately copies the path
for backup before renaming the generated content. It holds no lock and performs
no identity check on one opened file descriptor through commit. A concurrent
writer can therefore still change the path between those operations or after
the comparison. In that race, the parsed base, compared bytes, backup bytes,
and replaced path need not all be the same snapshot. The bundled stale-file
test exercises sequential drift, not an interleaving concurrent writer.

**Runtime rule:** bind a human-reviewed configuration diff to the exact base,
but carry that identity through one apply-time snapshot and the final replace.
For a local file this can mean locking/cooperating writers, or opening and
validating one file identity and rechecking immediately before a guarded
commit. A preview fingerprint plus atomic rename protects review freshness and
write completeness in common cases; it does not by itself provide a linearizable
conditional update.

The fingerprint is non-cryptographic FNV-1a and is explicitly used as a change
detector, not an adversarial integrity proof. Scout inspected project-authored
Rust code and tests at the pinned revision but did not build Coucou, run its
tests, install hooks, or reproduce the race. Repository popularity and release
metadata were discovery signals only.

- **Repo:** https://github.com/Louis-CFM/coucou
- **Inspected revision:** [`19f1f08651bc2b020a9a1b72c6ac0bb3656c0198`](https://github.com/Louis-CFM/coucou/commit/19f1f08651bc2b020a9a1b72c6ac0bb3656c0198)
- **Primary sources:** [hook installer and tests](https://github.com/Louis-CFM/coucou/blob/19f1f08651bc2b020a9a1b72c6ac0bb3656c0198/windows/src-tauri/src/hooks.rs), [setup documentation](https://github.com/Louis-CFM/coucou/blob/19f1f08651bc2b020a9a1b72c6ac0bb3656c0198/README.md), and [pinned tree](https://api.github.com/repos/Louis-CFM/coucou/git/trees/19f1f08651bc2b020a9a1b72c6ac0bb3656c0198?recursive=1)
- **Discovery query:** GitHub Repository Search API `(AI agent OR agentic) in:name,description,readme created:>2026-09-20 stars:>5`, sorted by stars; `incomplete_results: false`

## A Previewable Plan Is Not a Write Capability — AnkiBridge (GitHub, September 2026)

AnkiBridge's plan/apply boundary treats saved JSON as an untrusted request to
re-evaluate, not as authority inherited from an earlier preview. Planning
produces readable old/new field values, tags, stable identity and target deck.
At apply time, the service checks the current write policy again; rejects delete
operations and unknown note types even if they were forged into the plan;
verifies unique stable identity and note type; reads **all actual decks** that
contain the note; and requires those memberships to match the plan. It also
compares each current field or tag set with both the recorded previous value and
the intended value. Exact replay can therefore settle as a no-op, while a third
value proves intervening change and forces replanning.

The audit sequence exposes a second boundary. The service writes a `started`
record before calling Anki and a `succeeded` record afterwards. A connection
error is labeled outcome-unknown and stops later writes; if the effect executes
but final audit logging fails, the returned item is changed to failure and the
batch stops pending reconciliation. This is weaker than a transaction, but
stronger than either blindly replaying the whole batch or treating a missing
response as no effect.

**Operational implication:** a reviewable plan should bind what the human saw,
but write authority and current-world assumptions must still be checked at the
effect boundary. Revalidation should cover target scope, object identity,
resource memberships and the exact prior values that make the proposed diff
safe; replay semantics and unknown-outcome semantics are separate controls.

The limits are material. The repository's MCP approval token, plan store,
writer lock and pre-apply backup are design proposals, not shipped features.
The implemented service has no cross-call Anki transaction or durable
collection/profile identity, and another client can still race it. Its default
`dry_run=True` returns without checking live preconditions, so it is not an
applicability proof. Scout inspected source and repository-authored tests but
did not run them or use a personal Anki collection. The repository was created
on 2026-09-17 and had four stars at retrieval.

- **Repo:** https://github.com/MrChalo69/ankibridge-oss
- **Inspected revision:** [`16270229942b761d8ca9833b85460d732a4f01dd`](https://github.com/MrChalo69/ankibridge-oss/commit/16270229942b761d8ca9833b85460d732a4f01dd)
- **Primary sources:** [architecture and transaction limits](https://github.com/MrChalo69/ankibridge-oss/blob/16270229942b761d8ca9833b85460d732a4f01dd/docs/ARCHITECTURE.md), [plan/apply service boundary](https://github.com/MrChalo69/ankibridge-oss/blob/16270229942b761d8ca9833b85460d732a4f01dd/src/ankibridge/service.py), [safety tests](https://github.com/MrChalo69/ankibridge-oss/blob/16270229942b761d8ca9833b85460d732a4f01dd/tests/test_service_safety.py), and [unimplemented MCP approval design](https://github.com/MrChalo69/ankibridge-oss/blob/16270229942b761d8ca9833b85460d732a4f01dd/docs/MCP_DESIGN.md)
- **Discovery query:** GitHub Repository Search API `"AI agent" created:>2026-09-16`, sorted by stars; `incomplete_results: false`
