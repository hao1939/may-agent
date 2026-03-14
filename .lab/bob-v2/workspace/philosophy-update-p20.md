### Revised: 20. Short Chains, Verified Handoffs (P20)
**...**
**Tainted Handoffs (Error Awareness):**
A handoff is "Tainted" if the producing agent struggled (high retries, many tool errors) to generate it. Research (ThReadMed-QA, arXiv:2603.11281) shows such outputs carry **6.1×** higher risk of hidden hallucinations.
- **The Signal**: Pass `instability_metrics` (retries, error_count) with every handoff.
- **The Reaction**: If Instability > Threshold, downstream agents must use **Strict Verification** (P96) and refuse "Fast Path" optimizations.
