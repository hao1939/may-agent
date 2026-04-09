# DD#628 — Self-Execution Simulation Improves Coding Models

**Source**: arXiv:2604.03253 (Maimon, Yoran, Kreuk, Hassid, Cohen, Chambon, Adi — FAIR/Hebrew University)
**Date discovered**: 2026-04-07 (Session 302)
**Rating**: ★★★★ HIGH
**Tags**: #coding-agents #self-verification #execution-simulation #reinforcement-learning #harness-engineering

## TL;DR

Code LLMs can be trained to mentally simulate program execution step-by-step, enabling self-verification of generated code without actually running it. The approach combines SFT on natural language execution traces with RL using verifiable rewards, yielding consistent improvements on competitive programming benchmarks.

## Key Findings

1. **Execution Simulation as a Learnable Skill**: Models learn to trace through code step-by-step in natural language, predicting intermediate states and outputs. This isn't just "reasoning about code" — it's structured execution modeling grounded in actual program behavior.

2. **Two Complementary Objectives**: 
   - Output prediction given code + inputs (teaches the model what code *does*)
   - Solving competitive programming with self-predicted execution feedback (teaches the model to *use* its simulation ability)

3. **Self-Verification Pipeline**: Model generates multiple candidate solutions → simulates execution on test cases → selects the one whose simulated output matches expected output. This is verification without a sandbox.

4. **Iterative Self-Fixing**: When simulation reveals a bug, the model can fix code by understanding *where* execution diverges from intent. This closes the generate→verify→fix loop internally.

## Why This Matters for Our Research

### Connection to Harness Engineering (CR#302, DD#575)
This is the **internal harness** — the model carrying its own test execution environment. Rather than relying on external sandboxes, the model builds a mental model of program behavior. This is the asymptotic limit of harness engineering: when the agent itself *becomes* the harness.

### Connection to Agent Self-Verification (DD#605, CR#307)
The Decoction Architecture (CR#307) posits that agents should extract and compress experience. Self-execution simulation is a form of "decocted execution" — the model has internalized enough execution traces that it can simulate new ones. This suggests the decoction pathway extends to *operational* knowledge, not just declarative.

### Connection to Tool Illusion (DD#621)
The Tool Illusion paper argued that tools are syntactic wrappers around reasoning the model already does. Self-execution simulation provides the mechanism: if a model can simulate `python test.py` internally, the tool becomes redundant for verification. The value of external execution then shifts from "correctness checking" to "ground truth calibration" — keeping the internal simulator honest.

### Implications for Coding Agents
For systems like Claude Code, Nanocode (DD#625), and Modo (DD#626), this research suggests a path toward:
- **Reduced sandbox dependency**: Agents that can pre-filter obviously wrong solutions before expensive execution
- **Better reasoning about edge cases**: Internal simulation forces the model to think through specific inputs
- **More efficient exploration**: Self-verification narrows the candidate space before external validation

## Limitations & Open Questions

1. **Simulation fidelity**: How accurate is the mental model for complex programs? The paper shows competitive programming — real-world code with I/O, state, concurrency is much harder to simulate.
2. **Calibration risk**: If the model's simulator is wrong but confident, it may reject correct solutions. The Tool Illusion paper's warning applies here — ground truth execution remains the ultimate arbiter.
3. **Scaling question**: Does simulation accuracy scale with model size, or does it plateau? This determines whether internal verification can ever fully replace external.

## Patterns & Predictions

**P391**: Internal execution simulation will be integrated into coding agent pipelines as a pre-filter before sandbox execution, reducing token waste on obviously incorrect solutions by 40-60%. (Timeframe: 6 months)

**P392**: The next step will be *multi-step* execution simulation across function calls and module boundaries — moving from single-function to whole-program mental simulation. (Timeframe: 12 months)

## References

- **R122**: Connects to DD#605 (Decocted Experience) — execution traces as a form of experiential knowledge
- **R123**: Connects to DD#621 (Tool Illusion) — self-simulation as the mechanism underlying tool redundancy
- **R124**: Connects to DD#575/CR#302 (Constitutional Meta-Engineering) — the agent's internal harness as the ultimate harness
