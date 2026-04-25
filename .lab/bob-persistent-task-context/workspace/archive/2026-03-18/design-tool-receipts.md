# Design: HMAC-Signed Tool Receipts (NabaOS Pattern)

**Problem:** We have no deterministic way to verify if an agent *actually* used a tool or just hallucinated the output. LLM self-reporting is unreliable (hallucination rate ~20-40%).
**Solution:** Implement the **NabaOS Tool Receipt** pattern (arXiv:2603.10060). The runtime (not the agent) signs a receipt for every tool execution. The agent must cite this receipt ID to claim a fact.

## 1. The Mechanism

### A. Receipt Generation (Runtime Layer)
When `manager.ts` executes a tool:
1. Generate a `receiptId` (UUID).
2. Capture `input`, `output` (truncated hash), `timestamp`.
3. Sign it: `hmac = HMAC_SHA256(receiptId + inputHash + outputHash, RUNTIME_SECRET)`.
4. Append to `.state/sessions/[sessionId]/receipts.jsonl`.
5. **Crucially**: Inject the `receiptId` into the tool output returned to the LLM.
   ```
   [Tool Output]
   Result: "Found 3 emails..."
   Receipt-ID: 550e8400-e29b-...
   ```

### B. Verification (Evaluator/QA Layer)
When auditing a session:
1. Extract `Receipt-ID` citations from agent response.
2. Look up ID in `receipts.jsonl`.
3. Verify HMAC signature (proves runtime generated it).
4. Verify `outputHash` matches what the agent claims (prevents "hallucinated tool success").

## 2. Implementation Plan

### Phase 1: Logging (The Ledger)
- Modify `src/lib/manager.ts` to log every tool execution to `receipts.jsonl`.
- Include `receiptId` in the log and the return value.

### Phase 2: Verification (The Auditor)
- Update Evaluator's `monitor-drift` task to check for "Phantom Citations" (citing a receipt that doesn't exist).

## 3. Why This Matches Philosophy
- **P1 Simplest Thing**: No ML model needed. Just crypto signatures.
- **P5 Evidence-Based**: Verification is binary (valid sig / invalid sig), not "vibe based".
- **P17 Offload to Infra**: The runtime handles truth-tracking, not the model.

## 4. Action
Delegate to Tech-Lead to implement Phase 1 in `src/lib/manager.ts`.
