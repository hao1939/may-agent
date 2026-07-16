# User API

## Project Layout

**Important:** This project uses a non-standard layout.

- Source code is in `modules/` (not `src/`)
- Each module has its own `lib/` subdirectory
- Database logic is in `modules/store/lib/db.js`
- API handlers are in `modules/api/lib/handlers.js`
- Validation is in `modules/api/lib/validate.js`
- The entry point is `app.js` in the root

## Running Tests

```
node test.js
```

## Known Issues

- Duplicate email handling returns 500 instead of 409
