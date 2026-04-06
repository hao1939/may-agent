# DD#537 — Evaluating AGENTS.md: Repository Context Files Hurt More Than Help

**Paper:** Gloaguen et al. (2026). "Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?" arXiv:2602.11988. ETH Zürich.
**Tool:** [MDArena](https://github.com/HudsonGri/mdarena) — open-source benchmarking framework for .md instruction files
**Rating:** ★★★★☆ High Impact for Agent Engineering
**Date reviewed:** 2026-04-06

## One-Line Summary
First rigorous evaluation of AGENTS.md/CLAUDE.md files finds they reduce coding agent success rates and increase inference cost by 20%+, because unnecessary requirements make tasks harder.

## Context
Every major AI coding assistant provider (Anthropic, Cursor, Windsurf, etc.) encourages users to create repository-level context files (AGENTS.md, CLAUDE.md, .cursorrules, etc.) that describe coding conventions, architecture, and constraints. This practice is widespread but had never been rigorously evaluated.

## Key Findings

### 1. Context Files Reduce Success Rates
Across multiple coding agents and LLMs, providing AGENTS.md files **decreased** task completion rates compared to providing NO repository context. This is counterintuitive — more context should help, but doesn't.

### 2. Inference Cost Increases 20%+
Context files add tokens to every prompt and encourage broader exploration. Agents with context files traverse more files, run more tests, and explore more of the repository — but this exploration doesn't translate to better outcomes.

### 3. Behavioral Changes (Positive but Insufficient)
Both LLM-generated and developer-committed context files encourage:
- More thorough testing
- Broader file traversal
- Better adherence to coding conventions

Agents DO respect the instructions — the problem is that the instructions themselves often hurt.

### 4. Why Context Files Fail
The root cause: **unnecessary requirements make tasks harder**. Context files that specify testing frameworks, linting rules, commit message formats, architecture patterns, etc. add constraints that the agent must satisfy even when they're irrelevant to the specific task. This creates additional failure modes.

### 5. The Paradox of Specificity
More detailed context files performed WORSE than minimal ones. The recommendation is: **describe only minimal requirements** — the absolute minimum an agent needs to know to avoid breaking things.

## Evaluation Methodology

### Setting 1: SWE-bench with LLM-generated Context
- Used popular repositories from SWE-bench
- Generated AGENTS.md files using LLMs following agent-developer recommendations
- Compared agent performance with vs. without context files

### Setting 2: Developer-Committed Context Files
- Novel collection of real-world issues from repositories that already have developer-committed context files
- Evaluated whether having the developer's own context helps vs. hurts

### MDArena (HudsonGri/mdarena)
Separate but related tool that benchmarks CLAUDE.md files specifically against real PR evaluations. Provides an automated way to evaluate whether your instruction files actually help.

## Implications for Our Architecture

### 1. Our Agent Instructions Need Pruning
We use extensive instruction files (heartbeat.md, AGENTS.md equivalents). This paper suggests we should:
- **Minimize**: Only include constraints that, if violated, would break things
- **Remove nice-to-haves**: Coding style preferences, optional patterns — remove them
- **Measure**: Actually test whether each instruction improves or hurts outcomes

### 2. Dynamic Context Over Static Files
Instead of one large static file, agents should receive **task-relevant subsets** of context. A file about Git conventions is irrelevant when the agent is fixing a type error.

### 3. The Testing Trap
Context files that say "always run tests" cause agents to spend tokens running full test suites even for trivial changes. The 20% cost increase is largely from this. Better: "run tests only for files you modified."

### 4. Instruction Debt
Just like technical debt, there's **instruction debt** — accumulated requirements in context files that no one revisits. Each requirement is a potential failure mode for agents. Regular pruning sessions needed.

### 5. Evaluation-Driven Context
Use MDArena-style tools to actually measure whether your context files help. Don't assume — test.

## The Minimal AGENTS.md Template (Derived from Paper)
Based on findings, an effective context file should contain ONLY:
1. **Build/test commands** (exact commands to build and test)
2. **Critical constraints** (things that WILL break if violated — e.g., "never import X directly")
3. **Architecture invariants** (mandatory patterns that prevent data loss/corruption)

Remove: style guides, optional preferences, detailed explanations, workflow descriptions.

## Connections
- **DD#536 (Evidence Deletion)**: Both papers show instruction-following can be harmful — agents follow rules too literally
- **DD#531 (CAVEMAN)**: The tension between minimal context and comprehensive context is central to agent engineering
- **CR#290 (MAS Scaling Paradox)**: Token waste from unnecessary context compounds in multi-agent systems where each agent carries the full context

## Rating Justification: ★★★★☆
First rigorous evaluation of a ubiquitous practice. Counterintuitive finding with clear practical implications. Directly actionable for our team. Not 5-star because the evaluation is limited to coding tasks and the signal-to-noise problem (which instructions help vs. hurt) isn't fully resolved.

## Tags
`agent-engineering` `context-files` `AGENTS.md` `CLAUDE.md` `benchmarking` `instruction-quality` `SWE-bench` `cost-optimization`
