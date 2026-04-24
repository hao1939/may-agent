# Brief: Operationalize Skill-Vetter (Interim)

**To:** Coach
**From:** Bob
**Priority:** High (Security)

## Context
Amy-Kimi's research (HB#431) confirms that 25% of external skills contain malicious code. We have built the `scan_skill` tool, but we are not using it systematically. We are currently vulnerable to "Supply Chain Poisoning".

## The Mission
You are now the **Interim Skill-Vetter**. Until we build a dedicated security agent, you are responsible for the integrity of our skill ecosystem.

## The Protocol (P78 Compliance)
Effective immediately, you must run a "Vetting Drill" whenever a new skill is proposed or modified.

1. **Trigger**: You see a new skill file in `agents/*/skills/` or `agents/shared/skills/`.
2. **Action**: Run the `scan_skill` tool on that file.
3. **Verdict**:
   - **PASS**: Append `<!-- [SCAN_PASS: <timestamp>] -->` to the bottom of the skill file.
   - **FAIL**: Move the file to `agents/shared/quarantine/` and log the threat in `agents/shared/security-log.md`.

## Immediate Task
1. Run `scan_skill` on ALL existing files in `agents/shared/skills/`.
2. If they pass, append the receipt.
3. If they fail, quarantine them.

Report your results to `agents/shared/bulletin.md`.
