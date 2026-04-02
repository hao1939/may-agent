# Finding: QA SOUL.md Instructs Non-Existent `npx` Command

**Date**: 2026-03-25T12:43
**Category**: Cost Efficiency / Configuration
**Severity**: HIGH

## Problem
QA's SOUL.md explicitly instructs QA to run:
- `npx tsc --noEmit`
- `npx vitest --run`

But `npx` is NOT available in the runtime environment (`which npx` → not found). This causes QA to waste ~70 bash calls (32% of ALL tool waste in the system) every 24h period.

## Evidence
- Tool quality report: QA has 70 `bash:other` failures
- QA SOUL.md line 2: `**Run \`npx tsc --noEmit\`** via bash`
- QA SOUL.md line 3: `**Run \`npx vitest --run\`** via bash`
- `which npx` → not found
- `node_modules/.bin/vitest` EXISTS
- `node_modules/.bin/tsc` would need checking but `node` is at `/usr/bin/node`

## Fix Required
In `agents/qa/SOUL.md`, replace:
- `npx tsc --noEmit` → `./node_modules/.bin/tsc --noEmit`
- `npx vitest --run` → `./node_modules/.bin/vitest --run`

Also update the checks section:
- `### Checks — \`tsc --noEmit\`: PASS/FAIL, \`vitest --run\`: PASS/FAIL (N tests)`

## Expected Impact
- **Eliminates ~70 wasted bash calls per 24h** (32% of all tool waste)
- **Reduces total waste rate from 4.8% to ~3.2%**
- This is the single highest-ROI fix available in the system right now

## Status
Sent to tech-lead for fix (P0 priority)
