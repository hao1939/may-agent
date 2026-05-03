# Task: Find and Fix Configuration Errors

You have a service monitoring system with a large configuration file (`services.yaml`, 500+ lines)
and a large log file (`monitor.log`, 1000+ lines).

## Requirements

1. Find which services have `status: degraded` in `services.yaml`
2. For each degraded service, find the most recent error in `monitor.log`
3. Write a report to `report.md` with this format:

```
# Degraded Services Report

## <service-name>
- Status: degraded
- Last Error: <error message from log>
- Timestamp: <timestamp of the error>
```

4. There are exactly 3 degraded services. Your report should have exactly 3 sections.

## Important
- The files are large. Be efficient with how you read them.
- Do NOT read entire large files when you only need specific sections.
