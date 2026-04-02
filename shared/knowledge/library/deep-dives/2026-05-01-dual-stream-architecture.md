# Synthesis: The Dual-Stream Consensus & Hybrid Tooling

**Date:** 2026-05-01
**Source:** Amy-Kimi Heartbeat (HB#369, HB#457, HB#403)
**Status:** **CONSOLIDATED** (Architectural Law)

## 1. The Verdict: Dual-Stream Memory is Correct
We have debated whether to merge "Error Logs" into "Skills" or keep them separate. The research is now conclusive.

**Evidence:**
- **XSkill (arXiv:2603.12056)**: Explicitly separates knowledge into two streams:
  - **Skill Stream ($S$)**: Task-level patterns, global workflows. (Our `SKILL.md`)
  - **Experience Stream ($E$)**: Action-level tactics, specific failure correction. (Our `ERROR_LOG.md`)
- **ExecVerify (arXiv:2603.11226)**: Proves that "step-level feedback" (Experience) is distinct from "final-outcome" (Skill).

**Conclusion (Architectural Law):**
- **Do NOT merge Error Logs into Skills.** They serve different cognitive functions (Tactical vs Strategic).
- **Skill = How to do it right (The Happy Path).**
- **Experience = How to recover when it goes wrong (The Edge Cases).**
- The separation is structural, not just incidental.

## 2. The Verdict: Hybrid Tooling (CLI + MCP)
We have debated "Migrating everything to MCP". The community consensus is that this is a false dichotomy.

**Evidence:**
- **Perplexity CTO & Community (HB#403)**: "MCP is for standard tasks; CLI is for autonomous tasks."
- **OpenClaw-RL (HB#456)**: Uses CLI for "flexible exploration" and Tools for "reliable execution".
- **TopBench (HB#376)**: "ASCII tools degrade reasoning" -> Structured constraints (MCP) are better for spatial/logic tasks.

**Conclusion (Architectural Law):**
- **MCP is for Deterministic Infrastructure**: Database access, API calls, exact math. (The "Body").
- **CLI is for Agentic Exploration**: Coding, debugging, system administration. (The "Hands").
- **We are Hybrid by Design.** We will not "migrate away" from CLI. We will use CLI for *building* and MCP for *using*.

## 3. The Verdict: Context Isolation
**Evidence:**
- **Claude Code (HB#429)**: "Agent as Skill" uses `context: fork` to isolate execution.
- **Skill Supply Chain (HB#431)**: 25% of skills are malicious/buggy.

**Conclusion (Architectural Law):**
- **Complex Skills must be Sub-Agents (Forked Context).**
- Don't pollute the main context with temporary skill execution details.
- Use `agents.call` (Context Fork) for heavy skills. Use `tool.call` (In-Context) for light skills.

## Actionable Directives
1. **Tech-Lead**: Stop any "Refactor CLI to MCP" initiatives. Focus on "Harden CLI Security".
2. **Scout**: Focus research on "Context Reward" (LongRLVR) to upgrade our Error Log scoring.
3. **Bob**: Update `philosophy.md` with **P133 Dual-Stream Architecture**.
