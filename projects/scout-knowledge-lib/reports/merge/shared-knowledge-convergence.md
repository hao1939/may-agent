# Shared Knowledge Merge Cleanup

Date: 2026-07-09

## Decision

The target state is one clean Scout knowledge library, not a permanent pointer
from Scout to `/app/shared/knowledge`.

The cleanup should move toward the layout described by
`projects/scout-knowledge-lib.app/design/scout-knowledge-library-layout.md`:
durable knowledge in topic notes, raw observations in findings, maintenance
decisions in reports, and old provenance in archive.

`/app/shared/knowledge` currently contains useful knowledge, but also a large
amount of old working material. The cleanup should merge useful content into
Scout-owned canonical notes, reports, or curated appendices, then remove old
source files after their references are migrated.

Do not bulk-copy all 6,147 shared markdown files into Scout. That would move the
mess instead of cleaning it. Merge means:

1. Decide which shared files contain durable Scout knowledge.
2. Absorb that knowledge into existing Scout notes where possible.
3. Create a Scout report or appendix only when the content is too large for a
   canonical note.
4. Update references away from `/app/shared/knowledge`.
5. Delete or archive the migrated source files only after the replacement path
   is recorded.

## Initial Inventory Snapshot

Snapshot from 2026-07-09:

| Shared area | Count | Merge treatment |
|-------------|-------|-----------------|
| `entries/` | 1,628 markdown files | Merge by curated KE ranges into Scout operational-diary sections or topic notes. Do not preserve every file as a separate Scout file. |
| `library/` | 3,659 markdown files | Merge durable syntheses and deep dives into existing Scout canonical notes or companion reports. Large journals and scan logs should be compressed before removal. |
| `experiments/` | 467 markdown files | Keep only results that support Scout claims. Merge summaries into evaluation, memory, workflow, or governance notes. |
| `hypotheses/` | 159 markdown files | Merge validated or still-useful hypotheses into Scout topic notes; drop stale proposal-only material after review. |
| `findings/` | 152 markdown files | Merge only durable findings; raw event findings should be removed once covered. |
| `synthesis/` | 28 markdown files | High-value first merge candidates. These are compact enough to review and absorb early. |
| `archive/` | 22 markdown files | Usually delete after confirming no unique durable content remains. |
| `fewshot-examples/` | 9 markdown files | Merge into Scout workflow/evaluation knowledge if still useful. |
| `conventions/`, `designs/`, `incidents/`, `specs/`, `summaries/`, `views/` | small directories | Merge only if still used by current agent-system behavior. |

## Safe Removal Rule

A shared file can be removed only when at least one of these is true:

- its useful content is merged into a Scout note/report and the replacement path
  is recorded;
- it is byte-for-byte or semantically redundant with an existing Scout artifact;
- it is obsolete working material and no current code, agent prompt, task, or
  evaluation criterion depends on it.

Before deleting a directory, update references in active code/docs/prompts that
still mention the old path.

## First Merge Batches

Use small batches so each deletion is reviewable:

1. Completed: merged `/app/shared/knowledge/synthesis/` into Scout canonical
   notes/reports and removed the migrated directory.
2. Completed: merged legacy KE-001 through KE-090 into Scout-owned knowledge
   and removed 102 old source files from `/app/shared/knowledge/entries/`.
3. Review large shared library files such as `library/discoveries.md`,
   `library/insights-cn.md`, `library/papers.md`, and `library/repos.md`;
   compress durable content into Scout companion reports before removal.
4. Migrate references in agents, evaluation criteria, and gym scenarios from
   `shared/knowledge` to the new Scout-owned locations.

## Current Blocker

There are many live references to `shared/knowledge` outside Scout. Deleting the
old directory before reference migration would break active agents and tests.

The next valid work is another merge batch: choose one shared directory or
well-bounded file group, merge its durable content, update references, then
remove the source files that are proven replaced.

## Completed Merge Batches

- 2026-07-09: `shared/knowledge/synthesis/` -> `reports/merge/shared-synthesis-merge-2026-07-09.md`; removed 28 source files.
- 2026-07-09: legacy `shared/knowledge/entries/KE-001` through `KE-090` -> `reports/merge/shared-ke-001-090-merge-2026-07-09.md` plus existing Scout topic notes; removed 102 source files.
- 2026-07-09: shared `conventions/`, `designs/`, `incidents/`, `specs/`, `summaries/`, and `views/` -> `reports/merge/shared-operations-small-dirs-merge-2026-07-09.md`; removed 8 source files.

After these three batches, `/app/shared/knowledge` has 6,009 markdown files
remaining. The next cleanup should continue with another bounded batch rather
than a bulk move.
