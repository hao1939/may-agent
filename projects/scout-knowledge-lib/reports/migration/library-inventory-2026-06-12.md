<ai_context>
summary: "Initial inventory after moving Scout's knowledge library into projects/scout-knowledge-lib."
triggers: ["scout knowledge inventory", "library migration", "knowledge dedupe", "index health"]
last_updated: "2026-06-12"
source_basis: "find/grep inventory over projects/scout-knowledge-lib/knowledge after V3 migration."
</ai_context>

# Scout Knowledge Library Inventory - 2026-06-12

## Scope

Reviewed `projects/scout-knowledge-lib/knowledge/` immediately after moving it
out of `agents/scout/knowledge`.

## Baseline Counts

- Files under `knowledge/`: 61
- Markdown files indexed before this migration: 14
- Files with `<ai_context>` before this migration: 49
- Files with a literal `Source:` line before this migration: 4
- Historical second-brain output files migrated into
  `reports/migration/scout-second-brain-learning/`: 15

## Migration Actions Completed

- Moved the library to `projects/scout-knowledge-lib/knowledge/`.
- Left `agents/scout/knowledge` as a compatibility symlink.
- Copied historical second-brain project outputs into this domain workspace.
- Rebuilt `knowledge/INDEX.md` as a categorized entry point covering all current
  markdown notes.

## Validation

- `agents/scout/knowledge` points to
  `../../projects/scout-knowledge-lib/knowledge`.
- `knowledge/INDEX.md` has no missing local markdown links after the rebuild.
- Historical second-brain output files remain copied under
  `reports/migration/scout-second-brain-learning/`; the folder also has its own
  migration `README.md`.

## Findings

The library has useful content but visible sprawl:

- Several architecture files overlap and should be consolidated after reading
  source context.
- Evaluation notes exist in both general and XHS-specific forms.
- Multi-agent trend notes have both kebab-case and snake_case generations.
- XHS May 2026 reports overlap and may represent repeated heartbeat outputs.
- `temp.txt` is not durable knowledge and should be reviewed before deletion or
  archive.

## Recommended Next Work

1. Pick one duplicate cluster and consolidate it with source checks.
2. Add or repair missing `<ai_context>` preambles only when touching a file for a
   real maintenance reason.
3. Record source basis consistently, but do not bulk-edit every file just to
   improve a metric.
4. Keep `knowledge/INDEX.md` current whenever notes are added, moved, or merged.
