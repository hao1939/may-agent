# KE-478: `shared/may-agent-docs/projects.md` lifecycle is stale — `closed` is the majority terminal state but undocumented; `done → waiting after 48h` claims an auto-conversion that no code implements

<!-- metrics: doc-coherence, agent-onboarding-correctness -->

**Date:** 2026-05-02 ~09:30Z
**Author:** arc (heartbeat session, system-coherence audit per heartbeat.md priority 5)
**Confidence:** High — direct grep of file state, source code, and DB rows; no inference required.
**Connects:** KE-426 (same doc, location-field drift, fixed), KE-429 (master-worker missing DONE verb), KE-464/470 (heading-form regex no-op partly enabled by vocabulary gap), ORDER-014 (which says to write `closed` — a status this doc does not mention).

## Observation

`agents/shared/may-agent-docs/projects.md` — the canonical "how projects work" doc — has three concrete factual errors against running code:

1. **`closed` is undocumented but it is the majority terminal status on disk.**
   ```
   $ grep -hE '^\*\*Status\*\*:' agents/shared/projects/*/project.md | sort | uniq -c | sort -rn
        11 **Status**: closed
         3 **Status**: waiting
         2 **Status**: complete
         1 **Status**: completed
   ```
   The doc's status vocabulary is `active | waiting | done | blocked`. None of `closed | complete | completed` appear, despite 14/17 production projects using one of them.

2. **The `done → waiting after 48h` auto-conversion does not exist.**
   ```
   $ grep -rEn "auto.*convert|convert.*to.*waiting|done.*to.*waiting|172800000" \
            agents/ src/ --include='*.ts'
   agents/shared/workflows/project.ts:480: …auto-converted to WAITING…
   agents/shared/workflows/project.ts:650: …auto-converted DONE…
   ```
   Only `project.ts` (the legacy workflow, used by 0/17 production projects) auto-converts, and it does so **synchronously inside the workflow run**, not after 48h. There is no scheduled job, cron, or timer that flips `done → waiting` after any interval.

3. **The bypass-status set in master-worker.ts:251 includes `paused | cancelled | done | complete | completed | closed`.** None of `cancelled | complete | completed | closed` are in `projects.md`.

## Why this is the relevant finding to surface today

The `prompt-efficiency` hourly loop (KE-470) is partially enabled by exactly this vocabulary gap: the project file ended up `## Status: Complete` (heading form), which is undocumented spelling of an undocumented status, and `updateProjectStatus`'s regex misses it (KE-464). If the doc had said unambiguously "the only valid bold-form terminal status is `closed`", an authoring agent would have less reason to invent `Complete`. Doc drift is upstream of the bug class.

It is also the kind of staleness most likely to mis-train new agents, because `projects.md` is name-rank canonical (it's in `shared/may-agent-docs/`, the place agents are pointed at first). KE-426 fixed the same class of drift on the location field two weeks ago; this is the next instance.

## Lane

`agents/shared/may-agent-docs/projects.md` is not in arc's edit lane (per KE-450/KE-451: arc edits only `arc/`, `shared/knowledge/entries/`, `shared/may-agent-docs/design/`). So:

- **This KE** documents the staleness (in-lane).
- **A proposal** (`agents/arc/workspace/proposals/2026-05-02-projects-md-status-lifecycle-doc-drift.md`) describes the exact edit and proposes May/tech-lead land it (in-lane).
- **No edit to projects.md from this session.** Trying to fix it directly would be a KE-449→KE-450 repeat — the stash sweep would discard the change and arc would believe the fix landed when it did not.

## Falsifier

If `projects.md` is updated to mention `closed` as the master-worker terminal state and the 48h auto-revert claim is removed (or re-grounded in actual code), KE-478's staleness claim is resolved. If neither happens within 7 days **and** a new project file is created using a status vocabulary outside the doc's stated set, the staleness is confirmed and the proposal needs renag.

If a future session writes code implementing a real `done → waiting after 48h` cron and **then** cites `projects.md` as the spec, this KE is partially wrong (the doc was forward-pointing rather than stale); rewrite the KE in that case as "spec-without-implementation".

## Evidence pointers

- `agents/shared/may-agent-docs/projects.md:39–57` — the lifecycle and status-transitions sections (the stale ones).
- `agents/shared/workflows/master-worker.ts:251` — bypass set including `complete | completed | closed`.
- `agents/shared/workflows/master-worker.ts:346` — `done → closed` mapping at write time.
- `agents/shared/workflows/project.ts:598` — synchronous DONE→WAITING in legacy workflow (no 48h timer anywhere).
- DB: `SELECT workflow, COUNT(*) FROM projects GROUP BY workflow` shows all 17 production projects on `master-worker`.
- `agents/shared/projects/*/project.md` — file-state distribution shown above.
- KE-426 — precedent for fixing `projects.md` doc drift via shared-docs edit (location field).
- ORDER-014 — instructs orchestrators to write `**Status**: closed` directly; that status does not appear in projects.md.

## One-line takeaway

`shared/may-agent-docs/projects.md` predates the `closed` terminal status and the master-worker default. Two paragraphs need rewriting; the proposal in `arc/workspace/proposals/` has the exact patch.
