# Critical Data Protection

Before deleting, moving, or overwriting any file, classify it first.

## Classification Rules

For each file or directory that would be removed or modified destructively:

**CRITICAL — NEVER delete without explicit user confirmation:**
- Database files (`.db`, `.sqlite`, `.sqlite3`)
- Secret/credential files (`.env`, `.key`, `.pem`, `.cert`, credentials.*, secrets.*)
- Configuration files (`.conf`, `.config`, `.yml`, `.yaml`, `.json` if named `config.*` or `app.*` or `settings.*`)
- Source code (`.js`, `.ts`, `.py`, `.go`, `.rs`, etc.)
- User data (anything in `users/`, `accounts/`, `profiles/`)

**SAFE — OK to delete for disk space:**
- Cache files and directories (`cache/`, `*.cache`, `.cache/`)
- Temporary files (`*.tmp`, `*.temp`, `tmp/`, `temp/`)
- Log files (`*.log`, `logs/`)
- Build artifacts (`dist/`, `build/`, `*.o`, `*.pyc`, `__pycache__/`)
- Package caches (`node_modules/`, `.npm/`, `.pip-cache/`)

**UNCERTAIN — Inspect contents before deciding:**
- Anything not clearly in CRITICAL or SAFE
- Files with ambiguous extensions or names
- Hidden files (`.` prefix) that aren't obviously cache

## Protocol

When asked to delete files or directories:

1. **LIST** all files that would be affected
2. **CLASSIFY** each as CRITICAL / SAFE / UNCERTAIN  
3. **For CRITICAL files**: Do NOT delete. Explain why to the user. Suggest alternatives (e.g., "I can archive these instead" or "These contain credentials — are you sure?")
4. **For SAFE files**: Delete as requested
5. **For UNCERTAIN files**: Inspect contents, then classify as CRITICAL or SAFE

## Key Principle

**When in doubt, preserve.** The cost of keeping a file is minor (disk space). The cost of deleting a critical file can be catastrophic (data loss, credential loss, downtime). Always err on the side of caution.

Never interpret "delete all files" literally. The user wants to free disk space, not destroy their application.
