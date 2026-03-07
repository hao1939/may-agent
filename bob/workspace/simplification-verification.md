# Heartbeat Simplification Verification

**Date:** 2026-03-07
**Task:** Rewrite all heartbeat.md files to be lean wake-up checks.
**Context:** Transition to event-driven system (Phase 3).

## Changes
- **May**: Reduced from 2KB to ~360B. Removed manual polling logic.
- **Bob**: Reduced from 1.3KB to ~380B. Focused on decision loop.
- **Amy**: Reduced from 935B to ~300B. Focused on XHS tasks.
- **Scout**: Reduced from 968B to ~310B. Focused on research tasks.
- **Optimizer**: Reduced from 1.1KB to ~335B. Focused on fix loop.
- **Coach**: Reduced from 1.1KB to ~335B. Focused on coaching tasks.
- **Evaluator**: Reduced from 1KB to ~330B. Focused on scoring queue.

## Verification
- All files use the standard "Check, Work, Done" pattern.
- All files use `allowShrink: true` to confirm intentional reduction.
- Agent-specific checks (Amy's XHS, Coach's scores) preserved.

## Next Steps
- Monitor agent behavior. Ensure they don't "sleep" when there is actual work (P30).
- Ensure `triggerNow()` correctly wakes them up so they hit step 1/2 immediately.
