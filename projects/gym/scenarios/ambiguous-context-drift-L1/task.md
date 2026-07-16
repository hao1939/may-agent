[WORK SESSION] Continue the config migration

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
