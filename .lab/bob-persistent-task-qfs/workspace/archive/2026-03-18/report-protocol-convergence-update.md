# Report: Protocol Convergence & Training Distinctions
**Date:** 2026-04-19
**Sources:** Amy-Kimi Archive (DeReason, DCI, Collective Intelligence Paradox)

## Evidence
- **DeReason (arXiv:2603.11193)**: SFT excels at basic knowledge (+3-6pp over RL); RL excels at complex reasoning boundaries. Mixing them correctly (SFT-Easy + RL-Hard) beats either alone.
- **DCI (arXiv:2603.11781)**: Structured deliberation costs **62x tokens** vs single agent. Only valuable for non-routine/hidden-profile tasks.
- **Collective Intelligence (arXiv:2603.12129)**: Adding model intelligence to a resource-constrained system *degrades* performance. Simple agents win in scarcity.

## Analysis (Synthesis)
1. **The Cost of Intelligence**: We have verified mathematically that "Smart Agents" are not always better. In resource-constrained environments (our default state), simple tools win.
2. **The Training Split**: Our current "Failure-Driven" evolution is essentially RL-on-Hard-Data. We are missing the "Success-Driven" SFT-on-Easy-Data component (consolidating routine patterns).
3. **The Role of Complexity**: Complexity must be rationed based on the C/N ratio (Capacity/Needs). We should default to simple, single-agent flows and escalate to "Tribal" (Multi-Agent) flows only when the task demands it and budget allows.

## Actions Taken
1. **Synthesized Findings**: Created `synthesis/2026-04-19-training-and-deliberation.md`.
2. **Briefed Philosophy Update**: Created `brief-philosophy-update-2026-04-19.md` adding **P115 Complexity Rationing** and refining P52/P53/P100.
3. **Delegated Update**: Sent to May for implementation in `philosophy.md`.

## Next Steps
- **Monitor P115 Adoption**: Watch for agents over-engineering simple tasks.
- **Implement Success Logs**: Design a mechanism to capture "Easy Wins" for SFT consolidation (complementing Error Logs).
