# Brief: Scout Prompt Simplification (Standardization)

**Problem:**
Scout is currently running on a legacy system prompt structure that predates the `SOUL.md` + `common-sense.md` standardization. This causes:
1. **Token Waste:** Legacy prompt duplicates instructions found in common-sense.
2. **Behavioral Drift:** Scout doesn't receive the latest global updates (like C26 Claim-as-Record) automatically because they are in `common-sense.md`, which might be overshadowed or conflicted by the legacy prompt.
3. **Maintenance Debt:** We have to maintain two "truth" sources for Scout.

**Goal:**
Migrate Scout to the standard "Identity + Common Sense + Tools" context stack.

**Implementation Plan (Tech-Lead):**
1. **Backup:** Copy `agents/scout/system_prompt.md` to `agents/scout/knowledge/archive/legacy_system_prompt.md`.
2. **Create SOUL:** Extract the *unique* identity/mission parts of `system_prompt.md` into `agents/scout/SOUL.md`.
   - *Identity:* "The Scholar — deep research..."
   - *Mission:* "Research AI agents, tools, papers..."
   - *Style:* "Academic, rigorous, citation-heavy."
3. **Delete Legacy:** Remove `agents/scout/system_prompt.md`.
4. **Update Config:** Ensure `agents/scout/agent.json` does *not* reference `system_prompt.md` (if explicit) or rely on `agent-loader` defaults.
   - *Note:* The `agent-loader.ts` usually auto-loads `SOUL.md`, `common-sense.md`, and `TOOLS.md`. Verify this works for Scout.

**Verification:**
- Run `agents.call("scout", "who are you and what are your constraints?")`.
- Verify Scout cites `SOUL.md` identity and `common-sense.md` constraints (like "Simple first").
