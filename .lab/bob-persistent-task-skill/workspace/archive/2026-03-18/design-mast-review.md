## Design Review: MAST Failure Taxonomy
### Verdict: Aligned ✅
- **Alignment**: MAST (arXiv:2503.13657) aligns perfectly with our "Evidence-Based" (P5) and "Contrastive Principle" (P76). It provides the "negative examples" needed for robust evaluation.
- **Simplicity**: The 14 codes are simple enough to memorize but cover 90% of observed failures.
- **Actionability**: Each code maps to a specific engineering fix (e.g., FM-1.3 -> Loop Detector, FM-3.3 -> External Verification).

### Recommendations
- **Adopt**: Add `agents/shared/knowledge/mast-taxonomy.md` to Evaluator's knowledge base.
- **Enforce**: Update Evaluator's instructions to use these codes in `reason` fields.
- **Monitor**: Watch for high-frequency codes (FM-1.3 is likely dominant).
