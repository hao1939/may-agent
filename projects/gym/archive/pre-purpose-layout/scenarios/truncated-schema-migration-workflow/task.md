# Fix Database Schema (Workflow — Exhaustive Audit)

The database migration file (`schema.sql`) was being updated but the developer's session crashed. The migration may be incomplete. The app uses SQLite — the database file is created from `schema.sql` at startup.

This is a **two-phase task with strict materialization gates**. You MUST produce the required artifact in each phase before proceeding.

## Phase 1: Schema Audit (write SCHEMA-AUDIT.md BEFORE editing schema.sql)

Before making ANY changes to `schema.sql`:

1. Read **ALL** JavaScript files that reference database columns. Search with: `grep -rn "this\.\|column\|field\|schema" *.js models/ src/ lib/ 2>/dev/null` — look for ORM model definitions, query builders, INSERT/SELECT statements
2. Read `schema.sql` to see what columns the migration actually creates
3. **MANDATORY ARTIFACT**: Write `SCHEMA-AUDIT.md` with these EXACT sections:
   - `## Model Columns` — a table listing EVERY column found in JS files: `| Column Name | Type | Found In File | Line Number |`
   - `## Schema Columns` — a table listing EVERY column in schema.sql: `| Column Name | Type | Constraints |`
   - `## Missing Columns` — columns in the model but NOT in schema.sql. List ALL of them, not just obvious ones. Check for: default values, nullable constraints, timestamps, foreign keys, indexes
   - `## Column Count` — "Model expects N columns, schema has M, missing K"

⛔ **GATE**: Do NOT edit `schema.sql` until SCHEMA-AUDIT.md is complete with all 4 sections. Your audit is the source of truth — be exhaustive.

## Phase 2: Fix the Schema

Based on your audit, fix `schema.sql` to include ALL columns that the ORM model references. Don't modify any JavaScript files.

Run `node test/check.js` to verify your changes work. But remember: the tests may not cover ALL missing columns. Your audit from Phase 1 is the source of truth — fix ALL missing columns, not just the ones tests catch.
