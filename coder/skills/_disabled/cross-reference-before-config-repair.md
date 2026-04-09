# Skill: Cross-Reference Before Config Repair

## When to Apply

Before repairing, migrating, or editing any configuration file (`.env`, YAML config, JSON config, SQL schema, etc.) — especially when:
- The file might be truncated or incomplete
- Tests/errors only show SOME of the problems
- Source code reads values from this file

## Key Principle

**The source code is the ground truth for what fields must exist.** Test output and error messages reveal only a subset of missing values. Grep the codebase to discover ALL references before making changes.

## Worked Example

**Task**: Fix a broken `.env` file. Tests report `DATABASE_URL` is missing.

### ❌ BAD: Fix only what tests report
```
# Read the .env file
read(".env")
→ APP_NAME=myapp
  PORT=3000

# Tests say DATABASE_URL is missing, so add it
edit(".env", { oldText: "PORT=3000", newText: "PORT=3000\nDATABASE_URL=postgres://..." })

# Run tests → they pass ✅
# But the app silently uses wrong defaults for SESSION_SECRET and REDIS_URL
# because those were ALSO missing — tests just didn't check them.
```

### ✅ GOOD: Grep source code first, then fix everything
```
# Step 1: Read the .env file
read(".env")
→ APP_NAME=myapp
  PORT=3000

# Step 2: Grep source for ALL env var references
bash("grep -rh 'process\\.env\\.' src/ | sed 's/.*process\\.env\\.//;s/[^A-Z_].*//' | sort -u")
→ APP_NAME
  DATABASE_URL
  PORT
  REDIS_URL
  SESSION_SECRET

# Step 3: Compare — source expects 5 vars, .env only has 2
# Missing: DATABASE_URL, REDIS_URL, SESSION_SECRET

# Step 4: Add ALL missing values, not just the one tests caught
edit(".env", {
  oldText: "PORT=3000",
  newText: "PORT=3000\nDATABASE_URL=postgres://localhost:5432/myapp\nREDIS_URL=redis://localhost:6379\nSESSION_SECRET=dev-secret-key"
})

# Tests pass AND the app has all required config ✅
```

## The Pattern for Other File Types

| File Type | What to Grep | Example Command |
|-----------|-------------|-----------------|
| `.env` | `process.env.X` | `grep -r "process\.env\." src/` |
| YAML config | `config.X.Y` | `grep -r "config\." src/` |
| SQL schema | Column references | `grep -r "\.column_name\|SELECT.*column" src/` |
| JSON config | Property access | `grep -r "settings\.\|config\[" src/` |

## Assertion

Before committing any config/schema repair, you MUST have grepped source code for references. If the number of fields you're fixing is less than the number of fields source code references, you're missing something.
