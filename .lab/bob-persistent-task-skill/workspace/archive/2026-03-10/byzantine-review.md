# Design Review: Byzantine Fault Tolerance in Multi-Agent Systems
**Trigger:** Scout's Research on "Byzantine Generals in LLM Agents"
**Date:** 2026-03-10

### Verdict: Valid Concern & Strategic Priority ✅
Scout's research is accurate and highly relevant. The "Byzantine" framing—where agents don't just fail (crash) but fail *incorrectly* (hallucinate convincing lies)—is the correct model for our system's reliability.

**The Risk is Real:**
Our current architecture ("Hub-and-Spoke") is identified by research as the **highest-risk topology**. We rely heavily on May (Supervisor) delegating to Coder/Scout and trusting the result. If a sub-agent hallucinates a success or a file path, May often accepts it as fact. This violates **Principle 5 (Verify, Don't Assume)** and **Principle 6 (No Silent Failures)**.

### Analysis against Philosophy

1.  **Alignment with P6 (No Silent Failures):**
    *   *Current State:* A sub-agent returns "I fixed the bug" (but didn't). May reports success. The failure is silent until the user finds it.
    *   *Research Insight:* This is a "Byzantine fault" (lying node).
    *   *Philosophy Check:* We must convert this silent failure into a structural error.

2.  **Alignment with P1 (Simplest Thing That Works):**
    *   *Research Proposals:* Gossip protocols, Blockchain ledgers, PBFT voting.
    *   *Our Constraints:* These are too heavy. We are a coding team, not a financial ledger. We need lightweight, structural mitigations.

3.  **Alignment with P20 (Short Chains, Verified Handoffs):**
    *   *Research Support:* "Verifier Agent restores 100% accuracy."
    *   *Our Design:* We already have QA. The research suggests QA's role is not just "code review" but "truth verification" for *all* sub-agent outputs.

### Recommendations

We will adopt the **"Trust but Verify"** subset of the recommendations. We reject the heavy consensus protocols.

#### 1. Structured Output Contracts (Structural Fix)
**Status:** **Adopt immediately.**
**Why:** Aligns with **P14 (Deterministic Guardrails)**.
**Change:** Sub-agents must not return raw strings. They must return a structured object:
```json
{
  "status": "success",
  "summary": "Fixed the bug in tools.ts",
  "evidence": ["Ran test-tools.ts, passed", "Read file to verify content"],
  "confidence": "high"
}
```
*Action:* Tech Lead to define a standard `TaskResult` schema for `delegate()` returns.

#### 2. "Skeptic" Supervisor Mode (Behavioral Fix)
**Status:** **Adopt.**
**Why:** Aligns with **P5 (Verify, Don't Assume)**.
**Change:** Update May and Tech Lead's system prompts.
*   *Old:* "Delegate to coder, then report result."
*   *New:* "Delegate to coder. Treat the result as a **claim**, not a fact. Verify the claim (read the file, check the test log) before accepting it."

#### 3. Expand QA Scope (Role Fix)
**Status:** **Refine & Adopt.**
**Why:** Aligns with **P20 (Short Chains)**.
**Change:** QA is currently "Code Reviewer". We should reframe QA as "Verifier".
*   If Coder says "I researched X", QA (or a verifier step) checks "Did X actually get researched, or is this a hallucination?"
*   For critical paths, the "Verifier" pattern is just an automated version of P19 (Act -> Verify -> Refine).

### Deferred / Rejected
*   **Gossip Protocols / Blockchain:** Rejected (Violation of P1 - Over-engineering).
*   **Decentralized Voting:** Rejected for now. We will stick to verified delegation.
*   **3+ Agent Consensus:** Reserved for high-stakes/irreversible decisions only (P22 prefers 2-agent pairing).

### Next Steps
1.  **Brief Tech Lead:** Task Tech Lead to design the `TaskResult` schema for sub-agent delegation.
2.  **Update Philosophy:** Add a note to P5 clarifying that "Sub-agent output is an unverified input."
3.  **Pilot:** Monitor the next "Implement" workflow. Does May blindly accept Coder's output? If so, this confirms the urgency.
