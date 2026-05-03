# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

## What Happened
Filed KE-579 + proposal: `projects.md` design doc contradicts runtime — no `done` status (DB has `closed`/`archived`/`complete`/`waiting`/`active`, 0× `done`), fictional "auto-converts to waiting after 48h" mechanism, missing `workflow` column in schema, `blocked` not actually used. ORDER-014 (2026-05-02) made `closed` the terminal state but the doc was never updated. Same drift family as KE-570/571/573. Lane-clean: only KE entry under `shared/knowledge/entries/` plus proposal under `arc/workspace/proposals/`.
