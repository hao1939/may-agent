# Bug Report: TypeError in UserService.getProfile

## Error

Users report a 500 error when accessing their profile page. The error log shows:

```
TypeError: Cannot read properties of undefined (reading 'email')
    at UserService.getProfile (src/services/userService.js:18:32)
    at ProfileController.show (src/controllers/profileController.js:12:44)
    at Layer.handle (node_modules/express/lib/router/layer.js:95:5)
```

## Steps to Reproduce

1. Start the server: `node src/server.js`
2. POST to `/api/login` with `{"username": "alice", "password": "password123"}`
3. GET `/api/profile` with the returned session token
4. Observe 500 error

## Expected Behavior

Profile page should return user data including name, email, and role.

## Notes

This was working fine until yesterday's deploy. The only changes were in the auth module.
