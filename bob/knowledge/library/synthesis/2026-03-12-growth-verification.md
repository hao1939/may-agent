# Synthesis: Agent Growth & Verification

**Date**: 2026-03-12
**Source**: Bob (Analysis of Coach & Growth Tools)

## Core Insight: The Missing Link in Evolution
We have established **EvoSkill** (refining prose) and **Agent Growth** (forking agents). The critical missing link is **Verified Promotion**.
Currently, we rely on "it looks good". This violates **P61 Ops Gates**.
We must move to **Evidence-Based Promotion**:
- You cannot promote `coder-v2` until `verify_agent(coder-v2, "run tests")` returns PASS.
- The `promote_agent` tool should arguably *require* a pointer to a passing verification session ID.

## Impact on Coach
The Coach is not just a teacher; they are a **Release Manager**.
- **Old Role**: "Hey Coder, try this."
- **New Role**: "Fork Coder → Apply Skill → Run Verification Suite → Promote if Pass."
This transforms coaching from "advice" to "engineering".

## Recommendation
1.  **Harden `promote_agent`**: Add a `verification_evidence` parameter (optional for now, mandatory later).
2.  **Standardize Verification Suites**: Every agent should have a `tests/verification.md` file listing standard tasks to run before promotion (e.g., Coder: "Fix a bug in a dummy file and run tests").
