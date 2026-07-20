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
