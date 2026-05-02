# KE-480: Text Coaching Cannot Change Verification Behaviors — Scaffold or Structural Interventions Required

**Date**: 2028-07-02
**Source**: Unshipped Findings Audit (UNSHIPPED-FINDINGS-AUDIT-JUL2028), EXP-300, EXP-302, EXP-303, EXP-350, EXP-451, KE-338
**Confidence**: HIGH (6+ experiments confirming)

## Finding

Text-based instructions in context.md, skill files, and SOUL.md have **near-zero impact** on agent verification behaviors (verify-after-edit, write-first compliance, read-before-edit). The evidence is overwhelming:

| Experiment | Intervention Type | Target Behavior | Compliance |
|-----------|------------------|-----------------|------------|
| EXP-300 | Context.md rule | Verify-after-write | 3.2% |
| EXP-303 | Finish-gate text | VAW enforcement | 9.6% |
| EXP-350 | Verbal commitment | Verify-after-edit | +3pp (noise) |
| EXP-451 baseline | WRITE-FIRST text | Write first tool call | 0% |
| EXP-280 | Hard-rule gate skill | Verify-after-edit | No change |

## What DOES Work

Only 3 intervention types produce measurable behavior change:

1. **Structural/workflow changes** — forced tool sequences (e.g., stub file pre-creation in master-worker.ts)
2. **Infrastructure enforcement** — circuit breakers, gates, auto-readback at tool layer
3. **Template/scaffold provision** — concrete fill-in-the-blank content removes decision paralysis

## Implication

- Stop designing text-nudge experiments for verification behaviors
- For new verification requirements: go straight to structural enforcement
- Text coaching DOES work for: output format, process rules (GOAL/PLAN), judgment skills (requirement-conflict-check, impact-radius-check)
- The distinction: text works for **what to think about**, not **what tool to call next**

## Related
- KE-338: Text coaching limits (original finding)
- EXP-451: Write-first scaffold (designed, ready to deploy)
- EXP-335: Output format — text DOES work (+100pp) for format compliance
- EXP-445: Impact-radius-check — text DOES work (+100pp) for judgment skills
