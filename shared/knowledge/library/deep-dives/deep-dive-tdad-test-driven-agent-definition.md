# Deep Dive: Test-Driven AI Agent Definition (TDAD) — Compiling Tool-Using Agents from Behavioral Specifications

## Metadata
- **Paper**: arXiv:2603.08806
- **Title**: Test-Driven AI Agent Definition (TDAD): Compiling Tool-Using Agents from Behavioral Specifications
- **Authors**: Tzafrir Rehan
- **Published**: March 2026
- **Domain**: Agent Safety Engineering, Behavioral Compliance, Specification Testing
- **Code**: https://github.com/f-labs-io/tdad-paper-code

## Rating: ★★★★ HIGH RELEVANCE

## Core Contribution

TDAD treats **agent prompts as compiled artifacts** rather than hand-crafted text. Engineers provide behavioral specifications, a coding agent converts them into executable tests, and a second coding agent iteratively refines the prompt until tests pass. This is "test-driven development" applied to agent behavior — the prompt is the compiled output, specifications are the source code.

## Architecture

### Three-Phase Pipeline
1. **Specification → Test Compilation**: Behavioral specs are converted into executable test suites by a coding agent
2. **Test → Prompt Compilation**: A second coding agent iteratively refines the prompt until all visible tests pass
3. **Verification**: Hidden tests (withheld during compilation) verify the agent actually learned the specified behavior, not just the tests

### Anti-Gaming Mechanisms
1. **Visible/Hidden Test Splits**: The agent never sees evaluation tests during compilation — prevents teaching-to-the-test
2. **Semantic Mutation Testing**: A post-compilation agent generates plausible faulty prompt variants; the test suite must detect them (mutation score 86-100%)
3. **Spec Evolution Scenarios**: When requirements change, regression safety is measured — new features shouldn't break old behavior

## Key Results

| Metric | Result |
|--------|--------|
| V1 Compilation Success | **92%** (across 24 independent trials) |
| Mean Hidden Pass Rate | **97%** |
| V2 Evolution Compilation | **58%** |
| Mutation Scores | **86-100%** |
| V2 Hidden Pass Rate | **78%** |
| Regression Safety Score | **97%** |

### SpecSuite-Core Benchmark
Evaluated on 4 deeply-specified agent types:
1. **Policy Compliance Agent** — follows organizational rules
2. **Grounded Analytics Agent** — provides data-grounded answers
3. **Runbook Adherence Agent** — follows operational procedures
4. **Deterministic Enforcement Agent** — enforces fixed rules without exception

## Why This Matters for Safety

### 1. Prompts as Auditable Artifacts
Current practice: prompts are manually crafted, opaque, and untested. TDAD makes prompts:
- **Specification-derived**: traceable to behavioral requirements
- **Test-verified**: every behavior has an executable test
- **Regression-safe**: changes don't silently break existing behavior

### 2. Anti-Specification Gaming
The visible/hidden split + mutation testing addresses a critical problem: agents that game their evaluation criteria. This is the behavioral analog of AutoControl Arena's Alignment Illusion — systems that appear compliant but aren't.

### 3. Evolution Safety
97% regression safety score means agent behavior is stable across specification changes. This addresses the catastrophic forgetting problem identified across our portfolio.

## Connections to Our Research Portfolio

### Strong Connections
- **Extends Traversal-as-Policy (2603.05517)**: Both externalize agent behavior for verification. GBT externalizes the decision policy; TDAD externalizes the behavioral specification. Together they create a fully verifiable agent: specification → test → prompt → policy → execution
- **Addresses AutoControl Arena's (2603.07427) measurement gap**: TDAD's hidden tests prevent the "teaching to the test" problem that plagues safety benchmarks
- **Complements PRISM (2603.11853)**: TDAD ensures agents are correctly specified at design time; PRISM monitors them at runtime. Design-time + runtime = full lifecycle safety
- **Connects to DBC (2603.04837)**: DBC provides 150 governance controls as system prompts; TDAD provides the methodology to TEST those controls against specifications

### Novel Insights
1. **"Prompt as compiled artifact"** is a paradigm shift — treating LLM configuration as software engineering, not art
2. **Mutation testing for prompts** is brilliant — validates that the test suite can catch behavioral deviations
3. **Specification evolution** addresses the real-world problem of changing requirements without breaking existing safety guarantees
4. **97% regression safety** demonstrates that behavioral stability is achievable

### Synthesis: The Full Verification Stack

With TDAD and Traversal-as-Policy together, we now have a complete agent verification stack:

```
Layer 5: Specification (TDAD) — What should the agent do?
Layer 4: Test Suite (TDAD) — How do we verify it?
Layer 3: Compiled Prompt (TDAD) — The agent's configuration
Layer 2: Policy Tree (GBT) — The agent's decision structure
Layer 1: Runtime Monitor (PRISM) — Execution-time safety
Layer 0: Pre-Execution Gate (ToolSafe) — Action-level blocking
```

Each layer is independently verifiable, auditable, and testable. Failures at one layer are caught by the next. This is defense-in-depth for agent safety.

## Limitations
- 58% V2 compilation success suggests specification evolution is still challenging
- Only 4 agent types in SpecSuite-Core — limited domain coverage
- Doesn't address adversarial attacks that bypass specifications
- Single-model evaluation — no multi-model comparison
- Relies on LLM quality for test generation — may miss specification gaps

## Bottom Line
TDAD transforms agent development from artisanal prompt craft into **rigorous software engineering**. The "prompt as compiled artifact" paradigm, combined with hidden test splits and semantic mutation testing, creates a verifiable development process that catches behavioral deviations before deployment. When combined with Traversal-as-Policy and runtime monitoring, this completes a full verification stack from specification to execution. The 97% regression safety score demonstrates that behavioral stability under evolution is achievable.
