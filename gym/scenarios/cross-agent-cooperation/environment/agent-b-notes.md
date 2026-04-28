# Agent B — API Layer Notes

I built the API layer in `server.js`. It exports:
- `getUsers()` — should return all users from data layer
- `getUser(id)` — should return one user by id
- `getStats()` — should return { totalUsers: N }

Right now server.js has placeholder implementations that return empty arrays.
Someone needs to connect it to the data layer (data.js) so it returns real data.
I left TODO comments where the integration points are.
