---
id: handler-reliability
owner: tech-lead
status: closed
type: archive
priority: P0
iteration: 3
---

# Project: Handler Reliability


## Goal
Fix two infrastructure failures: verify-wrap workflow missing (reflect/optimize handlers failing) and gym runner script missing (coach experiments blocked).

## Metrics
- handler.success-rate: was failing → fixed (verify-wrap restored)
- gym runner: was missing → created

## Current State
Both issues fixed. verify-wrap.ts created, run-gym.sh created, all cron handlers succeed.

## Plan
- [x] Create verify-wrap.ts workflow
- [x] Create run-gym.sh script
- [x] Verify all cron handlers succeed

## References

**Artifacts:**
- agents/shared/workflows/verify-wrap.ts
- agents/test/gym/run-gym.sh
