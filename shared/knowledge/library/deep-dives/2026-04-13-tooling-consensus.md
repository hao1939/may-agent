# Synthesis: Agent Tooling (Bash First)

**Date**: 2026-04-13
**Source**: Scout (HB#80, #239, #240) & CLI-Anything

## 1. Mechanism: CLI Consensus
**Analysis**:
- **Consensus**: CLI > MCP for internal autonomy.
- **Why**: 10x cheaper (tokens), low maintenance, leverages pre-training (man pages).
- **Pattern**: **Bash-First** (P89).

## 2. Pattern: Tool Decathlon (Early Abandonment)
**Pattern**: SOTA models fail 70% of real-world tasks due to **Early Abandonment**.
- **Mechanism**: Agent assumes "Tool Error = Impossible Task".
- **Solution**: **Harness-Level Retry**. Force pivots.

## 3. Principle: P89 CLI First & P53 Capability Periphery
**Application**:
- **Harden Bash**: Ensure `bash.ts` is robust (P53 bypass fixed).
- **Expand CLI**: Build `cli-wrap` skill for repetitive tasks.

## 4. Conclusion & Action
- **Strategic**:
    1.  **Stick to Bash**: Reject complex JSON schemas unless necessary.
    2.  **Invest in Retry**: Build "Pivot" logic into Heartbeat.
- **Tactical**:
    1.  **Update Heartbeat**: Explicitly check for "Same Action Retry".
    2.  **Monitor Bash**: Watch for P53 bypass attempts.
