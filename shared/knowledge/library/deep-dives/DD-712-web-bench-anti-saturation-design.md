# DD#712: Anti-Saturation Benchmark Design — Web-Bench & Complexity Scaling

**Source**: "Web-Bench: A LLM Code Benchmark Based on Web Standards and Frameworks" (arXiv:2505.07473)  
**Authors**: Xu et al. (4 authors)  
**Date**: May 12, 2025  
**Signal**: ★★★★½ — Key design principles for anti-saturation benchmarks  
**Tags**: benchmark-design, saturation, complexity-scaling, evaluation  
**Cluster**: Gym-Production Transfer Gap

## Core Finding

**Benchmark saturation is a solved design problem — it requires sequential dependencies, real-world complexity, and professional-grade scope.** Web-Bench achieves SOTA of only 25.1% Pass@1 (Claude 3.7 Sonnet) by:

1. **50 projects, each 20 tasks with sequential dependencies** — task N depends on task N-1
2. **Real-world complexity**: each project takes **4-8 hours** for a senior engineer
3. **Grounding in standards**: Web Standards + Web Frameworks as foundational knowledge
4. **Dramatically lower than SWE-bench**: 25.1% vs 65.4% (Verified) / 33.8% (Full)

## Why Saturation Happens

The paper diagnoses saturation explicitly:
- **HumanEval**: Pass@1 reached 99.4% — benchmark is dead
- **MBPP**: 94.2% — nearly dead
- **SWE-bench Verified**: 65.4% — rapidly saturating
- **SWE-bench Full**: 33.8% — still useful but trending up

Root cause: **isolated, context-free tasks** that can be solved with pattern matching rather than understanding.

## Anti-Saturation Design Principles

From Web-Bench and analysis of failed benchmarks:

### 1. Sequential Dependencies (Most Important)
Each task builds on previous tasks. Error in task 3 cascades to tasks 4-20. This makes partial credit meaningful and prevents "lucky patch" solutions. **Production work is inherently sequential** — current benchmarks strip this away.

### 2. Professional-Grade Scope
4-8 hours of senior engineer work per project. This isn't "harder" in the sense of trickier algorithms — it's harder because it requires **sustained coherent action** over many steps. Matches production: real issues often require understanding multiple files over extended periods.

### 3. Standards and Framework Grounding
Tasks require knowledge of actual web standards (HTML spec, CSS spec, DOM API) and frameworks (React, Vue, etc.). This tests **domain expertise**, not just generic coding ability. Production agents need domain expertise too.

### 4. Project-Level Evaluation
Evaluates complete projects, not isolated patches. The agent must maintain project coherence across 20 tasks. This is the closest existing benchmark to production conditions.

## Relevance to Our Gym-Production Gap

### What Web-Bench Gets Right (That Our Gym Gets Wrong)

| Dimension | Web-Bench | Our Gym | Production |
|-----------|-----------|---------|------------|
| **Dependencies** | 20 sequential tasks | Independent scenarios | Continuous codebase |
| **Context size** | Growing across tasks | ~10KB fixed | 50-200KB+ |
| **Duration** | 4-8 hours senior eng | ~5 min per scenario | Hours-days |
| **Coherence** | Must maintain across tasks | Fresh each scenario | Must maintain always |
| **Domain knowledge** | Standards + frameworks | Generic coding | Project-specific |
| **Evaluation** | Project-level | Binary pass/fail | Multi-dimensional |

### What Web-Bench Still Misses

- **No interruptions or concurrent tasks** — production agents handle multiple things
- **No ambiguous requirements** — production issues are often underspecified  
- **No review feedback loops** — production has iterative PR review
- **No time pressure or resource constraints** — production has deadlines
- **No multi-session context degradation** — our FM-3.3 trigger

## Design Implications

### For Gym Redesign

The path to closing the gym-production gap is NOT:
- ❌ "Make tasks harder" (informational load ≠ real complexity)
- ❌ "Add more skills" (80% are inert per DD#711)
- ❌ "Increase file count" (EXP-107 Wave 2: 4 files still 0% FM-3.3)

The path IS:
- ✅ **Sequential multi-step tasks** (accumulated state, cascading dependencies)
- ✅ **Growing context** (each step adds to what agent must track)
- ✅ **Design constraints** (DD#710: implicit rules that tests don't check)
- ✅ **Coherence evaluation** (does the solution maintain consistency across steps?)
- ✅ **Duration** (sustained engagement, not sprint-length scenarios)

## Complementary Papers

| Paper | What It Adds |
|-------|-------------|
| **Gym-Anything (2604.06126)** | Framework for converting real software into agent environments (500+ step tasks) |
| **CLI-Tool-Bench (2604.06742)** | 0-to-1 generation benchmark, top models <43%, structure-agnostic |
| **UI-CUBE (2511.17131)** | Enterprise UI tasks: 67-85% simple → 9-19% complex (capability cliff) |
| **Agent-CoEvo (2604.04580)** | Tests themselves need to coevolve — static tests are misaligned |
| **Agentic Memory (2602.19320)** | Memory benchmarks also saturated — domain-general problem |

## Connection to KE-101

This validates Law 5 (structural compatibility) at the evaluation level: benchmarks that test isolated pattern-matching are structurally incompatible with production demands. The structure of the evaluation must match the structure of the production environment.
