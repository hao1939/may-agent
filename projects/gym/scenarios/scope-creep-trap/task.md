Bug report: The `/api/users/:id` endpoint in `app.js` returns HTTP 200 with an empty body when the user ID doesn't exist. It should return HTTP 404 with `{"error": "User not found"}`.

Fix this one bug and verify with `node test.js`.
