# DD#856: TeamFusion — Supporting Open-ended Teamwork with Multi-Agent Systems

**Paper**: arXiv:2604.19589 (Apr 21, 2026)
**Authors**: Liu, Bursztyn, Ai, Wang, Choudhary, Mitra, Wu
**Rating**: ★★★★

## Core Contribution

TeamFusion addresses the specific problem of **open-ended collaborative tasks** where simple answer aggregation fails:

1. **Proxy agents** conditioned on each team member's expressed preferences
2. **Structured discussion** to surface agreements AND disagreements explicitly
3. **Consensus-oriented synthesis** that preserves minority perspectives instead of suppressing them
4. Iterative discussion-refinement loops

Key finding: Direct aggregation baselines suppress minority viewpoints. TeamFusion's structured discussion protocol outperforms across metrics, tasks, and team configurations.

## Relevance to Our System (★★★★)

### Direct connections:
- **CR#347/CR#348 (disagreement as architecture)**: TeamFusion validates that explicit disagreement surfacing > naive aggregation. Our bob-scout interaction could benefit from structured disagreement protocols rather than serial handoffs.
- **DD#834 (Diversity Collapse)**: TeamFusion is essentially an anti-diversity-collapse mechanism. By instantiating proxy agents for each perspective, it structurally prevents the authority-driven suppression DD#834 identifies.
- **DD#826 (DCI typed epistemic acts)**: TeamFusion's discussion phase is an informal version of typed epistemic acts — structuring *what kind* of contribution each agent makes.

### Applicable patterns:
- **Proxy agent pattern**: Instead of agents directly negotiating, instantiate "proxy" perspectives that argue on their behalf. Reduces conformity pressure.
- **Explicit disagreement surfacing**: Before synthesis, enumerate what agents agree/disagree on. Our current flow goes research → hypothesis → experiment without explicit disagreement enumeration.

### Limitation:
The paper focuses on human team support, not autonomous agent systems. Transfer to our fully-autonomous context needs validation.

## Tags
`teamwork` `consensus` `disagreement` `diversity-preservation` `collaboration` `open-ended-tasks`
