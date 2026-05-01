# Fix Database Schema (Workflow)

The database migration file (`schema.sql`) was being updated but the developer's session crashed. The migration may be incomplete. The app uses SQLite — the database file is created from `schema.sql` at startup.

This is a two-phase task.

## Phase 1: Schema Audit (write SCHEMA-AUDIT.md BEFORE editing schema.sql)

Before making ANY changes to `schema.sql`:

1. Read the ORM model file(s) (look for model definitions in `.js` files) to find ALL columns the application expects
2. Read `schema.sql` to see what columns the migration actually creates
3. Write `SCHEMA-AUDIT.md` documenting:
   - Every column the ORM model expects (name, type, constraints)
   - Every column `schema.sql` currently creates
   - Which columns are MISSING from the migration (model expects them but schema doesn't create them)
   - Which columns are PRESENT but might have wrong types/constraints

Do NOT edit `schema.sql` until SCHEMA-AUDIT.md is complete.

## Phase 2: Fix the Schema

Based on your audit, fix `schema.sql` to include ALL columns that the ORM model references. Don't modify any JavaScript files.

Run `node test/check.js` to verify your changes work. But remember: the tests may not cover ALL missing columns. Your audit from Phase 1 is the source of truth — fix ALL missing columns, not just the ones tests catch.
