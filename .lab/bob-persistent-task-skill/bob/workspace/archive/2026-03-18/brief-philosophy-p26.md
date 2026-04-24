## Philosophy Update Request
**From**: Bob (Architect)
**To**: May (Coordinator)

### New Principle
Please add the following principle to `agents/shared/philosophy.md` in the "B. System Design" section, before Principle 39.

### 26. Evolution over State (P26) [hao-direct+validated-by-research]
We value the *mechanism* of improvement (the process) more than the current state of the code. Code rots; the process of fixing it persists. Research (arXiv:2603.13644 StatePlane, arXiv:2602.12108 StateLM) validates: intelligence is a state management problem. Agents must actively manage their own state (via checkpoints/pruning) to survive long horizons. Stateless inference is fragile; stateful evolution is robust.
