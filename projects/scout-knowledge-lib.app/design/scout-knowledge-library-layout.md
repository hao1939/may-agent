# Scout Knowledge Library Layout

Status: working target layout

Paths in this document are interpreted from the canonical domain workspace
`/app/projects/scout-knowledge-lib`; the target tree includes the workspace
name only for orientation. Workflow prompts use the resolved absolute root and
do not prepend these paths to their current directory.

## Plain Model

The library should be organized by why someone opens a document.

```text
I need the current reusable answer        -> topic note
I need the raw source/event observation   -> finding
I need to understand maintenance work     -> report
I need old provenance, not daily reading  -> archive
```

The current library still mixes these shapes in some folders. That makes the
library hard to scan and makes agents create new files because they cannot see
where an existing idea belongs.

The app should keep the library readable by enforcing simple placement rules,
not by creating a heavy taxonomy.

## Target Layout

```text
projects/scout-knowledge-lib/
  knowledge/
    README.md
    INDEX.md
    topics/
      architecture/
      evaluation/
      runtime-hardening/
      security-governance/
      protocols/
      coordination/
      memory-context/
      xhs/
      system-synthesis/
    findings/
      2026/
        06/
          arxiv/
          hn/
          xhs/
          github/
          cross-source/
        07/
          arxiv/
          hn/
          xhs/
          github/
          cross-source/
    archive/
      superseded/
      imported/
  reports/
    health/
    migration/
    merge/
    triage/
    operations/
```

This is a target, not a command to move everything at once.

## Document Types

### Topic Notes

Topic notes are durable reusable knowledge. They answer: "What do we currently
believe?"

Examples:

- agent architecture;
- evaluation;
- runtime hardening;
- security and governance;
- protocols;
- coordination;
- memory and context;
- XHS trends;
- system-level syntheses.

Rules:

- Each topic folder has a `README.md`.
- The folder `README.md` tells humans which file is canonical and which files
  are companion material.
- New durable claims should update an existing topic note before creating a new
  topic file.
- Oversized topic files should split into canonical plus companion notes inside
  the same topic folder.

### Findings

Findings are source/event observations. They answer: "What did we see?"

Rules:

- Findings go under `knowledge/findings/YYYY/MM/source/`.
- The source folder is one of `arxiv`, `hn`, `xhs`, `github`, or
  `cross-source`.
- Findings must keep source evidence and date context.
- Findings can stay raw until absorbed, but `INDEX.md` or a topic note should
  eventually say whether they are covered, partially covered, or still pending.

### Reports

Reports explain library maintenance work. They answer: "What did we change or
decide about the library?"

Rules:

- Health packets and health writeups go under `reports/health/`.
- Migration and import work goes under `reports/migration/`.
- Shared-knowledge merge batches go under `reports/merge/`.
- Inbox/source triage goes under `reports/triage/`.
- Process and operations notes go under `reports/operations/`.
- Reports may summarize many old files, but should not become the main place
  for durable topic knowledge.

### Archive

Archive is provenance that should not be a normal reading path.

Rules:

- Superseded Scout-local docs go under `knowledge/archive/superseded/`.
- Imported or preserved raw material goes under `knowledge/archive/imported/`.
- Archive files should have a short pointer to the replacement if one exists.

## Human Navigation

`knowledge/README.md` should be the human landing page.

It should be short:

- what this library is for;
- the topic map;
- how to add new knowledge;
- where findings and reports live;
- current cleanup/migration status.

`knowledge/README.md` is for humans. `knowledge/INDEX.md` is the exhaustive
machine-friendly map. Both are useful, but they should not do the same job.

`knowledge/INDEX.md` can remain machine-friendly and exhaustive. It should not
be the only way a human or agent finds the right file.

## App Responsibilities

`scout-knowledge-lib.app` should organize the library by creating small,
repeatable maintenance work:

- detect files in the wrong place;
- detect top-level topic files that should move under `topics/`;
- detect findings that are not under `findings/YYYY/MM/source/`;
- detect reports that are still in the root `reports/` folder;
- detect missing topic `README.md` files;
- detect references that still point to moved paths;
- update the task tree with a bounded move batch when the same issue repeats.

The app should not bulk-move hundreds of files in one step. A good move batch
has:

1. a clear source scope;
2. a replacement path;
3. reference migration;
4. verification that old paths are gone or intentionally archived;
5. a report when the batch changes library structure.

The app must never create a second project tree below
`/app/projects/scout-knowledge-lib/projects/`. Output paths are resolved and
checked against the domain `knowledge/` and `reports/` roots before a result is
accepted. Existing nested files are reviewed and compared before removal; path
cleanup is not permission to discard unique findings.

## Migration Order

Use low-risk moves first:

1. Create `knowledge/README.md` and the empty target folders.
2. Move `reports/shared-*-merge-*.md` to `reports/merge/` and health reports to
   `reports/health/`.
3. Move inbox/source triage reports to `reports/triage/`.
4. Move findings by month and source.
5. Move topic notes into `knowledge/topics/*/` one topic at a time.
6. Archive superseded top-level notes after each topic folder has a readable
   `README.md`.

This order makes the layout clearer immediately without risking the core topic
links first.

## Acceptance For A Layout Batch

A layout batch is done only when:

- files moved into the target folder;
- active references updated;
- `knowledge/README.md` or the relevant topic `README.md` reflects the move;
- `knowledge/INDEX.md` still points to the right files;
- checks or targeted greps show the old active paths are not used.
