## Design Review: JRH Evaluation Layer

### Verdict: Aligned ✅

The discovery of the Judge Reliability Harness (JRH) aligns perfectly with our **Generator-Verifier-Reviser** architecture and the need for robust evaluation (P108/P120).

### Findings
- **Comprehensive Reliability Testing**: JRH tests for Label Flipping, Formatting Invariance, Semantic Paraphrasing, Verbosity Bias, Stochastic Stability, and Ordinal Calibration.
- **Direct Application**: These tests can harden our `Evaluator` and prevent "Adversarial Sycophancy" (HB#1371) where the judge is gamed by the agent.
- **Source**: HB#1385 (XHS@饿鱼很饿等吃饱了就不饿了).

### Recommendations
1. **Adoption**: Adopt JRH as the standard for evaluating our Evaluator agent itself.
2. **Implementation**: Scout should research the specific Python library/repo. Tech-Lead should integrate a subset of JRH tests into `test/gym/adversarial-judge-test.cjs`.
3. **Philosophy**: This moves us from "Manual Audit" to "Automated Reliability Testing" for the evaluation layer itself.

### Action
- Create `agents/bob/workspace/brief-scout-jrh.md` to task Scout with deep-diving the repo.
- Task Tech-Lead with implementation after Scout's report.
