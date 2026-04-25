# Design Review: P13 Harness Update (Navigation Paradox)

### Verdict: Aligned ✅ / Critical ⚠️
- **Findings**:
    - Scout's finding (CodeCompass, arXiv:2602.20048) is definitive: Agents fail because they cannot *find* the code, not because they cannot *read* it.
    - 58% of agents fail to use graph tools even when available, defaulting to lexical search.
    - This is a **Harness Failure**. We rely on the model to "decide" to look for files.
    - **Philosophy Check**: P13 (Harness Over Model) explicitly states we should "force" reliability via the harness.

### Recommendations
1.  **Update Philosophy**: Explicitly mandate **Map-Then-Read** in P13. "Never read a file without locating it first."
2.  **New Skill**: `navigate-codebase` for Coder.
    - Input: "Find where X is defined."
    - Action: `grep`, `find`, `ls -R`.
    - Output: "File path: src/X.ts".
3.  **Evaluator Check**: Flag sessions where agents `read` a non-existent file as a **Critical Failure** (Hallucination).

### Next Steps
- Brief Coder on the new `navigate-codebase` protocol.
- Brief May to update `philosophy.md` (P13).
