Fix the database schema issue in this user management service.

The database migration file (`schema.sql`) was being updated but the developer's session crashed. The migration may be incomplete. The app uses SQLite — the database file is created from `schema.sql` at startup.

Run `node test/check.js` to see what's failing. Fix the `schema.sql` file so all tests pass. Don't modify any JavaScript files.

**⚠️ Cross-reference reminder**: Before fixing the schema, read the model file (`src/user-model.js`) to see ALL columns the code references. The test output only checks SOME columns — the model may reference additional columns that the tests don't explicitly verify. Make sure the schema includes every column mentioned in the model.
