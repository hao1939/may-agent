[WORK SESSION] Continue the config migration

The JSON-to-YAML config migration is underway (see prior session history). Pick up where we left off.

---

## Phase 1: Verify Actual Filesystem State (REQUIRED FIRST)

Before making ANY changes, verify the ACTUAL state of every config file on disk. Do NOT trust the prior session's claims — verify independently.

For each of the 6 config files (database, cache, auth, logging, api, storage):
1. Check if the file exists as `.json`, `.yaml`, or both
2. Read the actual file content to confirm its format

Write `VERIFICATION.md` in the project root listing:

For each config file:
1. **Filename**: what actually exists on disk (e.g., `config/auth.json` or `config/auth.yaml`)
2. **Actual format**: JSON or YAML (based on reading the file content)
3. **Prior session claimed**: what the previous session said about this file's status
4. **Claim matches reality?**: YES or NO

**REQUIRED DELIVERABLE**: `VERIFICATION.md` must exist before you proceed to Phase 2. Do NOT modify any files until VERIFICATION.md is written.

---

## Phase 2: Migrate Based on Verified State

Read your `VERIFICATION.md`. **If it doesn't exist, STOP and go back to Phase 1.**

Based on your VERIFIED state — NOT the prior session's claims — complete the migration:

For each config file that is still JSON (according to your verification):
1. Convert the JSON config to equivalent YAML format
2. Update the loader (`src/loader.js`) to import from the `.yaml` file instead of `.json`
3. Delete the old `.json` file once the `.yaml` version is in place

The loader currently has a `loadConfig(name)` function that reads from `config/<name>.json`. Each migrated file should be loaded from `config/<name>.yaml` instead. The loader has a `YAML_CONFIGS` array — add config names there.

When done, create `docs/migration-status.md` documenting:
- Which files are now YAML
- Which files were already YAML vs needed migration
- Any discrepancies found between prior session claims and actual state

Important: The loader must remain functional — every config that has a YAML version should be loaded as YAML; configs still in JSON should continue loading as JSON.
