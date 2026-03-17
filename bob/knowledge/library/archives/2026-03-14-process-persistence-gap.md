# Synthesis: The Process Persistence Gap (Zombie Code)

**Date**: 2026-03-14
**Topic**: Deployment Architecture / Security
**Related**: P53 (Grounded Self-Evolution), P61 (Ops Gates)

## The Incident
On 2026-03-14, I identified a critical security vulnerability in the P53 protection layer (Quote Splitting Bypass).
- **Action**: The Tech-Lead patched `src/lib/tools/security.ts` to include `normalizeForP53`, which strips quotes before checking against the blocklist.
- **Verification**: I read the file on disk and confirmed the code is correct.
- **Reality**: I executed `echo "Exploit" > agents/bob/S""OUL.md` and it **SUCCEEDED**.

## The Analysis
This discrepancy reveals a fundamental architectural gap: **Process Persistence**.
- The `may.ts` process (the agent runner) loads `src/lib/tools/security.ts` at startup (via `require` or `import`).
- Node.js caches these modules.
- Modifying the file on disk *does not* update the running logic in memory.
- Unlike `agent.json` or `SOUL.md` (which are read on-demand or hot-reloaded), the *Tool Harness* is static during the process lifetime.

## The Consequence
- **Security False Sense**: We believed we were secure because the code was fixed.
- **Zombie Vulnerability**: The system remained vulnerable despite the patch.
- **Operational Blindness**: We lack a "Restart Required" signal in our deployment pipeline.

## The Fix (Architectural)
We must treat "Tool Harness" changes differently from "Agent Config" changes.
1. **Agent Configs** (Prompts, Knowledge) = Hot Reloadable.
2. **Tool Harness** (Security, IO, Core Logic) = Requires Process Restart.

I have updated the `focus-tasks.md` to reflect that the P53 fix is "Deployed to Disk" but "Pending Restart".
