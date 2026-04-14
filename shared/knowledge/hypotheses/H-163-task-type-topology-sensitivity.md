# H-163: Task-Type Topology Sensitivity — Optimal Communication Graph Varies by Task Category

**Created**: 2026-04-14 by Bob
**P(H)**: 0.65
**Source**: DD-616 (Agent Q-Mix), DD-617 (Coordination Primacy Hypothesis), KE-086 (Multi-Agent Architecture Scaling)
**Status**: Proposed — not yet tested

## Claim

Our multi-agent system's performance varies significantly by communication graph topology, and the **optimal topology differs by task type**:

- **Research tasks** (synthesis, hypothesis generation, deep-dive analysis): Optimal topology is tight Scout↔Bob coupling with minimal other-agent involvement. Adding Architect/Coder to the communication graph adds cost without quality benefit.
- **Implementation tasks** (bug fixes, feature development, guard deployment): Optimal topology is Coder↔Coach coupling with Architect oversight. Adding Scout/Bob to the loop adds latency without implementation benefit.
- **Design tasks** (briefs, specs, experiment design): Optimal topology is Bob→Architect→Tech-Lead chain. Parallel involvement of other agents degrades rather than improves design quality (context contamination per H-097).

The key mechanism (from DD-616's L44 — Topology-Coordination Equivalence): topology selection and coordination protocol design are computationally equivalent. Optimizing which agents communicate for which task types IS the coordination optimization.

## Predictions

- **P-163a**: Research task quality (KE quality score) will not differ between current all-dispatch and research-restricted (Scout+Bob only) topologies, but cost will be 30%+ lower in the restricted case.
- **P-163b**: Implementation task quality will not differ between current all-dispatch and implementation-restricted (Coder+Coach+Optimizer) topologies, but latency will be 20%+ lower.
- **P-163c**: Cross-type topology mixing (e.g., involving Coder in research tasks, involving Scout in implementation tasks) will show no quality benefit and measurable cost increase.
- **P-163d**: If/when agent count exceeds ~10, topology sensitivity will increase and manual dispatch will become a bottleneck (connects to KE-086's N* ≈ 20-64 prediction).

## Evidence

### Supporting (External)
- **DD-616**: Agent Q-Mix shows dynamic topology outperforms static across 7 benchmarks. Topology matters.
- **DD-617**: CPH — coordination protocol > model scaling. Topology is the primary coordination variable.
- **DD-573**: LLMs cannot coordinate implicitly. Communication must be architecturally forced (connects to topology as structural choice).

### Supporting (Internal)
- **KE-086 Pattern 3**: Hierarchy vs. Market vs. Middleware are same problem at different layers — and they apply to different task types
- **H-097**: CCC Triad — context isolation requirement implies not all agents should see all communications
- **KE-086 Pattern 1**: "Produce in parallel, verify at boundary" — the boundary structure (topology) determines quality

### Against
- Manual dispatch already provides implicit task-type conditioning (Hao selects which agents to involve)
- System is small (~7 agents); unused communication links have near-zero marginal cost
- DD-616 was tested at 8-512 agents; effects may not manifest at our scale

## Falsification Criteria

H-163 is **falsified** if:
1. Quality and cost are indistinguishable between topology configurations across 3+ task types (N≥10 per type)
2. OR random topology assignment performs equivalently to task-matched topology assignment

## Experiment Design (sketch)

**Natural experiment approach** (preferred — no gym cost):
1. Tag 30+ production sessions by task type (research/implementation/design)
2. Tag by communication graph used (which agents were involved)
3. Compare quality and cost by topology×task-type matrix
4. Test for interaction effect: does topology matter more for some task types?

**Limitation**: Observational only. Confounded by Hao's dispatch decisions (which are already partially task-type-conditioned).

## Connections

- **Extends**: KE-086 (adds task-type as topology selector variable)
- **Revives**: Archived H-048 (dynamic topology optimization) — DD-616 provides the missing mechanism
- **Extends**: H-097 (CCC Triad's context isolation leg implies topology-dependent communication)
- **Connects**: DD-616 L44 (Topology-Coordination Equivalence)
- **Connects**: DD-617 CBS (Coordination Breakeven Score) — CBS would differ by task type if topology sensitivity holds

## Tags
`multi-agent`, `topology`, `coordination`, `task-type`, `communication-graph`, `DD-616`, `DD-617`
