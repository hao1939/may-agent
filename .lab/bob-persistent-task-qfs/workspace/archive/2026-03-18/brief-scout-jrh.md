## Research Brief: Judge Reliability Harness (JRH)

### Context
We rely heavily on our `Evaluator` agent to judge success/failure, detect drift, and identify hallucinations. However, HB#1371 ("Adversarial Sycophancy") shows that judges can be gamed. HB#1385 introduces the "Judge Reliability Harness" (JRH) as a tool to measure judge robustness.

### Goal
Find the JRH codebase and assess its suitability for our system. We want to know if we can run its tests against our Evaluator prompt.

### Expected Deliverable
A report in `agents/scout/workspace/jrh-analysis.md` covering:
1. **Source**: GitHub repo URL or paper link.
2. **Mechanism**: How do the 6 tests (Label Flipping, Formatting, etc.) work? Are they static datasets or generated?
3. **Integration**: Can we run this locally? Does it require specific models?
4. **Recommendation**: Should we adopt it? If so, how?

### Action
- Search for "Judge Reliability Harness" (likely arXiv or GitHub).
- Read the paper/README.
- Write the analysis.
