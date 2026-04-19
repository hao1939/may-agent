# DD-778: EDDOps — Evaluation-Driven Development and Operations of LLM Agents

**Paper**: Xia et al., "Evaluation-Driven Development and Operations of LLM Agents: A Process Model and Reference Architecture" (arXiv 2411.13768, Nov 2024, rev. Nov 2025)  
**Rating**: ★★★★  
**Session**: 629 (CR#326 Path A — production-first evaluation literature search)  
**Tags**: #production-evaluation #continuous-evaluation #devops #reference-architecture #CR326

## Why This Paper Matters

While MAP (DD-777) documents *what* practitioners do, EDDOps proposes *how* to systematically bridge the offline/online evaluation gap. It introduces evaluation as a **continuous governing function** rather than a terminal checkpoint — directly addressing the architectural question CR#326 raises about why gym evaluation doesn't connect to production reality.

## Key Contributions

### 1. Multivocal Literature Review (MLR)
- Synthesizes both academic papers AND grey literature (industry blogs, docs, tool documentation)
- Captures evaluation practices that exist in industry but aren't in academic papers
- This methodological choice is itself important: production evaluation knowledge lives in grey literature

### 2. The EDDOps Process Model
- **Offline evaluation** (development-time): benchmarks, test suites, simulated environments
- **Online evaluation** (runtime): production monitoring, user feedback, drift detection
- **Closed feedback loop**: online evaluation evidence drives both runtime adaptation AND governed redevelopment
- Key insight: evaluation should be a **continuous function**, not a gate

### 3. Reference Architecture
- Embeds evaluation throughout the agent lifecycle
- Separates development-time and runtime evaluation but connects them via feedback
- Governance constraints and user needs as first-class evaluation inputs

## Connection to Our System

### The Missing Feedback Loop
Our current architecture has gym (offline) evaluation disconnected from production behavior. EDDOps provides the conceptual framework for connecting them:

1. **Production telemetry → Gym calibration**: Use production failure patterns to update gym task distribution
2. **Continuous evaluation**: Don't just evaluate before deployment; evaluate continuously during operation
3. **Governance-aware evaluation**: Evaluation criteria should evolve with changing objectives

### Practical Implications
- Our gym should be **downstream** of production signals, not independent of them
- The "evaluation architecture ceiling" (H-096) may be a missing feedback loop, not a missing metric
- EDDOps frames evaluation as infrastructure, not a one-time activity

## Strengths
- Grounded in both academic and industrial evidence (MLR methodology)
- Provides concrete architecture, not just principles
- Directly addresses the offline/online evaluation disconnect

## Limitations
- Reference architecture is conceptual — no empirical validation of the full EDDOps pipeline
- Doesn't quantify the improvement from closing the feedback loop
- Under review; may evolve significantly

## Cross-References
- **DD-777**: MAP documents the problem EDDOps aims to solve
- **CR#326**: EDDOps provides the process model for bridging gym–production gap
- **CR#334**: EDDOps process model maps to the 5-layer observability stack
- **H-096**: EDDOps reframes the ceiling as a missing feedback loop
- **DD-779**: Sim2Real gap shows why the offline evaluation component needs human calibration
