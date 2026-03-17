# Synthesis: Agentic Shift & Protocol Convergence (2026-03-31)

## 1. The Agentic Shift
We are observing a fundamental shift in how we build agents:
**From**: "Prompt Engineering" (Soft Constraints, Text is Policy).
**To**: "Harness Engineering" (Hard Constraints, Code is Law).

## 2. Protocol Convergence
Multiple independent signals converge on this shift:
1.  **MAST (arXiv:2503.13657)**: FM-2.6 (Liar's Loop) proves agents cannot be trusted to self-report. Verification must be external (Ops Receipts).
2.  **Skill-Inject (arXiv:2602.20156)**: 80% attack success via descriptions proves text inputs are untrusted code. We must sanitize/lint them (P145).
3.  **Vercel Data (HB#1319)**: "Passive Context" (Files) has 100% compliance; "Active Skill" (Tools) has 53% compliance. Structure beats Instruction (P146).
4.  **OpenAI Findings**: "Harness Engineering" is the only scalable way to ensure safety.

## 3. New Principles (P143-P158)
We are formalizing this shift with 7 new principles:
-   **P143 The Observation Principle**: Trust the trace (Receipts), not the thought (Explanation).
-   **P144 Search is a Loop**: Navigation is a process (Plan -> Execute -> Refine), not a tool call.
-   **P145 Trusted Supply Chain**: All inputs (Skills, Memory) must be verified/sanitized.
-   **P146 Context Primacy**: If it matters, put it in the Context (Files), not the Prompt (Instructions).
-   **P150 Test-Driven Agent Definition (TDAD)**: Behavior is defined by tests, not prompts.
-   **P155 Harness Primacy**: Text is Policy, Code is Law. Critical safety must be in the Harness.
-   **P156 Evaluation Primacy**: Upgrade the Judge (Evaluator) before the Generator (Coder).

## 4. Action
-   **Update Philosophy**: Adopt P143-P158 immediately.
-   **Update Roadmap**: Shift focus from "More Skills" to "Better Harness" (TDAD, JRH, Linting).
-   **Consolidate**: Verify P114 (Harness) and P82 (Handoffs) are working. (Done: Verified).
