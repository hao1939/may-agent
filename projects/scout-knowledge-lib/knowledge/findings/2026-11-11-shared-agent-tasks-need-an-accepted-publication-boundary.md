<ai_context>
summary: "Pinned utsurigi-agent-hub source treats cross-bot tasks as a published shared state rather than a live editable folder: local authoring and verified accepted reads are separate, writes use ETags and shared-revision compare-and-swap, publication rejects malformed graphs, stale indexes, and deleted history, and interrupted batches retain a recovery journal. The implementation is early producer-authored software; Scout inspected static documentation, source, and tests but did not run it or verify multi-machine, remote-storage, crash, security, or agent behavior."
triggers: ["shared agent tasks", "accepted task state", "task publication", "cross-bot task coordination", "utsurigi-agent-hub"]
last_updated: "2026-11-11"
source_basis: "Pinned GitHub revision c41877fb24af7e289365f0ed6b43c5b072e3ad46. Scout inspected the complete README, BOT.md, TASKS.md, selected task implementation files, selected producer-authored tests, and a non-truncated 118-entry repository tree."
</ai_context>

# Shared agent tasks need an accepted publication boundary

**Observed:** 2026-11-11  
**Disposition:** New source-grounded finding  
**Question:** What must a shared task store preserve when several agents or machines can edit and consume the same work state?  
**Coverage:** Complete README, `BOT.md`, and `TASKS.md`; selected task implementation and producer-authored tests; non-truncated 118-entry repository tree. Static inspection only.

## Source

- **Repo:** [transparent-pegasus/utsurigi-agent-hub](https://github.com/transparent-pegasus/utsurigi-agent-hub)
- **Reviewed revision:** [`c41877fb24af7e289365f0ed6b43c5b072e3ad46`](https://github.com/transparent-pegasus/utsurigi-agent-hub/commit/c41877fb24af7e289365f0ed6b43c5b072e3ad46)
- **Inspected artifacts:** `README.md`, `BOT.md`, `TASKS.md`, `src/tasks.rs`, `src/task_import.rs`, `tests/tasks.rs`, and `tests/task_publication.rs`

## What the repository implements

Utsurigi Agent Hub externalizes data for several trusted bots under one owner. At the inspected revision, shared task management is mandatory and distinguishes two views of task state:

- a local **authoring store**, which may contain unpublished edits; and
- a verified shared cache used by `tasks list --accepted` and `tasks show --accepted`.

The normal accepted progress view deliberately lists only `in_progress` tasks. Pending work, service waits, user waits, and history require explicit status selection or a full inventory. The documentation therefore warns that an empty progress list is not proof that no queued or waiting work exists.

The task format records stable UUIDs, status, owner, parent, native schedule reference, due date, work directory, resource names, start dependencies, completion dependencies, current next step, notes, goals, and an append-only attributed work log. Completed and cancelled records move to an archive instead of disappearing. Reopening must pass through `pending`.

## The useful architectural pattern

The repository's strongest idea is not its Markdown schema. It is that shared task state becomes trustworthy only after a publication protocol:

1. **Separate editable state from accepted state.** Readers that need coordination state consume a verified generation, not whatever files currently exist in one bot's authoring directory.
2. **Make concurrent edits conditional.** `tasks show` returns a SHA-256 ETag over the exact task bytes; `tasks put` requires the observed ETag for updates. Cross-machine publication additionally uses a shared-revision compare-and-swap boundary.
3. **Validate the collection, not only one record.** Publication checks task references, archive placement, status transitions, cancellation propagation, parent cycles, dependency cycles, the `in_progress` index, and retained history before accepting a new generation.
4. **Preserve interrupted intent.** Multi-file changes use a `.pending.json` journal and recover forward before later authoring reads. A malformed journal stops for reconciliation instead of being silently discarded.
5. **Keep discovery views honest.** `INDEX.md` is a derived `in_progress` view, not the task database. Publication rejects a stale index, while completed and cancelled bodies remain archived for history.
6. **Treat migration as reconciliation.** Native Grok and Muse identifiers are scoped by source bot, imports are idempotent, reimport does not overwrite later shared edits, and native records remain until source-ID, state, relationships, logs, schedule references, publication, and a second bot's accepted read have been compared.

Producer-authored tests exercise several of these claims. They check that accepted reads require a verified cache, stale ETags have one winner, malformed graphs do not replace the previous task, interrupted archive moves recover without duplicate or lost records, publication rejects deleted history and stale indexes, and completed work is visible to another bot only through the published/synchronized shared state.

## Reusable interpretation

A multi-agent task system needs at least four distinct receipts:

- **authoring receipt:** what proposed task bytes one writer prepared;
- **conflict receipt:** which previously observed version authorized that update;
- **publication receipt:** which collection generation passed graph, transition, index, and retention checks;
- **consumption receipt:** which verified generation another agent actually read before acting.

Without those distinctions, a task file can look durable while remaining unpublished, a progress view can look empty while waits are hidden, and two agents can each act on locally coherent but mutually stale state. The repository also shows why task retention is part of coordination correctness: deleting closed history can erase dependency and migration evidence even when the current active index still looks valid.

For May-like agent systems, the particularly relevant question is not whether tasks are stored in Markdown, a database, or an event log. It is whether writers, publication, readers, and external schedulers bind their decisions to the same accepted generation and whether uncertain or interrupted transitions remain inspectable rather than being normalized away.

## Evidence limits

- Scout did not run the Rust CLI, its test suite, multiple bots, concurrent processes, remote object storage, live synchronization, backup, restore, or crash injection.
- The documentation and tests are producer-authored. Static inspection confirms represented contracts and test intentions, not production reliability or independent adoption.
- The project targets trusted bots under one owner. It does not establish a hostile multi-tenant authorization model, authenticated task authorship, Byzantine conflict handling, or non-bypassable control of external effects.
- ETags and shared-revision compare-and-swap reduce stale overwrites; they do not prove semantic merge correctness or prevent an authorized writer from making a bad change.
- Accepted-cache freshness depends on the sync protocol. A verified old generation can still be stale for a time-sensitive action.
- Task readiness does not establish resource availability, scheduler correctness, or effect settlement. The documentation explicitly keeps native schedulers outside the shared task store and says an already running external action cannot be forcibly stopped.
- Scout inspected selected task-related files rather than every one of the 118 tree entries, and did not audit cryptography, secrets, storage, backup, or the optional memory subsystem.
