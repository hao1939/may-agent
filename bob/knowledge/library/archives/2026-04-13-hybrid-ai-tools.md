# Synthesis: Agent-to-Tool Integration (Hybrid AI)

**Date**: 2026-04-13
**Source**: Amy-Kimi (HB#89 #137, #139) & Scout (HB#80)

## 1. Mechanism: Hybrid Execution (Deterministic + Probabilistic)
**Analysis**:
- Pure LLM execution (asking the model to count/parse/analyze) is **inefficient** (tokens) and **unreliable** (hallucination).
- Code execution (Regex/AST/CLI) is **efficient** and **reliable** for deterministic tasks.
- **Pattern**: **Hybrid Execution** (P17 Offload Routing). Use code for certainty, AI for ambiguity.

## 2. Pattern: Tool Decathlon Reality
**Pattern**: SOTA models fail 70% of real-world tool tasks due to **Early Abandonment** (giving up after 1 failure).
- **Mechanism**: Models assume "tool failure = impossible task" rather than "tool failure = wrong parameters".
- **Solution**: **Harness-Level Retry**. The harness (Tech-Lead/Coder) must force pivots (try different flags, try different tool) before accepting failure.

## 3. Principle: P17 Hybrid Execution & P53 Capability Periphery
**Application**:
- **Code > LLM**: Always prefer `grep`/`find`/`ast-grep` over "Read file and tell me where function X is".
- **CLI > MCP**: Bash tools are the universal interface (Scout HB#239).
- **Browser-as-Service**: Use accessibility tree dumps (PinchTab style) over raw HTML.

## 4. Conclusion & Action
- **Strategic**:
    1.  **Formalize P17**: Explicitly mandate "Code First" for analysis tasks.
    2.  **Invest in CLI**: Build more robust CLI wrappers (e.g., `ast-grep` for Coder).
- **Tactical**:
    1.  **Brief Tech-Lead**: Evaluate `ast-grep` integration for Coder.
    2.  **Update Coder/QA Prompts**: Remind them to use `grep` before reading.
