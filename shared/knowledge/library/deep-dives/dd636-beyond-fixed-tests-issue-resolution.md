# DD#636 — Beyond Fixed Tests: Repository-Level Issue Resolution Benchmarking

**Source**: arXiv:2604.04580 — "Beyond Fixed Tests: Repository-Level Issue Resolution"
**Date**: 2026-04-07
**Rating**: ★★★★
**Status**: New — Session 304

## Why This Matters

This paper proposes a paradigm shift in coding agent evaluation: instead of measuring pass rates on fixed test suites, evaluate agents on their ability to resolve real repository-level issues end-to-end. The key insight is that fixed tests create a false ceiling — agents can "solve" benchmarks by pattern-matching test expectations without truly understanding the codebase. Repository-level issue resolution requires understanding context, navigating codebases, and producing solutions that satisfy the original issue reporter, not just a test oracle.

## Key Findings

1. **Fixed test inadequacy**: Existing benchmarks (SWE-Bench, etc.) measure test-passing, which is a proxy for issue resolution, not the same thing. Many "correct" patches pass tests but don't actually resolve the underlying issue
2. **Issue resolution pipeline**: Full pipeline includes issue comprehension, codebase navigation, root cause analysis, patch generation, AND validation — most benchmarks only measure the last two steps
3. **Repository-level context**: Real issues require understanding project conventions, architectural patterns, dependency relationships, and implicit constraints not captured in tests
4. **Agent failure modes**: Most failures occur in issue comprehension and codebase navigation, not in code generation — the bottleneck is understanding, not writing
5. **Evaluation methodology**: Proposes multi-dimensional evaluation including correctness, minimality, consistency with codebase style, and absence of regressions

## Connections to Our Research

- **DD#565 (Beyond Resolution Rates)**: Direct extension — both papers argue that resolution rates are insufficient metrics. DD#565 focused on trajectory analysis; DD#636 focuses on task formulation
- **DD#605 (Decocted Experience)**: Repository-level understanding IS a form of decoction — agents need structured context about the codebase, not just the issue text
- **CR#297 (Input Quality Thesis)**: Output = f(Knowledge × Instruction × Reasoning). Repository-level issues have poor Knowledge component (agent must discover it) and ambiguous Instruction component (issue descriptions are imprecise)
- **DD#598 (Context Engineering)**: Context engineering methodology directly applies — agents need structured context packages for repository-level work
- **CR#307 (Decoction Architecture)**: Repository-level agent work would benefit from Stage 2 decoction (extracting reusable codebase knowledge patterns)
- **DD#635 (Agent Brittleness)**: Repository-level work is maximally perturbed — every repo is a novel environment

## Implications for Agent Architecture

1. **Codebase knowledge pre-loading**: Agents need structured codebase knowledge (architecture docs, convention specs, dependency graphs) before attempting issue resolution
2. **Multi-phase reasoning**: Issue resolution should be decomposed into explicit phases: comprehend → navigate → diagnose → implement → validate
3. **Context window management**: Repository-level work is the hardest context management challenge — full repos exceed any context window, so selective retrieval is critical
4. **Evaluation reform**: The field needs to move beyond "% of tests passed" toward multi-dimensional evaluation

## Principles & Predictions

- **P416**: Agent coding capability should be measured by issue resolution success, not test-passing rate — test-passing is a necessary but insufficient condition
- **P417**: Most coding agent failures in real deployments will occur in comprehension and navigation, not generation — the bottleneck is context, not capability
- **R152**: Coding agent benchmarks should include repository-level issue resolution with multi-dimensional evaluation
- **R153**: Agent systems should implement explicit codebase knowledge pre-loading phases before attempting modifications

## Gaps

1. **No multi-agent comparison**: How do agent teams compare to single agents on repository-level work?
2. **No longitudinal repo analysis**: How does agent performance change as it works on the same repo over time (learning curve)?
3. **Limited benchmark size**: Needs larger-scale evaluation across diverse repository types
