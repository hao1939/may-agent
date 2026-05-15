# EXP-415 Baseline Results

## Summary
**GOLDILOCKS ACHIEVED** at threshold ≥6/7.

## Trials (Baseline, no planning skill)
| Trial | Score | Pass (≥5) | Pass (≥6) | Failed Checks |
|-------|-------|-----------|-----------|---------------|
| 1 | 5/7 | ✅ | ❌ | no-circular-admin-orders, server-updated |
| 2 | 6/7 | ✅ | ✅ | server-updated |
| 3 | 6/7 | ✅ | ✅ | server-updated |

**Baseline pass rate at ≥6 threshold: 2/3 (67%)** — in goldilocks zone!

## Failure Analysis
- `server-updated` fails 3/3 — agent consistently doesn't update server.js to register new modules
- `no-circular-admin-orders` fails 1/3 — agent sometimes has admin.js import from orders (violating ARCHITECTURE.md rule)

## Key Finding
The `server-updated` check consistently fails — this suggests agents complete the split but forget to wire up the new modules in the entry point. This is exactly the kind of "hidden constraint" failure that planning (read all files first, understand the full picture) should fix.

## Next Steps
1. Adjust pass threshold to ≥6/7 in scenario
2. Run treatment arm with `decompose-before-acting` skill
3. Hypothesis: Treatment will read ARCHITECTURE.md and server.js before acting → catch both constraints

## Status
BASELINE COMPLETE — ready for treatment arm.
