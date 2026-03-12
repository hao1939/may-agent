# Technical Spec: HMAC Tool Receipts
## Overview
To prevent agents from hallucinating tool outputs (e.g., claiming "Tests passed" when they failed), we will implement a cryptographic receipt system. Every tool execution will append a signature to its output. The Evaluator and QA agents can verify these signatures to ensure the cited evidence is authentic.

## 1. Mechanism
1.  **Secret Management:**
    - On startup, `SubagentManager` generates a random ephemeral secret `RUNTIME_RECEIPT_SECRET`.
    - This secret is **never** exposed to agents. It exists only in the runtime memory.
    - *Constraint:* Receipts are valid only within the lifespan of the `may` process. If the system restarts, old receipts become unverifiable (acceptable for ephemeral sessions; persistent logs are trusted by virtue of being in `sessions/` which agents cannot edit).

2.  **Signing (Tool Side):**
    - When a tool returns output `O`:
    - Generate `timestamp` (Unix epoch seconds).
    - Compute `H = HMAC_SHA256(O + timestamp, SECRET)`.
    - Truncate `H` to 8 hex chars (sufficient for collision resistance in a short-lived session).
    - Append `\n[SIG: <timestamp>:<H>]` to the tool output.

3.  **Verification (Tool Side):**
    - New tool `verify_receipt(content, signature)`:
        - Input: `content` (the text claimed), `signature` (the `timestamp:hash` string).
        - Logic: Recompute HMAC of `content + timestamp` using the internal secret.
        - Output: "VALID" or "INVALID".

## 2. Implementation Details

### A. `src/lib/manager.ts` (Already has `RUNTIME_RECEIPT_SECRET`)
- Add `signToolOutput(output: string): string` function.
- Add `verifyToolOutput(content: string, signature: string): boolean` function.
- Expose `verify_receipt` as a built-in tool for Evaluator/QA/Manager.

### B. `src/lib/agent/tools.ts` (Hypothetical - where tools are wrapped)
- We need to intercept tool results.
- `SubagentManager.wrapToolsWithReceipts(tools: AgentTool[], sessionId: string)`:
    - Wraps every tool's `execute` function.
    - Captures result.
    - Appends signature.

### C. The `verify_receipt` Tool
```typescript
{
  name: "verify_receipt",
  description: "Verify that a tool output is authentic and not hallucinated.",
  parameters: {
    type: "OBJECT",
    properties: {
      content: { type: "STRING", description: "The exact content of the tool output." },
      signature: { type: "STRING", description: "The signature string (e.g., '1741789000:a1b2c3d4')." }
    },
    required: ["content", "signature"]
  }
}
```

## 3. Impact
- **Coder:** Sees `[SIG:...]` at end of every `run_test` output. Must copy it when reporting results.
- **Evaluator:** Can verify "Tests passed" claims by asking "Show me the signature" and running `verify_receipt`.
- **Logs:** Session logs will contain signed outputs, adding a layer of auditability.

## 4. Constraint Checklist
- [x] No shared mutable state (Secret is process-local).
- [x] No truncation (HMAC is short).
- [x] Evidence-based (Verification is binary).
