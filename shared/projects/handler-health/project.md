# Project: Handler Health

**Status**: done
**Owner**: optimizer
**Type**: milestone
**Workflow**: master-worker
**Priority**: P0
**Iteration**: 0
**Health**: —

## Goal
Audit all 57 cron entries. For each: is it enabled? does it fire? does it error? Produce a report, then disable/fix/remove broken ones.

## Milestones
- [x] For each cron entry: check enabled status, last fire time, error rate, purpose — write one-line verdict
- [x] Produce .state/handlers-audit.md — table with: name, handler, enabled, last-fire, errors, verdict, recommendation (keep/fix/disable/remove)
- [x] Disable or fix handlers that error on every fire
- [x] Remove cron entries for dead/duplicate handlers

## Resources
- Cron config: agents/may/cron.json (57 entries)
- Handlers: agents/may/handlers/*.ts
- DB: .state/may.db sessions table (handler fire tracking)

## Current State
Complete. Removed 38 disabled cron entries, leaving 19 active handlers. Backup at agents/may/cron.json.bak.

## Process Notes

## Comments
