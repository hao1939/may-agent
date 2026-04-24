# Philosophy Check: agents/shared/best-practices.md

### Aligned ✅

**1. Evidence-Based (P5, P34)**
The document is exemplary in its adherence to Principle 5 ("Evidence-Based"). Every practice cites specific sessions, efficiency scores, or A/B tests. It avoids the "Theory Worship" trap (P34) by grounding rules in observed failures (e.g., "Bob session s_1772683977137_15").

**2. Action Over Reporting (P2)**
The format is strictly "Do / Don't" with concrete code examples (`sed` patterns, `read` calls). It is immediately actionable for an agent reading it, complying with P2.

**3. Hard Constraints Are Facts (P8)**
Section 2.3 ("Accept Hard Constraints Immediately") and 6.2 ("Retry ≠ Repeat") perfectly codify Principle 8. The instruction to stop hammering blocked paths is crucial for efficiency.

**4. Claim Before Act (P46)**
Section 3.1 directly operationalizes the recently added Principle 46. This reinforces the "legibility" requirement for coaching and auditing.

**5. Measurable Operations (P18)**
Part 10 ("Measurement") is a strong addition. Defining success not just as "it works" but as "pass^k" (reliability) and specific metrics (wasted-to-productive ratio) aligns perfectly with P18.

### Drift ⚠️

**1. Convention Location Confusion**
*   **Observation**: The prompt asked me to check against `CONVENTIONS.md`, which does not exist. `agents/shared/agent-convention.md` redirects to a non-existent `docs/` path. The actual conventions live in `agents/coach/skills/agent-conventions/`.
*   **Philosophy**: **P37 (Context Engineering)** - "Reference > inject". Broken references destroy trust in the documentation.
*   **Impact**: Agents looking for the "canonical" conventions may get lost or hallucinate content.

**2. Sed Patterns vs. Surgical Writes (BP 1.2 vs Convention B10)**
*   **Observation**: BP 1.2 strongly advocates for **pattern-based sed** (`sed -i 's/old/new/'`) to avoid line number drift. Convention B10 (`agents/coach/skills/agent-conventions/behavior.md`) suggests `grep -n` to find line numbers, then `read` with offsets, then `write`.
*   **Philosophy**: **P1 (Simplest Thing That Works)** vs **P14 (Deterministic Guardrails)**.
*   **Conflict**: Using line numbers for *edits* (sed) is dangerous (drift). Using line numbers for *reads* (read+offset) is safe *if* verified immediately.
*   **Recommendation**: Clarify that **Pattern-based sed** is preferred for blind edits (CLI tools), while **Line-range read + Write** is preferred for surgical content replacement when you need to see the context first.

### Questions ❓

**1. "One Fix Per Optimization Run" Scope**
*   **Context**: BP 3.4 says "When improving agent behavior... make one change".
*   **Question**: Does this apply to *all* agents or just the Optimizer? Philosophy P1 applies to everyone ("Simplest Thing"), but the "Optimization Run" is a specific Optimizer concept.
*   **Implication**: If applied too broadly, it might prevent a Coder from fixing two typos in one file.
*   **Recommendation**: Clarify that this applies to **System/Behavioral Improvements** (changing how an agent works), not necessarily every multi-line code fix.

### Recommendations

1.  **Fix the Convention Links**: Update `agents/shared/agent-convention.md` to point to the actual location in `agents/coach/skills/agent-conventions/` (or move them to `agents/shared/conventions/`).
2.  **Refine Sed Guidance**: In Section 1.2, explicitly distinguish between:
    *   *Blind Edits* (use `sed` with text patterns, NEVER line numbers).
    *   *Surgical Writes* (use `read` with line range -> verify content -> `write`).
3.  **Promote to Core**: This document is high-quality enough to be referenced directly in `SOUL.md` or `system-prompt` for all agents, specifically Part 1 (File Operations) which deals with the #1 failure mode.
