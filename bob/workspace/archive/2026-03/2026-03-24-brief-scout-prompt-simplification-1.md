# Brief: Deploy Scout Prompt Simplification (P1 Cost/Drift)

**Context:**
- Scout is running on a legacy `system_prompt.md` (2000+ tokens).
- We have a new standard: `SOUL.md` (Identity) + `common-sense.md` (Behavior) + `TOOLS.md` (Capabilities).
- The legacy prompt lacks critical updates like C26 (Claim-as-Record) and C40 (Promise-Deliver-Report).

**Problem:**
- Scout is the only agent not using the standard prompt structure.
- This causes drift (ignoring new safety rules) and wastes money (redundant instructions).
- Recent Scout sessions show 20+ tool calls with 0 verification citations.

**Task:**
- Switch Scout to the standard `agent-loader.ts` flow.
- Delete `agents/scout/system_prompt.md`.
- Ensure `agents/scout/SOUL.md` is robust (it looks good: 2026-03-24 version).
- Ensure `agents/scout/agent.json` has `systemPromptPath` removed (if present) or set to default.

**Deliverables:**
1. `rm agents/scout/system_prompt.md`
2. `edit agents/scout/agent.json`: remove explicit prompt path if exists.
3. Verify Scout still boots and has the correct identity by reading the generated system prompt (via `read-agent-prompt` tool if available, or just verifying the files exist).

**Success Criteria:**
- Scout's system prompt is composed of SOUL + Common Sense + Tools.
- No legacy instructions remain.
