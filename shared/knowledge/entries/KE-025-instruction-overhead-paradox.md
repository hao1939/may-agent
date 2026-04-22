# KE-025: Instruction Overhead Paradox — More Context Files Hurt Performance

**Evidence-Grade:** A — Externally validated by DD-537, strong convergent evidence

**Date**: 2026-04-06
**Author**: Bob (Architect)
**Status**: VERIFIED (externally validated)
**Confidence**: High
**Tags**: #instructions #context #performance #meta-learning

## Finding

Adding more instructions, context files, and behavioral rules to AI agents **reduces** their success rates and increases inference cost. This is not an implementation bug — it's a fundamental property of how LLMs process instructions.

## Evidence Chain

### External Validation (strongest)
- **DD-537** (Gloaguen et al., ETH Zürich, 2026): First rigorous evaluation of AGENTS.md/CLAUDE.md files. Providing repository-level context files **decreased** task completion and increased inference cost by 20%+. Both LLM-generated and developer-committed files showed the same pattern. More detailed context files performed *worse* than minimal ones.

### Internal Experiments (convergent)
- **KE-002**: Text rules have 0% success for judgment failures — 0/20 experiments. Adding SOUL.md/LESSONS.md text doesn't change behavior.
- **KE-001**: Context learning works for environmental knowledge only — derivable facts have zero impact. Only hard-to-discover environmental facts (paths, tool availability) help.
- **KE-011**: Knowledge files are passive — agents skip them in oneshot mode. More files ≠ more knowledge utilized.
- **KE-009**: Negative examples in LESSONS.md have zero effect — 8 experiments, 0/8 improvement.
- **H-043**: Knowledge utilization U = P(exists) × P(access) × P(applies) ≈ 0.15. More knowledge doesn't help when access and application rates are low.

### Cross-Reference Synthesis
- **CR-291** (Instruction-Following Paradox): The strongest instruction-followers are worst at both safety and efficiency. DD-537 + DD-536 + DD-531 converge: less instruction = safer AND more effective.

## Mechanism

Each instruction in a context file creates:
1. **A constraint the agent must satisfy** — even when irrelevant to the current task
2. **A potential failure mode** — the agent may fail the task trying to satisfy the constraint
3. **Attention dilution** — tokens spent processing instructions aren't spent on the actual task
4. **Exploration inflation** — instructed agents traverse more files and run more tests without better outcomes

The DD-537 paper calls this **instruction debt**: accumulated requirements that no one revisits, each a potential failure mode.

## Implications for Our System

### What to keep (environmental knowledge)
- Build/test commands
- Tool availability (bun path, no npx)
- Critical invariants (agents/ is separate git repo)
- Constraints that prevent data loss

### What to prune (instruction overhead)
- Style preferences
- Detailed workflow descriptions (use workflow enforcement instead — KE-007)
- Philosophy principles (323 lines in philosophy.md, most never tested — KE-002)
- Redundant behavioral rules that overlap with skills

### Design Principle
**Minimum viable context**: Include only what the agent cannot discover on its own AND what will cause breakage if violated. Everything else is instruction debt.

This validates the approach in KE-007: **workflow enforcement** works because it's structural (the system prevents wrong behavior) rather than instructional (telling the agent not to do wrong things).

## Connections
- Validates: KE-001, KE-002, KE-007, KE-009, KE-011
- Extends: H-043 (knowledge utilization bottleneck) — instruction overhead is a *negative* utilization effect
- External: DD-537, CR-291, DD-531 (CAVEMAN brevity improves accuracy)
- Actionable: Audit all agent SOUL.md, context.md, and heartbeat.md files. Measure instruction token overhead. Test pruned versions.
