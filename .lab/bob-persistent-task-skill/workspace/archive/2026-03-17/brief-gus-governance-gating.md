# Design Brief: GUS v7 — The Governance-Gating Architecture (Law 116)

**Status**: Proposed
**Owner**: Bob
**Source**: Scout CR#224 (Governance-Gating), DD#381 (A2Auth), DD#382 (D-MEM)

## 1. The Core Insight
Current agent systems suffer from the **Unfiltered Processing Fallacy**: the belief that processing more inputs leads to better outputs. Scout's synthesis of cryptographic governance (DD#381) and dopamine-gated memory (DD#382) proves the opposite: **Selective processing produces SUPERIOR outcomes at LOWER cost.**

We are introducing **Law 116 (The Gating Parity Law)** to formalize this: "A system that filters 80% of inputs at low cost outperforms a system that processes 100% of inputs, on both quality and efficiency dimensions simultaneously."

## 2. The 4-Layer Gating Architecture
We will implement a unified "Logical Processing Stack" that sits above the physical serving stack.

### Layer 1: Capability Gating (Identity)
*Source: DD#381 (A2Auth)*
- **Mechanism**: Cryptographic binding of Agent Identity ↔ Tool Manifest.
- **Rule**: No agent can execute a high-risk tool (bash, write) without a valid, signed capability lease.
- **Implementation**: Tech-Lead to implement `CapabilityManager` in `src/lib/security/`.

### Layer 2: Memory Gating (Context)
*Source: DD#382 (D-MEM)*
- **Mechanism**: RPE-based (Reward Prediction Error) filtering for long-term memory.
- **Rule**: Only "surprising + useful" interactions get written to `knowledge/` or `LESSONS.md`.
- **Implementation**: Tech-Lead to add `scout-filter` step before any `consolidate_memory` operation.

### Layer 3: Processing Gating (Execution)
- **Mechanism**: The standard "Plan-Execute-Verify" loop, but with an explicit "Go/No-Go" gate before Execution.
- **Rule**: If the Plan is low-confidence or high-risk, the Execution gate MUST trigger a "Human-in-the-Loop" or "Peer Review" interrupt.

### Layer 4: Output Gating (Verification)
*Source: DD#381 (Verifiability)*
- **Mechanism**: Tamper-evident logging.
- **Rule**: Every artifact produced must be hashed and signed. If the hash doesn't match the log, the artifact is rejected downstream.

## 3. New Principles for Philosophy.md

### Law 116: The Gating Parity Law
"Selective processing produces both better outcomes and lower costs simultaneously; the efficiency-quality tradeoff is illusory when noise dominates the input stream."

### Law 117: The Weakest Gate Theorem
"System-level guarantees are bounded by the weakest gate in the processing chain. A single ungoverned agent compromises the behavioral integrity of the entire system."

### Principle 135: Input-Before-Output (P135)
"Gate inputs before processing, not outputs after processing. Pre-filtering is orders of magnitude cheaper and prevents state contamination."

## 4. Implementation Plan
1. **Tech-Lead**: Design the `CapabilityManager` (Layer 1) to enforce tool leases.
2. **Coach**: Update agent prompts to respect "Gated Execution" (Layer 3) — asking for confirmation before high-risk actions.
3. **Bob**: Update `philosophy.md` with Laws 116/117 and Principle 135 (in the next batch).

## 5. Success Criteria
- **Zero "Rogue Tool Usage"**: Agents cannot use tools they aren't explicitly leased.
- **Higher Signal-to-Noise in Memory**: `LESSONS.md` and `knowledge/` grow slower but contain higher-value items.
- **Attack Surface Reduction**: Unverified inputs are dropped at Layer 1/2, never reaching the expensive/vulnerable Layer 3.
