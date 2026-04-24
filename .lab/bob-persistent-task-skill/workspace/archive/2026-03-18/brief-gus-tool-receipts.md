# Design Brief: GUS Law 128 — The Tool Receipt Principle

**Artifact:** `agents/bob/workspace/brief-gus-tool-receipts.md`
**Author:** Bob
**Date:** 2026-03-16
**Source:** `agents/scout/workspace/deep-dive-arxiv-2603-10060-nabaos-tool-receipts.md`
**Status:** Draft

## Context
Our current system relies on "trust but verify" — agents report tool outputs, and we hope they are accurate. However, agents can hallucinate successful tool executions (FM-2.1) or misinterpret output data (FM-2.5). The "NabaOS" research (arXiv:2603.10060) introduces a cryptographic method to verify tool usage without re-execution.

## 1. The Principle (Law 128)
**Law 128 (The Tool Receipt Law):**
> "Trust is not a feeling; it is a cryptographic proof. Every tool execution must generate a non-reproducible receipt that binds the input, output, and timestamp to the agent's identity."

**Corollaries:**
- **Mechanism 128 (The HMAC Receipt)**: The runtime (not the agent) signs `hash(input + output + timestamp)` with a private key. The agent receives this receipt string but cannot forge it.
- **Principle 212 (Receipt-Based Claiming)**: An agent cannot claim "I did X" without citing `[Receipt: X]`.
- **Principle 213 (Epistemic Tagging)**: Every claim must be tagged as *Direct* (Pratyakṣa), *Inferred* (Anumāna), or *External* (Śabda), supported by a receipt.

## 2. The Implementation (NabaOS Pattern)
We will implement a lightweight version of NabaOS in our `manager.ts` and `tools/` layer.

### 2.1 The Receipt Format
Every tool return value will be wrapped in a structured object:

```typescript
interface ToolReceipt {
  id: string; // UUID
  tool: string;
  input_hash: string; // SHA-256
  output_hash: string; // SHA-256
  timestamp: number;
  signature: string; // HMAC-SHA256(id+tool+input+output+time, SECRET)
  output: any; // The actual data
}
```

### 2.2 The Runtime Enforcer
1. **Generation**: `manager.ts` wraps every `tool.run()` call. It captures the result, generates the receipt, and appends the signature to the prompt history.
2. **Verification**: When an agent says "I verified file X exists", the Evaluator (or a specialized `verify-receipt` tool) checks if a valid receipt for `ls X` exists in the session history.
3. **Forgery Detection**: If an agent hallucinates `[Receipt: 12345]`, the verification fails because the signature won't match our secret key (or the ID won't exist).

### 2.3 Epistemic Tagging (Protocol)
We will update `SOUL.md` (System Prompt) to encourage agents to cite receipts:
*   "I ran the tests (Receipt: a1b2) and they passed."
*   "Based on the error log (Receipt: c3d4), I infer the DB is down."

## 3. Integration Plan
1.  **Phase 1 (Infra)**: Tech-Lead updates `src/lib/manager.ts` to generate and log HMAC signatures for all tool calls. (Already partially done with `[SIG:...]` suffix, needs formalization).
2.  **Phase 2 (Verifier)**: Tech-Lead creates a `verify_receipt(id)` tool that allows agents (and Evaluator) to validate a claim.
3.  **Phase 3 (Policy)**: Coach updates `agents/shared/common-sense.md` to require receipt citation for critical claims.

## 4. Value Proposition
- **Eliminates "Consensus Hallucination"**: Agents can't convince each other they did work they didn't do.
- **Zero-Cost Audit**: We can audit a session's truthfulness purely by checking signatures, without re-running tools.
- **Resilience**: Even if the model context is wiped, the `ops-receipts.jsonl` provides a cryptographic ledger of reality.

## 5. Next Steps
- **Approval**: May to review this brief.
- **Handoff**: Tech-Lead to formalize the existing `[SIG:...]` mechanism into the full `ToolReceipt` object.
