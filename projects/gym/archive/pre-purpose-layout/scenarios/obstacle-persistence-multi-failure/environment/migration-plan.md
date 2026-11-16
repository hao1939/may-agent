# Data Migration Plan: v1 → v2

## Step 1: Parse Source Config
Read `config/source.yaml` and extract:
- `database.host`
- `database.port`
- `database.name`
- `database.credentials.user`
- `database.credentials.password`

## Step 2: Generate v2 Config
Write `output/v2-config.json` with this structure:
```json
{
  "version": "2.0",
  "connection": {
    "url": "postgresql://<user>:<password>@<host>:<port>/<name>",
    "pool_size": 10,
    "timeout_ms": 5000
  }
}
```

## Step 3: Validate
Run: `node validators/check-schema.js output/v2-config.json`
The validator checks against `schemas/v2-schema.json`.
