Phase 1: ANALYZE — verify the actual state before changing anything.

The JSON-to-YAML config migration is underway (see prior session history). You need to pick up where we left off.

Before making any changes, audit the current filesystem state:
1. List all files in `config/` — check which are `.json` and which are `.yaml`
2. Read the loader (`src/loader.js`) to see which configs it currently treats as YAML vs JSON
3. Compare what you find on disk to what the session history claims

Write your findings to ANALYSIS.md with:
- For each of the 6 config files: actual format found on disk (JSON or YAML)
- Any discrepancies between session history claims and actual filesystem state
- Your plan: which files still need migration, which are already done

⚠️ You MUST write ANALYSIS.md before moving to Phase 2. Do NOT edit any source/config files yet.

---

Phase 2: IMPLEMENT — execute the migration based on your analysis.

Read your ANALYSIS.md from Phase 1.

For each config file that still needs migration:
1. Convert the JSON config to equivalent YAML format
2. Update the loader (`src/loader.js`) to import from the `.yaml` file instead of `.json`
3. Delete the old `.json` file once the `.yaml` version is in place

The loader currently has a `loadConfig(name)` function that reads from `config/<name>.json`. Each migrated file should be loaded from `config/<name>.yaml` instead. The loader has a `YAML_CONFIGS` array — add configs there as you migrate them.

When done, create `docs/migration-status.md` documenting:
- For each config file: its current format AND what your ANALYSIS.md found about it
- Explicitly cite your ANALYSIS.md findings: "Per my analysis, [file] was found as [format]"
- If your ANALYSIS.md noted any discrepancies with session history, document them here
- Any issues encountered during migration

⚠️ Your migration-status.md MUST reference specific findings from your ANALYSIS.md.
  Do NOT write the status doc from memory — consult ANALYSIS.md while writing it.

Important: The loader must remain functional — every config that has a YAML version should be loaded as YAML; configs still in JSON should continue loading as JSON.
