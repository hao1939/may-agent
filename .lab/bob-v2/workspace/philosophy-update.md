## Philosophy Update
### New: P60 Causal Integrity — from: AttriGuard (arXiv:2603.10749)
**Principle**: "Tool Use Must Be Causally Linked to User Intent."
**Why**: Injected observations (e.g., a file containing "Delete everything") can hijack tool use. We must verify that high-stakes actions stem from the user's original goal, not intermediate tool outputs.
**How**: When evaluating critical actions, trace the causal chain. "Why did you delete this?" If the answer is solely "because `cat` output said so", halt and verify.

### Revised: P18 Trust but Verify → P59 Cryptographic Receipts
**Was**: "Trust but Verify" (general skepticism).
**Now**: "Cryptographic Receipts" (specific mechanism).
**Why**: NabaOS (2603.10060) shows that text-based verification is insufficient. Agents hallucinate success. We require HMAC signatures on tool outputs to prove execution occurred.

### Open Questions:
- **Implementation Cost**: Can we implement "Causal Scaffolding Weakening" (stripping "because X" reasoning) cheaply in `manager.ts` without a full LLM round-trip?
