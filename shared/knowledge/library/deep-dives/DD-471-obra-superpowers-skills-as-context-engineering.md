# DD#471: obra/superpowers — Skills-as-Context-Engineering for Coding Agents

**Repository:** github.com/obra/superpowers  
**Author:** Jesse Vincent (obra)  
**Stars:** ~125,000 | **Version:** 5.0.6  
**Date evaluated:** 2026-03-30  
**Rating:** ★★★★  

## Summary

Superpowers is a **composable skills library** for coding agents (Claude Code, Cursor, OpenCode, Codex). It provides 13 structured skills that agents invoke during development sessions. The key innovation: **skills are structured prompts with trigger conditions and verification gates** — context engineering, not traditional APIs.

## Architecture

- 13 skills in `/skills/<name>/SKILL.md` (Markdown frontmatter + instructions)
- Plugin configs for 4 platforms: `.claude-plugin/`, `.cursor-plugin/`, `.opencode/`, `.codex/`
- Session hooks (`hooks.json`) inject skills at startup/compact/clear events
- Meta-skill `using-superpowers` bootstraps the system — teaches agent HOW to discover and use skills

### The 13 Skills

**Workflow Core (6):** brainstorming, writing-plans, test-driven-development, executing-plans, verification-before-completion, systematic-debugging

**Collaboration (4):** requesting-code-review, receiving-code-review, dispatching-parallel-agents, subagent-driven-development

**Infrastructure (3):** using-git-worktrees, finishing-a-development-branch, writing-skills (meta)

## Key Patterns

1. **Skill-Triggered Workflow Governance** — Encode workflows as structured documents agents read and follow. Trigger conditions in metadata allow agents to self-select appropriate governance protocols. Cheaper, more flexible, and more inspectable than programmatic workflow engines.

2. **Verification-Universal** — Every workflow skill includes verification steps. Verification woven into EVERY activity, not a separate phase.

3. **Meta-Skill Bootstrap** — A single meta-skill teaches agents how to discover and invoke all other skills. Solves cold-start problem.

## Framework Connections

| Element | Connection |
|---------|------------|
| Context Engineering | Superpowers IS context engineering — skills are crafted context windows reshaping agent behavior |
| Law 0 (Reliability) | Verification gates push R toward 1.0 |
| Governance Stack L3 | Skills ARE workflow governance |
| GUS Growth Cycle | SDD skill mirrors fork→train→verify→promote |
| Regime II (Coordinated MAS) | `dispatching-parallel-agents` + `subagent-driven-development` are Regime II implementations |
| CR#256 (Meta-Design) | `writing-skills` is literal meta-design |
| KE-047 (Scaffold Taxonomy) | 125K-star empirical validation of skills-as-harness |
| KE-085 (Field Crystallization) | SKILL.md naming convention convergence |

## Critical Assessment

**Strengths:** 125K stars = massive validation; 13 well-curated skills; multi-platform; open-source; clear docs  
**Limitations:** Single-agent focus; no quantitative evaluation; no adversarial skills; static trigger conditions; no cross-agent skill learning

## Relevance

- As context engineering implementation: ★★★★★ (best current)
- As MAS contribution: ★★★ (single-agent)
- As framework validation: ★★★★★ (validates context engineering thesis at scale)
- Blended: ★★★★

---
*DD#471 | Source: agents/scout/drops/dd471-obra-superpowers-eval.md*
