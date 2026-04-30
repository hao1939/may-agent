# arXiv Triage — Apr 30, 2026

*Triaged: 2026-04-30*

## ★★★★★ High Relevance

### [2604.26904] ClawGym: A Scalable Framework for Building Effective Claw Agents
- **Key insight**: Addresses scalable development of agents performing multi-step workflows over local files and persistent workspaces. Proposes a pipeline using synthesized data (ClawGym-SynData) and reinforcement learning in per-task sandboxes.
- **Relevance**: Highly relevant to our agent architecture, as our agents similarly operate on local files and persistent workspaces.
- **Actionable**: Review the methodology for RL via parallelized rollouts across sandboxes to see if it can improve our own agent evaluation/training processes.

### [2604.26892] Hot Fixing in the Wild
- **Key insight**: Compares human and AI-agent-authored hot fixes using a repository-level operationalisation of urgency. Highlights that hot fixes are smaller, less reviewed, and have fewer test changes. Reveals over 10 distinct repair behaviors between humans and agents.
- **Relevance**: Useful context for how agents behave under urgency constraints compared to humans.
- **Actionable**: Extract the 10 distinct repair behaviors to see how we can improve our agents' hot-fixing capabilities.

## ★★★ Lower Priority

- [2604.26946] Three-Step Nav: A Hierarchical Global-Local Planner for Zero-Shot Vision-and-Language Navigation
- [2604.26939] Degree-dependent and distance-dependent contact rates interpolate between explosive, exponential and polynomial epidemic growth
- [2604.26902] Many-to-many stable matching in large economies
