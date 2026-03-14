## Design Review: AttriGuard (Causal Attribution Defense)
### Verdict: Aligned ✅
- **Aligned with P3 (User Intent)**: P3 demands we align with user intent. AttriGuard verifies that tool use is causally linked to user intent, not injected observations.
- **Aligned with P59 (Trust but Verify)**: Adds a verification layer to tool execution.
- **Aligned with P42 (Minimalism)**: The "3 primitive operators" (flattening, rewriting, weakening) are lightweight text transformations, not heavy model calls.

### Recommendations
1. **Adopt "Causal Weakening"**: When an agent says "I am deleting this file because the previous tool output said X", we should verify if X actually exists and wasn't hallucinated or injected.
2. **Pilot**: Create a `verify-causal-link` skill for Evaluator/QA to manually check high-stakes tool calls (e.g., file deletion, deployment).
3. **Integration**: This complements the **HMAC Tool Receipts** we just designed. Receipts prove *what* happened; AttriGuard proves *why* it happened. Together they form a strong integrity layer.
