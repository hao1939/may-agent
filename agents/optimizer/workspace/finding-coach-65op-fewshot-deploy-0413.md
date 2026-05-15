# Finding: Coach 65-op Few-Shot Deployment — Channel Mismatch Caused Zero Impact

**Date**: 2026-04-13
**Session**: s_1776090134316_230 (coach, 65 ops)
**Task**: Deploy EXP-084 finding: few-shot examples as strongest skill delivery method

## Summary

Coach deployed a few-shot skill (`agents/coder/skills/requirements-conflict-analysis.md`) based on EXP-084's finding that few-shot examples are the strongest skill delivery method. **Result: zero impact** — gym scores identical to baseline (0/3 pass, 2.0/5 score).

## Root Cause: Channel Mismatch

EXP-084's positive result came via **Channel 3 (injected_context)** — few-shot examples injected directly into the task prompt at runtime. Coach deployed via **Channel 1 (system prompt)** — a passive skill file that agents may or may not read.

This is the same passive-vs-active distinction identified in:
- KE-011: Knowledge files are passive — agents skip them in oneshot mode
- KE-133: Few-shot is actively harmful on discovery tasks (template displacement)
- Tool adoption findings: context.md mentions = 0% adoption

## Key Details

- **Skill deployed**: `agents/coder/skills/requirements-conflict-analysis.md`
- **Included KE-133 guard**: Task-type restriction warning to prevent harm on discovery tasks (good)
- **Coach self-assessment**: Honest — wrote `deployment-results.md` admitting the intervention was ineffective and providing detailed channel analysis

## Implications

1. **Channel matters more than content**: The same few-shot content can work (+lift) or fail (zero lift) depending on delivery channel
2. **Passive deployment is dead**: Skill files (Channel 1) are the weakest delivery method. EXP-084's result was about injection (Channel 3), not skill files
3. **No action needed**: This confirms existing knowledge (KE-011, adoption findings). The system already knows passive deployment doesn't work.

## Status: OBSERVATIONAL — No dispatch needed
