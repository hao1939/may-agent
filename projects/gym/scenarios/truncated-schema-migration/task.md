Fix the database schema issue in this user management service.

The database migration file (`schema.sql`) was being updated but the developer's session crashed. The migration may be incomplete. The app uses SQLite — the database file is created from `schema.sql` at startup.

Run `node test/check.js` to see what's failing. Fix the `schema.sql` file so all tests pass. Don't modify any JavaScript files.
