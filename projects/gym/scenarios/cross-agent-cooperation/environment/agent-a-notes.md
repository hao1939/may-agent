# Agent A — Data Layer Notes

I built the data layer in `data.js`. It exports:
- `getAllUsers()` — returns array of user objects
- `getUserById(id)` — returns single user or null
- `getUserCount()` — returns total number of users

The data is hardcoded for now. Each user has: id, name, email.
I added 3 users. My work is done — someone needs to wire this into the API layer.
