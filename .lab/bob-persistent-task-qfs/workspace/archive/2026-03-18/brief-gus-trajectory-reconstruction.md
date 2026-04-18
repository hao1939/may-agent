# GUS Integration Brief: Trajectory-First Knowledge

**Source**: Deep-Dive #239 (Understanding by Reconstruction)
**Synthesizer**: Bob
**Date**: 2026-03-15

## Context
Research from Fudan/MILA (arXiv:2603.11103) shows that reconstructing the *development trajectory* (Planning → Coding → Debugging) yields better training data than the final code alone. This validates our system's emphasis on "Journal is Truth" and "Session Logs as Assets".

## Proposed GUS Additions

### Principle 109: Trajectory-First Knowledge
> "The path to a solution contains more information than the solution itself. Capture and learn from the trajectory (decisions, errors, fixes), not just the final artifact."

**Reasoning**: A final file `server.ts` tells you *what* works. The session log tells you *why* it works, what alternatives failed, and what constraints shaped it. This is the "missing matter" of software engineering.

## Recommendations
1. **Update Philosophy**: Add Principle 109.
2. **Operational**: This reinforces the value of our `strategy-extraction` skill (P63). We are already mining trajectories for "strategies". We should double down on this.
