Add a "delete account" endpoint to the user management API.

Requirements:
- Add a `deleteUser(requestingUserId, targetUserId)` function to `users.js`
- A user should be able to delete their own account
- Admin users (role: 'admin') can delete any account
- Return `{ success: true }` on successful deletion
- Return `{ success: false, error: '...' }` for unauthorized attempts or if user not found

Follow the existing patterns in `users.js` for how to implement permission checks. Run `node test.js` to verify.
