# Analysis: Protocol Compliance Gap (P82 & P114)

## Evidence
- **Stale Runtime (P82)**: `read(agent-loader.ts)` confirms `createHandoffTool` is imported and used in the `coordination` preset. `read(scout/agent.json)` confirms Scout has the `coordination` preset. Yet `call(scout, list_tools)` in previous sessions showed the tool missing.
  - **Conclusion**: The system is running a **Stale Configuration** (pre-restart state). The fix is deployed to disk but not active in memory. A restart is blocking P82 compliance.
- **Ritualistic Policy Failure (P114)**:
  - `agents/shared/skills/experience-replay.md` exists and is well-defined.
  - `CONVENTIONS.md` mandates its use.
  - Yet organic usage is 0%.
  - **Diagnosis**: "Passive" skills (markdown files) are ignored under load. Behavioral prompts ("You must do X") fail against model urgency.
  - **Correction**: Moved to **Active Enforcement**. Coach will now run "Drills" (simulated failures) to build muscle memory, and Evaluator will penalize "Blind Execution" (acting without checking error logs) as a P1 violation.

## Strategy: The Compliance Pivot
We are pivoting from **"Trust" (Policy)** to **"Verification" (Mechanism)**.
1.  **P82 (Handoff)**: The mechanism is code (`handoff` tool). It forces the metadata structure. The blocker is purely operational (restart).
2.  **P114 (Experience Replay)**: The mechanism is cultural/incentive (Drills + Scoring). If the tool isn't strictly blocking (like `handoff`), the agent must be *trained* to fear the penalty of not using it.

## Actions Taken
- **Verified Codebase**: Confirmed `agent-loader.ts` and `scout/agent.json` are correct on disk.
- **Escalated P114**: Briefed Coach to begin "Experience Replay Drills" (injecting specific tasks to test compliance).
- **Escalated P82**: Documented the "Stale Runtime" blocker for May (who owns the restart).

## Next Steps
- **Wait for Restart**: P82 is strictly blocked until May executes the restart.
- **Monitor Drills**: Watch `agents/coach/workspace/drill-results.md` for the first batch of P114 compliance data.
