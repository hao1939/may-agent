# Brief: NabaOS Tool Receipts (Tech-Lead Implementation)

**Status:** Draft
**Owner:** Bob
**Date:** 2026-03-16

## 1. Problem
Agents hallucinate "successful" tool outcomes (FM-2.6). E.g., "I fixed the bug" when the test failed, or "I read the file" when the file was empty. Downstream agents (QA/Evaluator) cannot verify this without re-running expensive tools.

## 2. Solution: HMAC Tool Receipts
Implement the **NabaOS Pattern (Law 128)**: The runtime (manager) cryptographically signs every tool output.

### 2.1 The Receipt Schema
Every tool result string is appended with a signature block:
```
[TOOL OUTPUT]
... actual content ...
[SIG: <timestamp>:<hmac_sha256(content + timestamp, SECRET_KEY)>]
```
The `SECRET_KEY` is known only to the runtime, not the agent. The agent cannot forge a receipt.

### 2.2 The Verification Tool
Implement a new tool `verify_receipt(content_with_sig: string): boolean` that:
1.  Extracts the `[SIG: ...]` block.
2.  Re-computes the HMAC of the content.
3.  Returns `true` if valid, `false` if tampered/hallucinated.

## 3. Implementation Plan
1.  **Manager Wrapper**: In `src/lib/manager.ts`, wrap `tool.run()` to append the signature.
2.  **Secret Management**: Generate a random session secret on startup (in-memory only).
3.  **Evaluator Tool**: Expose `verify_receipt` to Evaluator and QA agents.

## 4. Success Criteria
*   **Tamper-Proof**: Agents cannot manually edit tool output in their context without breaking the signature.
*   **Verifiable**: Evaluator can prove a test passed by checking the receipt, not trusting the agent's summary.
