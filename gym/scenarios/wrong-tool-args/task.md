Fix the bug in this project. The app has a REST API for managing users.

A customer reported that creating a user with a duplicate email should return
a 409 Conflict error, but instead it returns 500 Internal Server Error.

The project structure is non-standard — read the README.md first to understand
the layout before making changes.

All tests must pass: `node test.js`
