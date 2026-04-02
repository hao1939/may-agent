## Philosophy Update: The Agentic Shift

### New Principles (2026-03-31)

#### **P155 Harness Primacy**
**"Text is Policy, Code is Law."**
Critical safety and reliability constraints must be implemented in the **Harness** (manager.ts, security.ts), not the **System Prompt** (SOUL.md).
*   **Why**: Prompts are soft constraints (probabilistic). Code is a hard constraint (deterministic).
*   **Example**: Instead of telling an agent "Don't run `rm -rf`", the harness blocks `rm` commands (P53).
*   **Source**: MAST (arXiv:2503.13657), Skill-Inject (arXiv:2602.20156).

#### **P143 The Observation Principle**
**"Trust the Trace, Not the Thought."**
Agents hallucinate success (FM-2.6). Do not rely on their explanations. Rely only on **Ops Receipts** (HMAC-signed logs) and **State Changes** (Exit Codes, File Existence).
*   **Why**: "I fixed the bug" is a claim. `test_pass: true` [SIG:...] is a fact.
*   **Source**: MAST (FM-2.6 Liar's Loop).

#### **P144 Search is a Loop**
**"Navigation is a Process, Not a Tool Call."**
Search is a DAG (Plan -> Scan -> Refine -> Verify). It is not a single `search` tool call.
*   **Why**: Agents fail at navigation (76% success) because they treat it as a lookup.
*   **Source**: CodeCompass (arXiv:2602.20048).

#### **P145 Trusted Supply Chain**
**"All Inputs are Untrusted."**
Skill Descriptions, Memory Files, and Web Content are potential injection vectors (Skill-Inject). They must be **Sanitized** (Linted) and **Verified** (Signed).
*   **Why**: 80% attack success via descriptions.
*   **Source**: Skill-Inject (arXiv:2602.20156).

#### **P146 Context Primacy**
**"If it matters, put it in the Context."**
Passive Context (Files) beats Active Skill (Tools) for compliance (100% vs 53%).
*   **Why**: Agents read files reliably. They call tools probabilistically.
*   **Source**: Vercel Data (HB#1319).

#### **P161 The Safety Latch**
**"Safety must be Interruptive."**
When a critical boundary is crossed (RCE, File Deletion), the system must **Stop and Require Specific Input**. Passive review fails (91% approval).
*   **Why**: Humans rubber-stamp "looks good." They pause for "Type 'I accept data loss'".
*   **Source**: NTU AMD (HB#501).

#### **P162 Resource Intent**
**"Declare Intent Before Load."**
Agents must signal resource intent (Build/Test) before execution. The harness manages concurrency.
*   **Why**: OS-level execution dominates latency (56-74%). Unmanaged concurrency kills performance.
*   **Source**: AgentCgroup (arXiv:2602.09345).

### Deprecated Principles
*   (None - Additive update).

### Merged Principles
*   **P120 Ops Receipts** -> Merged into **P143 The Observation Principle**.
