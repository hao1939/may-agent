# 2026-05-12 Heartbeat: Scout verify-after-write handler failures

## Signal

During routine dev heartbeat, active alerts were empty and core metrics were healthy, but recent handler-failure sampling found two `heartbeat-scout` failures in the last 24h with the same guard class:

- `C1.3 Verify-After-Write` for `agents/shared/knowledge/entries/KE-1251-shared-persistence-as-trust-laundering-surface.md` and `agents/scout/workspace/digest/today.md`.
- `C1.3 Verify-After-Write` for `agents/shared/knowledge/entries/KE-1238-kb-groundedness-erosion.md` and `agents/scout/workspace/digest/today.md`.

The latest 1h handler-failure count was `0`, so this is not an active incident.

## Current metric context

- `handler.success-rate` is healthy at `0.9955`.
- `session.error-rate-6h` is healthy at `0.0464`.
- `session.finish-blocked-unresolved-count-24h` is healthy at `0`.
- No active unresolved metric alerts were returned.
- No active metric lacked a snapshot in the last hour.

## Judgment

No patch is indicated in this heartbeat. The failures are same-class and worth remembering, but the guard message already names the exact recovery action, the latest hour is clean, and scout heartbeat guidance already includes read-back requirements for written artifacts.

## Follow-up trigger

Reopen if `heartbeat-scout` produces another `C1.3 Verify-After-Write` handler failure in the next 24h or if the same pair of paths (`shared/knowledge/entries/*` + `scout/workspace/digest/today.md`) becomes the dominant handler-failure source. At that point, inspect the scout heartbeat prompt and consider adding an explicit `write/edit -> read(each changed file) -> git status` closeout checklist near the KE/digest production instructions.
