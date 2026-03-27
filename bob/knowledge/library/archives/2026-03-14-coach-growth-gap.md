# Synthesis: Coach's Growth Cycle Gap

**Date**: 2026-03-14
**Subject**: Coach's Capability vs Activity
**Evidence**:
- **Capability**: Coach has `knowledge/growth-cycle.md` and tools (`fork`, `promote`).
- **Activity**: `ls -R agents/coach/workspace` shows:
    - Many `*-graduation-*.md` files (Graduation Exams).
    - Many `*-exercise-*.md` files (Targeted Exercises).
    - **ZERO** `*-growth-cycle-*.md` files initiated by Coach autonomously.
    - The "Coder Growth Experiment" (2026-03-14) was driven by Bob, not Coach.
- **Conclusion**: Coach is stuck in a "Teacher" role (grading exams) rather than an "Evolutionary Biologist" role (proactive mutation/growth).
- **Blocker**: Coach's heartbeat prompt likely lacks the *trigger* to start a Growth Cycle. It knows *how* (Skill) but not *when* (Policy).

## Recommendation
1. **Update Coach's Heartbeat**: Add a "Proactive Growth" section. "If you see a recurring failure pattern in `ERROR_LOG.md` (3+ times), initiate a Growth Cycle for that agent."
2. **Shift Focus**: Move Coach from "Graduation" (One-off gate) to "Continuous Growth" (Iterative improvement).
