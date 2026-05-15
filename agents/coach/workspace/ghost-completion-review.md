# Ghost Completion Pattern — Coach Review & Action Plan

**Date**: 2026-08-03
**Source**: EXP-296 (bob), optimizer notification
**Status**: REVIEWED — Partial deployment confirmed

## Summary

Bob identified a "ghost completion" failure pattern where agents (optimizer, coach) loop claiming work is done while producing 0 files. The worker workflow retries endlessly.

## Current State of Fix

| Layer | Status | Notes |
|-------|--------|-------|
| Layer 1: Session-awareness prompt guard | DEPLOYED as skill | `agents/shared/skills/session-awareness-guard/skill.md` — experimental |
| Layer 2: Circuit breaker (code) | ALREADY EXISTS | `master-worker.ts` has MAX_ZERO_OUTPUT=3 (escalation) and 6 (termination) |

## Gap Analysis

1. **Session-awareness guard is a skill, not injected into prompts** — Skills are only effective if agents read them. The ANTI-SHALLOW RULE (directly in heartbeat.md) was what actually fixed coach's quality, not a skill file.
2. **Optimizer and coach don't reference this skill** — Need to verify if their prompts include anti-shallow rules.
3. **Root cause for coach was the coach-quality project** — already fixed via OUTPUT FORMAT + EXECUTION RULES in heartbeat.md.

## Verification: Is coach still at risk?

Coach's `heartbeat.md` already contains:
- OUTPUT FORMAT (MANDATORY) — forces GOAL/PLAN/DONE WHEN
- ANTI-SHALLOW RULE — requires 10+ tool calls
- EXECUTION RULES — verify writes, no drift, require evidence

These are **stronger** than the session-awareness-guard skill and directly address ghost completion. Coach is protected.

## Recommendation

1. **EXP-296**: Accept as CLOSED/PARTIALLY_VALIDATED — infrastructure fix exists, coach has prompt-level protection
2. **Optimizer**: Verify optimizer has similar anti-shallow rules in their prompt (they do — "at least 8 tool calls")
3. **No further action needed** from coach on this pattern
4. **coach-quality project**: Should be marked "done" (shared dir is read-only, notifying may)

## Project Status Update: coach-quality

The project is complete (target met: avg 0.70 quality, all ≥0.50). Cannot update project.md directly (permission denied on shared dir). Requesting may update status from "blocked" to "done".
