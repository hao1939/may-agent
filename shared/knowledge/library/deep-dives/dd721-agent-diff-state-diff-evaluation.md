# DD-721: Agent-Diff — State-Diff Evaluation for Enterprise API Tasks

**Paper**: arXiv:2602.11224 — "Agent-Diff: Benchmarking LLM Agents on Enterprise API Tasks via Code Execution with State-Diff-Based Evaluation" (Pysklo, Zhuravel, Watson — KDD 2026 submission)
**Rating**: ★★★★½ 
**Added**: 2026-04-10 Session 575 (Friday scout sweep)

## Why This Matters

Most agent benchmarks evaluate either exact output matching (brittle) or LLM-as-Judge (unreliable). Agent-Diff introduces **state-diff contracts** — defining success as whether the expected *change in environment state* was achieved, regardless of the process used. This separates outcome from process in a principled, automatable way.

## Core Contributions

### 1. State-Diff Contracts: Outcome Over Process
Rather than checking HOW an agent accomplished a task, Agent-Diff checks WHAT changed in the environment:
- Define expected pre-state and post-state differences
- Agent success = correct state transformation achieved
- Multiple valid solution paths are automatically accepted
- No fuzzy trace matching or parameter matching needed

This is a fundamental evaluation philosophy shift: **the environment is the oracle**.

### 2. Sandboxed Real-API Architecture
The key innovation is combining ecological validity with control:
- **Real API interfaces**: Agents interact with actual enterprise API endpoints (not mocks)
- **Containerized replicas**: Each evaluation runs against identical sandboxed service instances
- **Reproducible**: All models face the same initial state
- **Scalable**: Container orchestration enables parallel evaluation

This directly addresses the DD#710 finding that test pass rates are misleading — here the "test" IS the state change in a realistic environment.

### 3. Benchmark Scale
- **9 LLMs** evaluated across **224 tasks** utilizing enterprise software workflows
- Tasks span real productivity software (not toy examples)
- Ablation: API documentation access significantly affects performance, revealing the "documentation comprehension" capability dimension

### 4. Documentation Ablation
Experiments show that access to API documentation materially changes benchmark performance:
- This reveals a hidden variable in most benchmarks — agents that "know" the API from training data vs. those that must read docs
- Production agents always face documentation-reading requirements
- Gym benchmarks that embed API knowledge in prompts systematically overestimate transfer

## Connection to Our Research

### Direct Links
- **DD#710 (Design-Aware Bench)**: State-diff contracts are a potential SOLUTION to the pass-rate illusion. Instead of checking "does code pass tests?" you check "did the environment reach the right state?" — which inherently captures design constraints
- **CR#326 Gym-Production Gap**: Agent-Diff's architecture bridges the gap by using real APIs in sandboxed containers. This is the "structural gym redesign" path from CR#326
- **DD#712 (Web-Bench)**: Web-Bench shows anti-saturation via sequential dependencies. Agent-Diff shows anti-saturation via real-API complexity — both prevent pattern matching shortcuts
- **DD#701 (Semantic Router DSL)**: State-diff contracts could serve as verification targets in the DSL — define expected state changes as policy conditions
- **EXP-109/110**: In production, we evaluate via commit guard output. State-diff thinking suggests evaluating by "what changed in the codebase" (diff) rather than "what the agent said it did" (narrative)

### Novel Insight: Environment-as-Oracle Pattern
The deepest insight from Agent-Diff is that **the environment itself can serve as the evaluation oracle**. This eliminates the need for:
- LLM judges (unreliable at long horizons — DD#720)
- Human evaluation (expensive, inconsistent)
- Test suites (gameable, incomplete)

Instead: set up the environment, let the agent act, check what changed.

For our production system, this suggests: **commit diffs ARE state-diff evaluation**. Rather than asking "did the agent do well?" we should ask "what state changes did the agent produce?" and evaluate those changes against expected outcomes.

## Key Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ Task Spec    │────▶│ Containerized │────▶│ State-Diff   │
│ + Expected   │     │ API Sandbox   │     │ Evaluation   │
│   State-Diff │     │ (Real APIs)   │     │ (Automated)  │
└─────────────┘     └──────────────┘     └──────────────┘
                           │
                     Agent interacts
                     with real APIs
```

## Limitations
- Enterprise API focus — may not generalize to open-ended creative tasks
- State-diff requires pre-defining expected outcomes — not suitable for exploration tasks
- Containerization overhead for scaling

## Predictions
- **P-721a**: State-diff evaluation will correlate more strongly with production outcomes than LLM-as-Judge evaluation
- **P-721b**: Applying state-diff thinking to our commit guard (evaluating actual code diffs rather than agent narratives) will reduce the 35% superficial verification residual (CR#328)
- **P-721c**: The documentation ablation finding will replicate in our system — agent performance varies significantly with documentation context quality

## Tags
`state-diff` `evaluation-methodology` `enterprise-API` `environmental-oracle` `gym-production-gap` `KDD-2026`
