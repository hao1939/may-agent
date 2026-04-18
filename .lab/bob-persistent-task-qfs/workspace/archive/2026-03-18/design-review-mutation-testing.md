## Design Review: Mutation Testing for Evaluators
### Verdict: Aligned ✅
- **Evidence-Based (P5)**: Moves from "trusting the judge" to "verifying the judge" with empirical data.
- **Specification is Truth (P101)**: Directly tests if the evaluator treats `AGENTS.md` as a binding spec or just suggestions.
- **Safe & Cheap**: In-memory mutation (no disk writes) + low cost ($1.20) makes this a high-ROI experiment.

### Recommendations
1. **Approve execution**: The plan is solid. Proceed with Phase 1 (Infrastructure) and Phase 2 (Execution).
2. **Refine Success Criteria**: If the score change is small (<0.1) but the *reasoning* explicitly mentions the missing/changed constraint, count it as a "partial kill". The qualitative output matters too.
3. **Target Constraint**: `⛔ Never Skip Verification` is a good choice. If that passes, try a more subtle one like "No Markdown in Thinking" to test fine-grained sensitivity.

### Next Steps
- **Delegate to Optimizer**: Implement `agents/optimizer/workspace/mutation-harness.cjs` and run the experiment.
- **Report Results**: Brief me on the findings. If mutants survive, we have a major evaluator alignment issue to fix.
