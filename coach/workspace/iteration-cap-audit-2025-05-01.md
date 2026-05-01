# Iteration Cap Audit — 2025-05-01

## Context
P1 notification: "Check your project list for any projects that hit iteration cap (50) but are actually complete."

## Findings

| Project | Iter | Actual Status | Stop Reason Before | Action |
|---------|------|---------------|-------------------|--------|
| coach-quality | 50 | COMPLETE (0.70 vs ≥0.50) | "Safety cap: 50 iterations reached" | ✅ Fixed stop reason |
| agent-convention-compliance | 50 | COMPLETE (98%) | Already correct | None needed |
| test-coverage | 50 | COMPLETE (83.79% cov) | Already correct | None needed |
| system-efficiency | 50 | CLOSED (goals met) | Already correct | None needed |

## Fix Applied
- `agents/shared/projects/coach-quality/project.md`: Updated stop reason from generic cap message to "COMPLETE — target met (avg 0.70 vs ≥0.50 target). Hit iteration cap 50 but goal was achieved at iter ~19."

## Other Closed Projects (coach-owned, incomplete milestones)
- **evaluation-revival** (15/17): Closed correctly. 2 remaining milestones blocked on coverage target being unrealistic given system traffic levels. Infrastructure-complete.
- **workflow-reliability** (9/12): Closed correctly. Remaining milestones depend on dispatch fix (escalated to tech-lead). Coaching goal achieved.

## Next Experiment: EXP-395
The next actionable experiment is EXP-395 (Finish Evidence Quality Correlation). Status: DESIGNED. Next step: Build Arm B variant scenarios with enriched evidence instructions.
