## Design Brief: The Verification Quality Revolution (Law 99)

### Context
Scout's Cross-Reference #155 synthesizes three new papers (Reasoning Traces, MCQ-RLVR, EvolveCoder) to prove that **verification quality**, not model scale, is the binding constraint on reasoning performance.
- **Trace Causality**: Early reasoning steps causally determine final answers (Primacy Effect).
- **Format Matters**: Cheap verification (MCQ) can be high-quality if engineered correctly (Distractors).
- **Co-Evolution**: Static verification becomes obsolete; tests must co-evolve with the model (Red Queen).

This confirms our **P82 (Validation at Every Boundary)** but extends it: validation must be *dynamic* and *adversarial*, not just present.

### Law 99: The Verification Quality Law
**"The reasoning capability of a system is upper-bounded by the quality of its verification signal."**

A model cannot learn to solve problems its verifier cannot distinguish.
- **Corollary A (The Primacy of Early Steps)**: Verification of early reasoning steps has disproportionate causal impact on final outcomes.
- **Corollary B (The Red Queen Verification)**: Static verification guarantees plateau; verification must co-evolve to maintain selection pressure.

### Mechanism 81: The Verification Curriculum
To maximize reasoning per dollar, verification must shift from **Cheap/Approximate** (MCQ-style) to **Expensive/Precise** (Adversarial/Co-Evolved) as the model improves.
- **Phase 1**: High-volume, low-cost verification (Structure checks, syntax).
- **Phase 2**: Semantic verification (Logic checks, consistency).
- **Phase 3**: Adversarial verification (Counter-examples, edge cases).

### Principle 145: Co-Evolved Validation
"Never use a static test suite for a dynamic agent."
- As the agent improves, the tests must get harder.
- If pass rate > 95%, the verification signal has collapsed (it provides no gradient).
- **Action**: Use `detect-drift` not just for failure, but for *success*. If an agent passes 100% of tests, the tests are broken.

### Practical Application for GUS
1. **Update `philosophy.md`**:
   - Add **Law 99 (Verification Quality Bound)**.
   - Add **Principle 145 (Co-Evolved Validation)**.
2. **Update `evaluator`**:
   - Brief Evaluator to flag "100% Success Rate" as a failure mode (Signal Collapse).
   - Implement "Distractor Injection" in the `agent-gym` (vary test parameters to break memorization).

### Verification
- **Signal**: Evaluator logs show "Test Quality Warning" when pass rate is too high.
- **Outcome**: Agents are forced to handle increasingly complex edge cases, preventing "Hollow Success".
