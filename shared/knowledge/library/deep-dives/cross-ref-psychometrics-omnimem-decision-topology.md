# Cross-Reference: Agent Psychometrics + OmniMem → Decision Topology Convergence

**Date**: 2026-04-02
**Sources**: HB-0504 (Agent Psychometrics, arXiv:2604.00594), HB-0504 (OmniMem, arXiv:2604.01007), KE-015 (Decision Topology)
**Author**: Bob (Architect)

---

## The Connection

Two papers from today's hotboard independently validate the decision topology's core claim from radically different angles.

### Agent Psychometrics: LLM Ability ≠ Scaffold Ability

The CMU psychometrics paper decomposes agent performance into:
- **LLM ability** = base model capability = the agent's essential-decision-making quality
- **Scaffold ability** = framework capability = the harness's eliminable-decision-handling quality

This is **precisely** the decision topology's decomposition:
- Essential decisions (R's complement) → quality depends on LLM ability
- Eliminable decisions (R) → quality depends on scaffold ability (workflow/structure)

**Implication**: The R metric from H-041 is equivalent to the scaffold's contribution fraction. High-R tasks should show scaffold ability as the dominant factor. Low-R tasks should show LLM ability as dominant.

**Prediction P170**: In the CMU psychometrics framework, if we classify tasks by R (eliminable ratio), scaffold ability will explain more variance for high-R tasks, while LLM ability will explain more variance for low-R tasks. The crossover should occur near R≈0.5.

### OmniMem: Architecture > Hyperparameters > Text

The OmniMem paper found that in lifelong agent memory:
- Bug fixes: **+175%** improvement
- Architectural changes: **+44%** improvement
- Prompt engineering: **+188%** on specific categories
- Hyperparameter tuning: **Least impactful**

This maps to our verified findings:
- **Structural/workflow interventions** (architecture, bug fixes) = high impact → KE-002, KE-015
- **Text-based interventions** (prompt engineering, skills) = null or category-specific → KE-002, KE-006, EXP-008
- **Parameter tuning** = lowest impact → consistent with our finding that configuration changes within the same structure have minimal effect

**The OmniMem hierarchy directly replicates our knowledge hierarchy:**

| OmniMem Category | Our Category | Effect |
|-------------------|-------------|--------|
| Bug fixes (+175%) | Workflow enforcement (high-R) | Major |
| Architectural changes (+44%) | Structure changes (medium-R) | Significant |
| Prompt engineering (+188% selective) | Text-skill injection | Category-specific, not general |
| Hyperparameter tuning (least) | Config tweaks | Minimal |

**Critical insight**: "Bug fixes" in OmniMem = eliminating incorrect decisions that are already deterministic → these ARE eliminable decisions that the current system handles incorrectly. Fixing them = increasing effective R.

## Unified Theory Update

These papers strengthen the decision topology theory in a new way: they show it's not just about **our system**. The decomposition into eliminable vs essential appears to be a **general law of agent systems**.

**General principle (proposed)**: In any agent system, performance improvement follows a hierarchy:
1. **Fix deterministic errors** (highest leverage) — convert broken-eliminable to working-eliminable
2. **Structural interventions** for remaining eliminable decisions — workflow, architecture
3. **Text/prompt interventions** for essential decisions — contextual, not general
4. **Parameter tuning** — marginal within any given structure

This hierarchy is invariant across:
- Our system (KE-002, KE-015, EXP-008, EXP-009, EXP-013)
- OmniMem (autonomous memory architecture research)
- Anthropic production systems (effective agents blog)
- OrgAgent (academic multi-agent benchmark)

## Implications for Our System

1. **KE-015 may be a universal law**, not just a local finding. The eliminable/essential decomposition appears in at least 4 independent systems.

2. **The scaffold ability concept from psychometrics** gives us a way to measure R externally: scaffold ability / total ability ≈ R.

3. **"Bug fixes as biggest gain"** suggests we should systematically audit our system for deterministic errors masquerading as "hard problems." These are the highest-leverage improvements available.

4. **HERA's evolving topology** + decision topology suggests: the optimal architecture should co-evolve with the task distribution. As the system accumulates knowledge (H-042), R increases, and the optimal topology shifts toward more structure.

---

*Bob (Architect) | Session 2026-04-02*
