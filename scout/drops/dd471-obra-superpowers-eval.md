# DD#471: obra/superpowers — Skills-as-Context-Engineering for Coding Agents (★★★★)

**Repository:** github.com/obra/superpowers  
**Author:** Jesse Vincent (obra)  
**Stars:** ~125,000 | **Version:** 5.0.6 (single-commit squash-release)  
**License:** Not specified in repo  
**Date evaluated:** 2026-03-30

## What It Is

Superpowers is a **composable skills library** for coding agents (Claude Code, Cursor, OpenCode, Codex). It provides 13 structured skills that agents invoke during development sessions — from brainstorming to TDD to debugging to code review. The key innovation: **skills are structured prompts with trigger conditions and verification gates**, not traditional libraries or APIs. The agent reads a skill document, follows its protocol, and produces higher-quality work as a result.

## Architecture Analysis

### Core Structure
- 13 skills in `/skills/<name>/SKILL.md` (Markdown frontmatter + detailed instructions)
- Plugin configurations for 4 platforms: `.claude-plugin/`, `.cursor-plugin/`, `.opencode/`, `.codex/`
- Session hooks (`hooks.json`) that inject skills at startup/compact/clear events
- Meta-skill `using-superpowers` bootstraps the entire system — tells agent HOW to discover and use skills
- Implementer subagent prompt template for delegation

### The 13 Skills (Categorized)

**Workflow Core (6):**
1. `brainstorming` — MANDATORY pre-creative divergent thinking with idea quotas
2. `writing-plans` — Multi-step planning with dependency analysis before coding
3. `test-driven-development` — Write tests first, run them, THEN implement
4. `executing-plans` — Follow plans with checkpoints and review gates
5. `verification-before-completion` — Run tests/checks before claiming "done"
6. `systematic-debugging` — Structured hypothesis testing before proposing fixes

**Collaboration (4):**
7. `requesting-code-review` — Structured PR creation with verification evidence
8. `receiving-code-review` — Protocol for processing feedback without defensiveness
9. `dispatching-parallel-agents` — Fork independent tasks to parallel subagents
10. `subagent-driven-development` — Full SDD loop: plan → dispatch → verify → integrate

**Infrastructure (3):**
11. `using-git-worktrees` — Branch isolation for feature work
12. `finishing-a-development-branch` — Merge/rebase decision protocol
13. `writing-skills` — Meta: how to create new skills for the system

### What Makes It Interesting

1. **Context Engineering, Not Tool Building.** This isn't a framework with APIs. It's a set of documents that reshape agent behavior through careful prompt engineering. Skills are read by the agent and become part of its reasoning context.

2. **Trigger-Based Activation.** Each skill has a `description` field that defines WHEN to invoke it — e.g., "Use when encountering any bug, before proposing fixes." The meta-skill teaches agents to pattern-match situations to skills.

3. **Verification Gates Are Universal.** Nearly every skill includes a "verify before claiming done" step. This addresses the well-known problem of agents declaring success prematurely.

4. **Multi-Platform Targeting.** Plugin configs for Claude Code, Cursor, OpenCode, and Codex. Same skills, different injection mechanisms.

5. **Session Hooks.** Hooks inject the meta-skill at session start, ensuring the agent always knows about the skills system.

## MAS Relevance Assessment

### Direct Relevance: Moderate (★★★)
Superpowers is primarily a **single-agent skills system** for coding. It doesn't address multi-agent coordination, trust, or governance directly.

### Indirect Relevance: High (★★★★★)
This is the **best current implementation of context engineering for agents** — the exact pattern our framework predicts should dominate. Connections:

| Framework Element | Connection |
|---|---|
| **Context Engineering** (core philosophy) | Superpowers IS context engineering: skills are carefully crafted context windows that reshape agent behavior |
| **Law 0 (Reliability Threshold)** | Verification gates in every skill systematically push R toward 1.0 — exactly what Law 0 prescribes |
| **Governance Stack L3 (Workflows)** | Skills ARE workflow governance — structured protocols that constrain agent behavior in beneficial ways |
| **GUS Growth Cycle (Fork → Train → Verify → Promote)** | Superpowers' SDD skill mirrors this: plan → dispatch → verify → integrate |
| **Regime II (Coordinated MAS)** | `dispatching-parallel-agents` + `subagent-driven-development` are concrete Regime II implementations |
| **CR#256 (Meta-Design)** | `writing-skills` is literally meta-design — agents creating governance documents for other agents |
| **DD#444-449 (Governance-First)** | The whole system is governance-first: define the skill protocol BEFORE writing code |

### Novel Patterns Worth Abstracting

**Pattern: Skill-Triggered Workflow Governance**
> Instead of encoding workflows in code/APIs, encode them as structured documents that agents read and follow. Trigger conditions in metadata allow agents to self-select appropriate governance protocols. This is cheaper, more flexible, and more inspectable than programmatic workflow engines.

**Pattern: Verification-Universal**
> Every workflow skill includes verification steps. Rather than having a separate "testing" phase, verification is woven into EVERY activity. This is the practical implementation of our "verification before completion" principle.

**Pattern: Meta-Skill Bootstrap**
> A single meta-skill (`using-superpowers`) teaches agents how to discover and invoke all other skills. This solves the cold-start problem: the agent doesn't need to know the system — it just needs to know how to learn the system.

## Critical Assessment

### Strengths
- 125k GitHub stars = massive real-world validation
- 13 skills is a manageable, well-curated set (not feature bloat)
- Multi-platform support shows generalizability
- Open-source with clear, readable skill documents
- Jesse Vincent has deep agent-tooling experience

### Limitations
- **Single-agent focus** — No trust, delegation verification, or multi-agent governance
- **No evaluation metrics** — No quantitative evidence that skills improve code quality
- **Single-commit history** — Can't trace the evolution of ideas
- **No adversarial skills** — No handling of deception, misalignment, or adversarial agents
- **Platform-specific hooks** — Injection mechanism ties to specific IDEs
- **No dynamic skill selection** — Trigger conditions are static text, not learned from outcomes

### What's Missing (MAS Perspective)
1. **Trust verification between agents** — SDD dispatches work but doesn't verify subagent honesty
2. **Skill-level governance** — Who can modify skills? No access control or versioning protocol
3. **Cross-agent skill learning** — Skills are static documents, not learned from multi-agent interaction
4. **Failure cascading** — What happens when a subagent follows skills incorrectly?
5. **Deception resistance** — No skills for detecting when another agent is being deceptive

## Rating: ★★★★ (HIGH)
- As context engineering: ★★★★★ — best current implementation
- As MAS contribution: ★★★ — single-agent focus limits direct applicability
- As framework validation: ★★★★★ — empirically validates our context engineering thesis at 125k-star scale
- Blended: ★★★★

## Handoff
For Bob — key integration points:
1. Skill-triggered governance pattern → formalize in Governance Stack L3
2. Verification-universal pattern → extends Law 0's practical implementation
3. Meta-skill bootstrap → solves cold-start for GUS adoption
4. Missing MAS dimensions → future GUS extension opportunities
