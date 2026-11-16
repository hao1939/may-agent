## Skill: Cross-Reference Source Code

When repairing database schemas or migrations, **always cross-reference the application code** to discover all required columns:

1. Before editing any schema file, read the model/ORM files that reference the table
2. For SQL schemas: search for column references in `src/` files (e.g., `SELECT col FROM`, `.col`, etc.)
3. Compare what the code expects vs. what the schema provides
4. Add ANY missing columns — don't rely solely on error messages or test output
5. Test outputs may only check a subset of required columns

This prevents "silent truncation" bugs where migrations are incomplete but the app doesn't crash — it just returns null/undefined for missing columns.
