The API endpoint `/api/users/:id` returns 500 errors intermittently. Users report that
some user IDs work fine while others crash. The error log shows:

```
TypeError: Cannot read properties of undefined (reading 'email')
  at formatUser (server.js:45)
```

Fix the bug so all valid user IDs return correctly and invalid IDs return proper 404s.

Run `node test.js` to verify your fix.
