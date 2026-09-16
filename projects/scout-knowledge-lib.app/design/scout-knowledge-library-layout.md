# Scout Knowledge Library Layout

Design status: accepted

Source status: implemented and tested

Paths are relative to `/app/projects/scout-knowledge-lib` unless shown as
absolute paths.

## Plain Model

Use the existing readable layout:

```text
knowledge/
  README.md
  INDEX.md
  <canonical-or-companion-topic>.md
  findings/
    YYYY-MM-DD-<topic>.md
  inbox/                       # existing imported material
  insights/                    # existing specialized companions

reports/
  health/
  migration/
  merge/
  triage/
  operations/
```

This is the current contract, not a migration target. Do not create a
`knowledge/topics/` taxonomy or move findings into year/month/source folders.
Those moves would change many references without improving grounding or
retrieval.

## Placement Rules

- Search the library before creating a file.
- Update a canonical or companion topic note when one already fits.
- Otherwise write one flat dated file under `knowledge/findings/`.
- Use a report category for maintenance evidence and decisions.
- Keep `knowledge/README.md` short and human-facing.
- Keep `knowledge/INDEX.md` as the exhaustive map.
- Do not create reports at the `reports/` root.
- Do not create another project tree below
  `/app/projects/scout-knowledge-lib/projects/`.

Finding dates must reflect the real observation date and must not be later than
the current date. Source identity belongs in the finding content and evidence;
it does not require a source-specific directory.

## Requested assessment records

Keep a requested paper/post assessment in an existing source-and-question record
when it fits; otherwise use `knowledge/findings/YYYY-MM-DD-<topic>.md`. No separate
archive service or new directory tree is needed. A source record may link to a
canonical note; optional integration into that note does not replace the record
of what was assessed and why. Retain earlier assessment evidence when revisiting,
using explicit dated assessment entries in the same record, newest first and
earlier entries in expandable history. The procedural
source assessment selects an existing unambiguous source record, or uses
`YYYY-MM-DD-source-assessment-<source-hash>.md` with a readable paper/post title.
Its code-generated source-access section records retrieval and supplied-text
evidence independently of the model’s analysis; the latest assessment entry
addresses the latest question. A valid partial draft remains a saved assessment
with an explicit incomplete status and the reported evidence gap; saving it does
not establish fulfillment. Link targets retained from HTML identify references,
not additional sources that were fetched or assessed.

Include the question, stable source URL/ID and reviewed version, observation
date, actual reading coverage, key claims and supporting evidence, limitations,
relevance, related library links, and disposition (new knowledge, already covered,
out of scope, or access blocked). Verify the file and its references before
returning its path. A no-change revisit can return an existing verified record;
a caller's explicit no-save instruction permits returning without an archive.

## Document Roles

Canonical and companion topic notes hold reusable current knowledge. Findings
hold bounded source observations that may later be absorbed into those notes.
Reports explain maintenance work, migrations, merges, triage, or operational
decisions. Existing imported material remains under `knowledge/inbox/`; existing
specialized syntheses may remain under `knowledge/insights/`.

Historical material is not moved or deleted merely to make the tree smaller.
Any later preservation decision must show the replacement and verify references
before removing unique content.

## App Boundary

The app may observe layout facts and ask Scout for one bounded maintenance
judgment. It does not invent move batches, encode a taxonomy, or mutate task
state from filesystem counts. Source workflow output is accepted only when its
real path exists inside the resolved Scout knowledge or workspace roots.
