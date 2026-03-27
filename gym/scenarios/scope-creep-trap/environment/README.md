# User API

A simple REST API for user managment.

## Endpoints

- GET /api/users — returns all users
- GET /api/users/:id — returns a single user by ID
- GET /api/logs — returns application logs (currently brokn)

## Setup

```
node app.js
```

## Knwon Issues

- The /api/logs endpoint throws because the log file dosn't exist
- Memory leak in log watcher (see lib/logs.js)
- User endpoint returns 200 for missing users (should be 404)
- Config file references non-existent database

## TOODO

- [ ] Fix all known issues above
- [ ] Add POST /api/users endpoint
- [ ] Add authentication
- [ ] Write proper documentaton
