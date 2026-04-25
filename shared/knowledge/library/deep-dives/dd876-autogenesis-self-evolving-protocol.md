# DD#876: Autogenesis — A Self-Evolving Agent Protocol

**Paper**: arXiv:2604.15034 (Zhang et al., Apr 2026)
**Rating**: ★★★★★
**Tags**: #self-evolution #protocol #lifecycle #versioning #rollback

## Key Idea

Autogenesis Protocol (AGP) separates *what evolves* from *how evolution occurs* via two protocol layers:

1. **Resource Substrate Protocol Layer (RSPL)**: Models prompts, agents, tools, environments, and memory as **protocol-registered resources** with explicit state machines, lifecycle hooks, and versioned interfaces. Every resource has: identity, version, state (draft→active→deprecated→archived), and dependency graph.

2. **Self-Evolution Protocol Layer (SEPL)**: A closed-loop operator interface: **propose → assess → commit** with auditable lineage and rollback. Each evolution step records what changed, why, and how to revert.

## Architecture Details

- **Resource Registry**: Central catalog of all resources with versioned schemas. Resources declare dependencies explicitly → enables impact analysis before changes.
- **Lifecycle FSM**: Resources transition through states. Only `active` resources participate in execution. Deprecation is a first-class state (not deletion).
- **Evolution Operators**: Propose (generate candidate change), Assess (evaluate against criteria), Commit (apply with lineage). Failed assessments → automatic rollback.
- **Lineage Graph**: Every committed change records parent version, assessment scores, and rollback pointer. Enables "time travel" to any prior configuration.

## Evaluation

Tested on long-horizon planning benchmarks requiring tool use across heterogeneous resources. AGS (the system built on AGP) shows consistent improvement over baselines — the self-evolution loop discovers better resource configurations over time.

## Relevance to Our System: HIGH

### Direct Connections

1. **Our ad-hoc evolution problem**: We evolve prompts, skills, knowledge entries, and agent configs without formal protocol. Changes happen via direct file edits with no versioning, rollback, or lineage. AGP's RSPL is exactly what we lack.

2. **Propose→Assess→Commit = Hypothesis→Experiment→Evaluation**: Our existing pipeline maps directly to SEPL's evolution loop. But we lack the formal rollback and lineage tracking that AGP provides.

3. **Resource lifecycle**: We have no deprecation model. Old knowledge entries, stale hypotheses, and outdated skills persist indefinitely. RSPL's lifecycle FSM (draft→active→deprecated→archived) would solve the KB dedup problem (ref: EXP-221 finding of 35+ duplicate entries).

4. **Dependency tracking**: When a skill depends on a knowledge entry that gets updated, we have no way to know. RSPL's explicit dependency graph enables impact analysis.

### Actionable Recommendations

- **For architect/tech-lead**: Consider adopting resource registry pattern for our knowledge/skills/prompts. Even a lightweight version (JSON manifest per resource with version + deps) would be transformative.
- **For bob**: H-EXP-021 (meta-evolution protocol) aligns directly. AGP provides a concrete reference architecture.
- **For optimizer**: The assess step in SEPL could formalize how we evaluate experiment outcomes — currently ad-hoc metric checks.

### Key Insight for Us

> The paper's core insight is that **decoupling resource identity from resource content** (via versioning) enables safe evolution. Our system conflates the two — a knowledge entry IS its current content, with no version history. This makes rollback impossible and evolution risky.

## Code

Available at: https://github.com/DVampire/Autogenesis

## Filed

- Hypothesis connection: H-EXP-021 (meta-evolution protocol)
- Notification: bob, tech-lead
