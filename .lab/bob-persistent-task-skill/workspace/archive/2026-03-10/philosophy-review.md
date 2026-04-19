# Philosophy Review

**Date:** 2026-03-03
**Reviewer:** Bob

## Philosophy Check: System Behavior vs Stated Principles

I have reviewed `philosophy.md` against recent evaluation data (s_1772522493938_0, s_1772520277944_11) and transcripts.

### Aligned ✅

*   **Principle 14: Deterministic Guardrails for Reliability [hao-pattern]**
    *   **Observation:** In `s_1772522493938_0`, the agent attempted to clone to `/tmp` (outside workspace). The `exec` tool successfully blocked this with a clear error: "Blocked: command matches a denied pattern."
    *   **Verdict:** The structural constraint worked exactly as designed. The system didn't rely on the agent "being careful"; it enforced the boundary physically.

*   **Principle 6: No Silent Failures [hao-direct]**
    *   **Observation:** The tool outputs in `s_1772522493938_0` were explicit ("Blocked...", "WARNING: Your command references paths outside...").
    *   **Verdict:** The tooling is adhering to this. The failure was loud and clear.

### Drift ⚠️

*   **Principle 5: Evidence-Based [hao-direct]**
    *   **Observation:** In `s_1772522493938_0` and `s_1772520277944_11`, agents encountered **truncated output** (clearly marked with `⚠️ OUTPUT TRUNCATED`) but proceeded to make confident claims about the "complete" content.
    *   **Drift:** Agents are treating *partial* evidence as *total* evidence. They "intuit" the rest of the file rather than reading it. This is a critical violation of Principle 6.

*   **Principle 29: The Artifact Effect [verified]**
    *   **Observation:** In `s_1772520277944_11`, the agent read `team.md`, saw text that *looked* correct, and declared the task done ("Good news... they are actually already correct"), refusing to apply the user's fix.
    *   **Drift:** The agent was seduced by the artifact looking "finished" and "correct" on the surface, failing to verify the specific stale string the user reported. It trusted the artifact over the user's report.

*   **Principle 7: Scope Discipline [hao-direct]**
    *   **Observation:** In `s_1772522493938_0`, the agent wasted turns fighting the `/tmp` constraint multiple times instead of accepting the constraint and working within the allowed scope.
    *   **Drift:** "Scope Discipline" implies accepting the boundaries of the job. Fighting the environment is a scope violation.

### Missing Patterns (New Philosophy Candidates)

*   **"Partial Data is No Data" / "Respect Information Limits"**
    *   **Context:** The recurring failure mode of ignoring truncation warnings.
    *   **Proposed Principle:** *If you can't see it, you don't know it.* Never guess what's in the truncated part of a file. Explicitly fetch the missing data before acting.

*   **"Don't Fight the linter/Compiler/Environment"**
    *   **Context:** Agents retrying the exact same blocked action (cloning to /tmp) hoping for a different result.
    *   **Proposed Principle:** *Hard constraints are facts, not suggestions.* If the environment says "No", change your approach immediately; don't retry the same action.

### Questions ❓

*   **Principle 16 (The Artifact Effect):** You marked this as `[verified]`. The failure in `s_1772520277944_11` (agent seeing "correct-looking" text and stopping) is a perfect real-world example of this. **Recommendation:** Upgrade this from `[verified]` to `[hao-pattern]` or `[verified]`, as we now have concrete session data proving it's a real risk in our system.

### Recommendations

1.  **Upgrade Principle 29:** The "Artifact Effect" is real and causing task failures. Validate it.
2.  **New Principle:** Add a specific principle about **Data Completeness** or **Handling Truncation** to combat the hallucination of unread content.
3.  **Refine Principle 14:** Explicitly state that agents must *respect* the guardrails, not just that the guardrails must exist.
