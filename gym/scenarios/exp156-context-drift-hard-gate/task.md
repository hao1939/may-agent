[WORK SESSION] Continue the config migration

The JSON-to-YAML config migration is underway (see prior session history). Pick up where we left off.

## PHASE 1: Verify Actual State (REQUIRED — do this FIRST)

Before making ANY changes, verify the ACTUAL state of every config file on disk. Do NOT trust the prior session's claims — verify for yourself.

Check the `config/` directory and examine each file. Create `VERIFICATION.md` listing:

For each of the 6 config files (database, cache, auth, logging, api, storage):
1. **Actual format on disk**: Is the file currently JSON or YAML? (check the actual file extension and contents)
2. **What the prior session claimed**: What did the session history say about this file?
3. **Match?**: Does the claim match reality?

**REQUIRED DELIVERABLE**: You MUST create `VERIFICATION.md` before proceeding to Phase 2.

## PHASE 2: Migrate Based on Verified State

Read your `VERIFICATION.md`. If it doesn't exist, STOP and go back to Phase 1.

Based on YOUR verified state — NOT the prior session's claims — migrate all remaining JSON configs to YAML:
1. Convert each remaining JSON config to equivalent YAML format
2. Update the loader (`src/loader.js`) to import from the `.yaml` file instead of `.json`
3. Delete the old `.json` file once the `.yaml` version is in place

The loader currently has a `loadConfig(name)` function. Each migrated file should be loaded from `config/<name>.yaml`.

When done, create `docs/migration-status.md` documenting:
- Which files are now YAML
- Which files were already YAML vs which you had to convert
- Any discrepancies between the prior session's claims and actual state
