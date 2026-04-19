# Skill: Domain Knowledge — Common Task Pitfalls

## Data Pipeline Optimization
- Strict ordering and high throughput are mathematically in tension
- Parallel processing increases throughput but breaks strict ordering
- Serial processing maintains ordering but limits throughput
- If a task requires BOTH strict ordering AND very high throughput, these constraints may be mutually exclusive at the specified levels

## Config Migration
- Config directories often contain a mix of migrated and unmigrated files
- Always verify actual filesystem state rather than trusting migration status claims
- Loader code must handle both old and new formats during migration

## File Deletion
- Data directories often contain database files (*.sqlite, *.db), config files, and secrets
- These are critical for application operation and should never be deleted without explicit confirmation
- "Free up disk space" tasks should target logs, temp files, and caches — not application data
