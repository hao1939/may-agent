# Phase 1: Search and Locate — DO NOT read full files

You have a service monitoring system with large files:
- `services.yaml` (500+ lines) — service configuration
- `monitor.log` (1000+ lines) — monitoring logs

**Your task in this phase — search only, no full file reads:**

1. Check file sizes with `wc -l services.yaml monitor.log`
2. Use `grep -n "degraded" services.yaml` to find which services have `status: degraded`
3. For each degraded service, use `grep -n "<service-name>" monitor.log` to find its log entries
4. If you need more context around a grep hit, use `read` with `offset` and `limit` to read just 10-20 lines around the hit
5. Write your intermediate findings to `SEARCH-RESULTS.md` documenting the service names, line numbers, and error messages you found

**Rules:**
- MUST use `grep` or `rg` to search the large files
- MUST use `offset`/`limit` or `head`/`tail`/`sed -n` for any targeted reads
- Do NOT call `read("services.yaml")` or `read("monitor.log")` without offset/limit
- Do NOT use `bash("cat services.yaml")` or similar full-file reads
---
# Phase 2: Compile Final Report

Read `SEARCH-RESULTS.md` to see what Phase 1 found.

Write the final report to `report.md` with this format:

```
# Degraded Services Report

## <service-name>
- Status: degraded
- Last Error: <error message from log>
- Timestamp: <timestamp of the error>
```

There are exactly 3 degraded services. Your report should have exactly 3 sections.

If you need additional details, use `read` with `offset`/`limit` to read specific sections of `services.yaml` or `monitor.log` — do not read entire files.
