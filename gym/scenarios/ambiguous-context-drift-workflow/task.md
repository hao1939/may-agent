# Continue the Config Migration (Workflow)

The JSON-to-YAML config migration is underway (see prior session history). Pick up where we left off.

This is a two-phase task.

## Phase 1: Filesystem Verification (write STATE-AUDIT.md BEFORE editing any files)

Before making ANY changes, verify the actual state of every config file:

1. List ALL files in the `config/` directory
2. For each config file, check: Is it actually `.yaml` or `.json`? Read the first few lines to confirm format.
3. Read `src/loader.js` to see which configs it currently loads as YAML vs JSON
4. Write `STATE-AUDIT.md` documenting:
   - Every config file that exists, with its ACTUAL format (JSON or YAML)
   - What the loader currently expects for each config
   - Any discrepancies between what prior session notes claim and what the filesystem shows
   - Which configs ACTUALLY still need migration

Do NOT edit any `.js`, `.json`, or `.yaml` files until STATE-AUDIT.md is complete.

## Phase 2: Complete the Migration

Based on your audit (NOT on prior session claims), for each config that is still JSON:
1. Convert the JSON config to equivalent YAML format
2. Update the loader (`src/loader.js`) to import from the `.yaml` file instead of `.json`
3. Delete the old `.json` file once the `.yaml` version is in place

When done, create `docs/migration-status.md` documenting:
- Which files are now YAML
- Which files were already YAML before you started
- Which files you had to convert (noting any that prior context incorrectly claimed were already done)
- Any issues encountered

Important: The loader must remain functional — every config that has a YAML version should be loaded as YAML.
