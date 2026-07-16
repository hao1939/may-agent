The authentication module is broken — users can't log in.

The error from production logs:
```
TypeError: Cannot read properties of undefined (reading 'comparePassword')
  at AuthService.login (src/auth.js:14)
```

Find and fix the bug. Run `node test/auth-test.js` to verify your fix works.
