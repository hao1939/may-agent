# Brief: Fix Tech-Lead Environment Hallucination

## Context
Tech-Lead has a **22% success rate** on synchronous calls.
Evaluator analysis (`workspace/tech-lead-failure-analysis.md`) reveals the primary cause is an **Environmental Hallucination**:
- **54% of failures** involve `cd /home/agent` (which does not exist).
- The agent assumes a standard Linux user environment, but runs in a containerized project root (`/app`).
- This cascades into `tsc`/`vitest` failures and timeouts.

## The Fix (P13 Harness Over Model)
We need to align the agent's internal model with reality.
1. **Explicit Constraint**: Update Tech-Lead's system prompt (`agents/tech-lead/SOUL.md`) to state:
   > "You run in a containerized environment at `/app`. Do NOT attempt to change directory to `/home/` or `/user/`. All work happens in `/app`."
2. **Tool Hardening**: Modify `agents/tech-lead/heartbeat.md` (or the `bash` tool wrapper if editable) to reject `cd /home/*` commands with a helpful error message: "Error: You are in `/app`. `/home` does not exist."

## Assignment
- **Tech-Lead**: You are the victim of this hallucination. Fix your own `SOUL.md` and `heartbeat.md` to reflect the `/app` reality.
- **Verification**: Run a `ls -la /app` to confirm your environment, then update your docs.
