# DD#639 — ABTest: Behavior-Driven Fuzzing Framework for AI Coding Agents

**Source**: arXiv:2604.03362 (cs.SE, April 7 2026)
**Authors**: Dai, Openja, Pham, Uddin, Yang, Wang
**Rating**: ★★★★★ CRITICAL

## Core Idea

ABTest is a behavior-driven fuzzing framework that systematically tests AI coding agents by mining real-world failure reports, converting them into repository-grounded behavioral tests, and executing them against agents to detect anomalies. It bridges the gap between anecdotal bug reports and systematic agent testing.

## Key Findings

1. **Pipeline**: (1) Mine user-reported anomalies → (2) Extract reusable workflow patterns (47 "Interaction Patterns") and behaviors (128 "Action Types") → (3) Compose stepwise fuzzing templates → (4) Instantiate as executable test cases in real repos → (5) Execute with agents, record traces → (6) Detect and validate anomalous behaviors
2. **Scale**: From 400 user-reported developer-confirmed failures → 647 repository-grounded fuzzing cases
3. **Results**: 1,573 behavioral anomalies flagged across Claude Code, Codex CLI, and Gemini CLI; 642 confirmed as new true anomalies (40.8% precision)
4. **Previously unreported failure modes discovered** — not just reproducing known bugs

## Why This Matters (GStack Relevance)

This is the **first systematic fuzzing framework for agent behavior** — not just testing outputs but testing behavioral patterns across multi-step workflows. It directly addresses:
- **DD#635 (Agent Brittleness)**: ABTest operationalizes the brittleness taxonomy into executable tests
- **DD#634 (Claude Code Regression)**: The 400 user reports likely include the very patterns that caused the Claude regression
- **CR#301 (Harness Engineering)**: This IS the harness — systematic agent testing infrastructure we've been theorizing about
- **CR#309 (Agent Capability Boundary)**: ABTest maps five of our failure surfaces to executable test patterns

## Critical Connection: "Interaction Patterns" as Agent Test Language

The 47 Interaction Patterns + 128 Action Types form a vocabulary for describing agent behavior. This is the missing piece between our Laws of Software Agent Behavior and testable specifications. If these patterns generalize, they become the BDD (behavior-driven development) language for agent development.

## Architecture Insight

The generate-test-repair loop mirrors DD#628 (Self-Execution Simulation) but at the meta-level: the *test framework itself* follows the same loop pattern that agents use internally.

## Open Questions
- Can Interaction Patterns be used proactively (before failure) or only reactively (mining past failures)?
- How do the 47 patterns map to our 78 Laws?
- Transfer across agent families — do patterns found in Claude Code generalize to Codex?

## Tags
`agent-testing` `fuzzing` `behavioral-testing` `harness-engineering` `coding-agents` `failure-modes`
