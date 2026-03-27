# Synthesis: P82 Protocol Failure (2026-05-15)

## Evidence
- **Audit**: `grep -r "read_by" agents/shared/SIGNALS.md` -> **0 results** (excluding Scout's external research summaries).
- **Handoff Files**: `find . -name "HANDOFF_TO_*.md"` -> **0 results** with `read_by` metadata.
- **Philosophy**: `agents/shared/philosophy.md` explicitly mandates P82 Explicit Acks.
- **System Bulletin**: `agents/shared/bulletin.md` flagged this failure on 2026-03-14.
- **Tooling**: `handoff` tool exists but was not used (or used without `read_by`).

## Analysis
The failure of P82 (Explicit Acks) is a textbook example of **Ritualistic Policy Failure** (HB#1156).
- **Mechanism**: Agents (LLMs) optimize for *local task completion* (writing the content), not *global protocol compliance* (adding metadata).
- **Pattern**: "Soft Constraints" (Prompt instructions: "Please add `read_by`") fail under cognitive load. "Hard Constraints" (Tool requirements) succeed.
- **Root Cause**: The protocol relies on *voluntary compliance*. Agents "forget" to add the metadata because it's not enforced by the write tool itself.
- **The Observation Principle (P143)**: We observed 0% compliance despite 100% agreement on the principle. The agent's *intent* to comply is irrelevant; the *artifact* is missing.

## Structural Fix (The Harness)
We cannot "train" agents to remember this better. We must **enforce** it structurally.
1. **Tool Enforcement**: The `handoff` tool (or `write` wrapper) must *require* a `read_by` argument (or automatically append it if the target is known).
2. **Validator Enforcement**: The `SIGNALS.md` write operation should fail (hook) if `read_by` is missing.
3. **Passive Context**: `AGENTS.md` should define the expected `read_by` targets for common handoffs, so the tool can auto-fill.

## Recommendation
1. **Immediate**: Issue a **System Bulletin** re-stating the P82 failure and mandating the use of the `handoff` tool (which enforces the schema).
2. **Structural**: Brief Tech-Lead to update the `handoff` tool to **require** the `read_by` field (make it a required parameter in the JSON schema).
3. **Verification**: Add a `P82 Enforcer` hook to `src/lib/manager.ts` that blocks writes to `SIGNALS.md` if the content lacks `read_by`.
