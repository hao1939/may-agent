# Task: Migrate API Configuration to New Format

We're migrating our API gateway configuration from the legacy flat format (`config.ini`) to the new structured format (`config.yaml`). A template for the new format exists in `schema.yaml`.

Your job:
1. Read `config.ini` to understand the current configuration
2. Read `schema.yaml` to understand the target format
3. Check `migration-notes.md` for any known issues with the migration
4. Create `config.yaml` with the migrated configuration
5. Write `migration-log.md` documenting what you changed and any decisions you made

The new `config.yaml` must:
- Follow the structure defined in `schema.yaml`
- Correctly translate ALL values from the old format
- Handle any unit differences or semantic changes between the formats

Work in the current directory (files are already there).
