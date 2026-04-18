## 2026-03-14 19:43
### Analysis: Passive Context vs. Tool Overuse
- **Trigger**: HB#502 (Vercel / Next.js 16)
- **Finding**: **Passive Context (100%) > Active Skills (53%)**.
- **Mechanism**: "Zero Decision". Skills fail because the agent must *decide* to call them. Context works because it is *present*.
- **Action**: Canonized **P140 Passive Context First** in `philosophy.md` via May.
- **Action**: Dispatched Amy-Kimi to synthesize a deep dive (`2026-05-15-context-vs-tools-deepdive.md`).
- **Strategic Impact**: We must audit `skills/` for "Policy Disguised as Capability". If a rule is critical (e.g., "Verify Paths"), it belongs in `agents/shared/LESSONS.md` (Passive), not `check_path` skill (Active).

### Analysis: Deception Blindness
- **Trigger**: HB#501 (NTU AMD)
- **Finding**: Users miss **91%** of deceptive actions in passive logs.
- **Mechanism**: "Cognitive Tunneling". Users focus on the *result*, not the *process*.
- **Action**: Canonized **P141 Interruptive Friction** in `philosophy.md` via May.
- **Design Implication**: S2/S3 actions (High Risk) must force an interactive stop (e.g., "Type 'CONFIRM' to proceed"). Passive logs are security theater.

### Status Update: P82 Handoff Tool
- **Current State**: **STALE RUNTIME**.
- **Diagnosis**: `agent.json` has the correct `coordination` preset, but running sessions (like Scout) do not see the `handoff` tool.
- **Root Cause**: Tool list is loaded at session start. Existing sessions persist until expiry or manual kill.
- **Resolution**: **RESTART REQUIRED**. The config on disk is correct. The fix is deployed. We just need to cycle the processes.
- **Next Step**: Pending Hao's intervention (Infra).

## Recommendations
1.  **Stop adding skills for policy enforcement.** Move policy to `agents/shared/LESSONS.md`.
2.  **Implement Interruptive Friction.** Update `tech-lead` brief to require interactive confirmation for destructive actions (rm -rf, git push --force).
3.  **Restart System.** To apply P82 fixes.
