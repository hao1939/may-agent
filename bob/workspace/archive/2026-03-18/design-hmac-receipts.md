# Design: HMAC Tool Execution Receipts

**Status:** Draft
**Owner:** Bob
**Implementer:** Tech-Lead
**Reference:** arXiv:2603.10060 (NabaOS)

## Context
Agents can hallucinate tool outputs. "I checked the database and it said X" is currently trusted based on the agent's word. This is a security vulnerability and a reliability gap.
We need a mechanism to cryptographically verify that an agent *actually* ran a tool and *actually* got a specific result, without the overhead of zk-SNARKs.

## The Solution: HMAC Receipts
The runtime (infrastructure) signs every tool execution result with a secret key. The agent receives the result + the signature (Receipt). When reporting the result, the agent must cite the Receipt ID.

### Workflow
1.  **Agent calls tool**: `read_file(path="foo.txt")`
2.  **Runtime executes**: Reads file content "hello world".
3.  **Runtime signs**:
    *   Payload: `tool:read_file | input:{"path":"foo.txt"} | output_hash:sha256("hello world") | timestamp:123456789`
    *   Secret: `HMAC_SECRET` (known only to runtime/verifier, NOT agent)
    *   Signature: `hmac_sha256(payload, secret)` -> `rcpt_abc123`
4.  **Agent receives**:
    ```json
    {
      "content": "hello world",
      "receipt": "rcpt_abc123"
    }
    ```
5.  **Agent reports**: "I read foo.txt (receipt: rcpt_abc123) and it contains 'hello world'."
6.  **Verifier (QA/Evaluator) checks**:
    *   Calls `verify_receipt(id="rcpt_abc123", claim="hello world")`
    *   Runtime re-computes hash of claim and verifies HMAC.
    *   Returns: `VALID` or `INVALID`.

## Implementation Details

### 1. The Key
*   Generate a random `HMAC_SECRET` on system startup.
*   Store in memory (env var).
*   **Never** expose this key to the LLM context.

### 2. The Tool Wrapper
*   Modify `src/lib/manager.ts` (or where tools are dispatched).
*   Intercept tool result.
*   Calculate SHA256 of result (or truncated result if huge).
*   Generate HMAC.
*   Append `_receipt` field to the JSON response sent to the model.

### 3. The Verification Tool
*   New tool: `verify_receipt(receipt_id: string, claimed_content_hash?: string)`
*   If `claimed_content_hash` is provided, verifies content integrity.
*   If not, just verifies the execution happened (Proof of Execution).

## Phased Rollout
1.  **Phase 1 (Infra)**: Implement signing in `manager.ts` and `verify_receipt` tool.
2.  **Phase 2 (Pilot)**: Instruct **Scout** to include receipts in research logs.
3.  **Phase 3 (Enforcement)**: **Evaluator** fails any session that makes critical claims without receipts.

## Philosophy Alignment
*   **P59 Trust with Verification**: Directly implements this.
*   **P61 Ops Gates**: Acts as an "Evidence Gate" for tool use.
*   **P1 Simplest Thing**: HMAC is orders of magnitude simpler/faster than zk-proofs.
