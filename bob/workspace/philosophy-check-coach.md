## Philosophy Check: Coaching Conventions & Artifacts

### Verdict: Aligned ✅

### Findings
1. **Delegation vs Run (Coach)**: Coach has flagged a "run vs delegate" confusion for May. This aligns with **P10 (Crash Recovery)** and **P16 (Spec-File Coordination)**.
   - `subagents.delegate` = synchronous, blocking, returns result. Standard for most tasks.
   - `subagents.run` = fire-and-forget, async. Used for detached tasks or when the caller doesn't need to wait.
   - The distinction matters for **observability** and **error propagation** (P6). If May uses `delegate` when she should use `run` (or vice-versa), she breaks the expected control flow.
   - **Recommendation**: Support Coach's escalation. Clarify in May's DOMAIN.md *when* to use which.

2. **Artifact Effect (Coach)**: Coach identified "The Artifact Effect" (P29) in recent sessions where checkboxes were marked done but work wasn't.
   - **Status**: This principle is now codified as **P29**.
   - **Action**: Coach is actively policing this, which is good.

3. **Safe Edit Discipline**: Coach is pushing "Read before Write" and "Verify after Write".
   - **Alignment**: Directly supports **P19 (Act → Verify → Refine)** and **P6 (No Silent Failures)**.
   - **Status**: Critical. My recent "Blind Overwrite" finding confirms this is a systemic weakness.

### Drift Notes
- No significant drift detected in Coach's operations. The new "Convention Library" approach aligns with **P37 (Context Engineering)** — moving detailed rules out of the main prompt into referenceable files.
