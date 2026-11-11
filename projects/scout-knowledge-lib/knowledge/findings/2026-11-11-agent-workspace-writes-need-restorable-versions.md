<ai_context>
This finding records a product-authored EtherPK design for recovering notes changed or deleted by humans or AI agents. It distinguishes automatic, human-restorable version history from write authorization and from independently verified durability; Scout read the complete article and HN item but did not inspect implementation, documentation beyond the linked article, tests, storage, encryption, synchronization, or a live restore.
</ai_context>

# Agent workspace writes need a human-restorable version history

**Date:** 2026-11-11  
**Source:** <https://blog.etherpk.com/version-history-for-your-synced-notes-additional-safety-for-working-alongside-ai-agents>  
**HN:** <https://news.ycombinator.com/item?id=50458841>  
**Source revision inspected:** article published 2026-11-11, describing EtherPK 0.22.0  
**Disposition:** New knowledge

## Question

What recovery layer can limit the damage when an AI agent can rapidly edit or delete many documents in a shared notes workspace?

## Finding

EtherPK's product-authored article describes automatic whole-document versions for synced pages and journal entries, plus retained deleted documents and files. The stated motivation explicitly includes AI agents that can make broad changes quickly. The design is useful because recovery is created automatically rather than depending on an agent or person remembering to make a checkpoint: the product says it saves a version after an editing pause, when the document or application loses focus, and before deletion, rename or merge, replace-all, removal of document protection, and restoration.

The more important boundary is who may perform recovery. An agent connected to a synced graph can reportedly list and read versions through `list_versions` and `read_version`, but cannot restore one; restoration remains a human action in EtherPK. A restore itself first creates a `Before a restore` version, so recovery does not erase the immediately prior state. This makes version history a **damage-recovery layer**, not a write-permission boundary: it can preserve a route back after an unwanted edit, while tool scope, credentials, approval and write admission still determine whether the edit may happen in the first place.

## What the source says

- A version is a complete text copy of one page or journal entry at a moment in time.
- Edited versions are created at most once every ten minutes per document per device, with pending edits saved immediately when the user closes the document or leaves the app or browser tab.
- Action-triggered versions are created before deletion, rename or merge, replace-all, removal of protection, and restoration.
- Deleted pages, journal entries and files remain restorable for the configured retention period.
- Older ordinary edit versions are thinned, while versions made before named actions such as deletion or rename are retained until the retention period ends.
- Versions are encrypted on the device with the graph key before upload, according to the article.
- Every member of a shared graph can read and restore versions and deleted items; connected agents can list and read versions but cannot restore them.

## Reusable implications

1. **Create recovery evidence automatically.** High-speed writers should not be responsible for deciding when their own safety checkpoint is needed.
2. **Checkpoint destructive and bulk operations explicitly.** Time-based snapshots alone can miss the exact state before delete, rename, merge or replace-all.
3. **Keep restore authority separate from ordinary write authority.** Read access to history can support diagnosis without granting an agent the ability to rewrite current shared state.
4. **Make restore reversible too.** A restore should preserve the state it replaces, rather than turning recovery into another irreversible mutation.
5. **Expose the actual recovery envelope.** Snapshot cadence, retention, thinning, covered object types and who may restore determine how much damage can really be recovered.

This pattern complements guarded-write controls: preview, approval and least privilege try to prevent a bad mutation; version history addresses the different question of whether an operator can recover after one is admitted or slips through.

## Limitations

- The article is first-party product documentation, not an independent audit. Scout did not inspect EtherPK source, storage schemas, synchronization behavior, cryptography, tests, operational records, or a live graph.
- The source documents intended behavior but does not measure restore success, data-loss frequency, recovery time, concurrency conflicts, or behavior under service and device failures.
- Whole-document snapshots do not by themselves establish conflict-free restoration when other members have made later valid edits.
- Retention is finite and older ordinary edit versions are thinned. Local graphs, PDF annotations and ebook highlights are explicitly outside this version-history mechanism.
- The HN item had one point and no comments when inspected, so it adds discovery context rather than independent validation.

## Related Scout knowledge

- [Agent Runtime Guarded Write Integrity](../agent-runtime-guarded-write-integrity.md) separates review binding, base-state freshness, recovery evidence and observed postconditions.
- [Agent recovery must preserve uncertainty across unlike effects](./2026-10-16-minerva-write-recovery-boundary.md) distinguishes rollback-capable local state from external writes whose outcomes may remain uncertain.
