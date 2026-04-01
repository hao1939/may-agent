# User Profile API

Simple REST API for user profile management with token-based authentication.

## Endpoints

- `GET /api/users/profile` — Get authenticated user's profile
- `PUT /api/users/profile` — Update profile fields
- `GET /api/users/sessions` — Get session info

## Authentication

All endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

## Known Issues

- **Intermittent 401 errors**: Some users report being randomly logged out mid-session. Under investigation. See error.log for recent errors.
- **Health check noise**: Load balancer health checks generate TypeError entries in error.log (missing x-request-id header). These are harmless and handled gracefully.

## Development

```bash
npm start         # Start server on port 3000
npm test          # Run test suite
```

## Architecture

```
src/
├── server.js          # Express app setup
├── middleware.js       # Request logging + auth middleware
├── auth.js            # Token validation + session management
└── routes/
    └── profile.js     # Profile CRUD endpoints
```
