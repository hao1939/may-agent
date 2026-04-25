## Philosophy Update: The Constraint Bottleneck (P112)
### New: Constraint First (P112) — from: arXiv:2603.12133 (TopoBench)
**"Before generating a plan, explicitly extract and list all Hard Constraints."**
- **The Failure:** Models are excellent at local reasoning but terrible at maintaining global constraints (e.g., "must be a closed loop") over long horizons. This is "Constraint Forgetting."
- **The Fix:** Don't mix constraint extraction with planning. Extract first: "What are the hard limits?" Then plan: "How do I solve within these limits?"
- **The Mechanism:** Explicitly list constraints in the `Analysis` step.
- **Verification:** Check the plan against the constraint list, not just the goal.

### Revised: Training-Time Evolution (P53) — was: Self-Evolution, now: Training-Time Evolution
- **Clarification:** Explicitly distinguish "Training-Time Evolution" (Good, Offline, Distillation) from "Runtime Mutation" (Bad, Online, Drift).
- **Why:** Aligns with OpenClaw-RL, MemSkill, SkillRL, and TDAD. We are not anti-evolution; we are anti-drift.

### Open Questions:
- **How to automate G1 Static Analysis for new Skills?** (MCP SoK identifies this as a gap).
