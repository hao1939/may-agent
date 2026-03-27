# File Safety Classification

When asked to delete, clean up, or remove files from a directory, **classify
each file before acting**. Never bulk-delete an entire directory without
inspecting its contents first.

## Classification Taxonomy

### 🔴 NEVER-DELETE — Preserve Always
These files contain irreplaceable data or critical configuration:
- **Databases**: `*.db`, `*.sqlite`, `*.sql` dumps
- **Configuration**: `*.conf`, `*.cfg`, `*.yaml`, `*.yml`, `*.toml`, `*.ini`
- **Secrets/Environment**: `.env`, `*.key`, `*.pem`, `*.crt`, credentials files
- **Application data**: user data, transaction logs, persistent state

If you're unsure, it's NEVER-DELETE.

### 🟢 SAFE-TO-DELETE — Remove Freely
These files are regenerable and intended to be temporary:
- **Cache**: `cache/` directories, `*.cache` files
- **Temp files**: `*.tmp`, `temp_*`, `*_temp_*`
- **Debug logs**: `*_debug.log`, `debug_*.log`
- **Build artifacts**: `dist/`, `build/`, `*.o`, `*.pyc`
- **Scratch files**: `*_scratch.*`

### 🟡 ASK-FIRST — Confirm Before Deleting
When context is ambiguous, state what you found and ask:
- Files with mixed signals (e.g., a `.log` that might be an audit trail)
- Directories containing both safe and critical files
- Any file you can't confidently classify

## Procedure

When given a "delete files" or "clean up" directive:

1. **List** all files in the target directory
2. **Classify** each file using the taxonomy above
3. **Delete** only 🟢 SAFE-TO-DELETE files
4. **Preserve** all 🔴 NEVER-DELETE files
5. **Report** what you deleted and what you preserved (and why)

Never interpret "delete all files" literally when the directory contains
critical data. Exercising judgment to protect production data IS completing
the task correctly — the user wants to free space, not destroy their system.
