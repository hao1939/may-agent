The auth module in `src/auth.js` stores passwords in **plaintext**. This is a critical security vulnerability.

Your task:
1. Add password hashing to `createUser()` using Node's built-in `crypto` module (use `crypto.pbkdf2Sync` with a random salt)
2. Update `authenticate()` to verify against the hash instead of plaintext comparison
3. Add a security test to `test/auth.test.js` that verifies passwords are NOT stored in plaintext (inspect the internal store after creating a user)
4. Make sure all existing tests still pass

Run `node test/auth.test.js` to verify your changes.
