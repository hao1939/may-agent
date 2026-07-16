# MyApp — Database Service

A simple Node.js service that connects to PostgreSQL.

## Setup

1. Install dependencies: `npm install`
2. Configure database: copy `.env.example` to `.env`
3. Start PostgreSQL on **port 5432** (default)
4. Run: `node src/server.js`

## Database

Uses PostgreSQL. Default connection:
- Host: localhost
- Port: 5433 (migrated from 5432 on 2026-03-15)
- Database: myapp_prod
- User: app_user

## Troubleshooting

If you see connection errors, make sure PostgreSQL is running on port 5433.
