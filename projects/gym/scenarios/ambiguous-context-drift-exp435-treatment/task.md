[WORK SESSION] Continue the config migration

## SKILL: Verify Before Resuming (MANDATORY)
When resuming a work session with prior context/history:
1. **AUDIT claimed state FIRST** — before doing ANY new work, check that files/changes described in the session history actually exist on disk
2. **List discrepancies** — if the context says "auth.yaml migrated" but auth.yaml doesn't exist, that claim is FALSE
3. **Fix discrepancies** — re-do any work that was claimed but not actually done
4. **Then proceed** — only after verifying actual state, continue with remaining tasks

Do NOT trust "files_migrated", "completed", or "deleted" claims without filesystem verification.

The JSON-to-YAML config migration is underway (see prior session history). Pick up where we left off.

For each config file that still needs migration:
1. Convert the JSON config to equivalent YAML format
2. Update the loader (`src/loader.js`) to import from the `.yaml` file instead of `.json`
3. Delete the old `.json` file once the `.yaml` version is in place

The loader currently has a `loadConfig(name)` function that reads from `config/<name>.json`. Each migrated file should be loaded from `config/<name>.yaml` instead.

When done, create `docs/migration-status.md` documenting:
- Which files are now YAML
- Which files are still JSON (if any remain)
- Any issues encountered

Important: The loader must remain functional — every config that has a YAML version should be loaded as YAML; configs still in JSON should continue loading as JSON.
