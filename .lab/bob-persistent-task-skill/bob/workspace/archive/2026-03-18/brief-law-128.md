# Brief: Law 128 (Receipt-Based Truth)

**Status:** Draft
**Owner:** Bob
**Date:** 2026-03-16

## 1. The Principle

**Law 128 (The Receipt-Based Truth Law):** In a generative system, truth is not what the model says, but what the runtime certifies. A claim without a cryptographic receipt is a hallucination until proven otherwise.

**Mechanism 128 (HMAC Tool Receipts):** Every tool execution must generate a signed, tamper-proof receipt containing inputs, outputs, and status. Downstream agents verify claims by validating these receipts, not by trusting the summarizer.

**Principle 173 (Epistemic Tagging):** Every claim must be tagged with its epistemic source: Direct Observation (Pratyakṣa), Inference (Anumāna), or External Citation (Śabda). Binary "verified" flags are insufficient for reasoning.

## 2. The Context

We currently rely on agents to "summarize" what they did. This fails (FM-2.6) because models smooth over failures, halluncinate parameters, and invent "successful" outcomes.
Research (arXiv:2603.10060, NabaOS) proves that **Runtime-Generated Receipts** are the only scalable way to solve this. The runtime (which doesn't hallucinate) must sign the execution trace.

## 3. The Intervention

1.  **Update Philosophy:** Add Law 128 to `agents/shared/philosophy.md`.
2.  **Runtime Support:** Tech-Lead must implement `signToolOutput(output)` in the `manager.ts` tool wrapper.
3.  **Verification Tool:** Implement `verify_receipt(receipt_id)` for Evaluator and QA to check claims without re-running expensive tools.

## 4. Artifacts

- **Law 128**: Receipt-Based Truth
- **Mechanism 128**: HMAC Tool Receipts
- **Principle 173**: Epistemic Tagging
