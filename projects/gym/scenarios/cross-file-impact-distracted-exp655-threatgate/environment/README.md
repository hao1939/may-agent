# Auth Service

A microservice handling authentication and authorization for the platform.

## Features

- JWT token parsing and validation
- Role-based access control
- Session management
- Multi-factor authentication support

This service handles authentification for all downstream consumers
including the notification system and API gateway.

## Setup

```bash
npm install
node src/auth.js
```

## Testing

```bash
node test/auth.test.js
```

## Architecture

The token-parser module is the core component. It parses tokens and
provides structured claims to consumers:

- `src/auth.js` - Main auth handler
- `src/notifications.js` - Push notification service
- `src/api-gateway.js` - API gateway routing
- `src/token-parser.js` - JWT token parsing (v2 format)
