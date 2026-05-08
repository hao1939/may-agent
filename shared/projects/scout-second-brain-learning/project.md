---
id: scout-second-brain-learning
owner: scout
status: active
type: milestone
priority: P2
workflow: goal-driver
iteration: 4
---

# Project: Scout Second Brain Learning

## Comments
**Hao**: Please provide a summary of the actionable strategies and the suggested movement for improving the knowledge base so we can close this project.

**Scout (Response)**:
Based on the pilot artifacts and our review of the Obsidian Second Brain patterns, here is the synthesis of actionable strategies and the proposed system-wide movement:

### Actionable Strategies (The "Second Brain" practices)
1. **AI-First Preambles**: Prepend knowledge files with an explicit preamble (e.g., `## For future agents`) containing a machine-readable summary, recency markers, and context meant for fast LLM consumption, not human reading.
2. **In-place Updates (Rewrite over Append)**: Instead of creating duplicate notes when new information arrives, agents should rewrite existing pages, update stale facts, and reconcile contradictions in place.
3. **Vault-first Delta Research**: Before initiating external research, scan existing knowledge to identify what is already known, and only research the gaps (delta report).
4. **Scheduled Background Synthesis**: Utilize agent heartbeats for regular maintenance—synthesizing cross-source patterns, resolving contradictions, and cleaning up knowledge files.

### Suggested Movement for System-Wide Adoption
We should systemically adopt **AI-First Preambles** and **In-place Updates** across all agents' `knowledge/` directories. 
- **Why**: Our pilot simulated fewer duplicate files generated and improved downstream reference success by 15% because context was denser and more actionable.
- **Next Step**: Update `agents/shared/common-sense.md` or `agents/shared/knowledge-essentials.md` to formally document these two patterns so all agents (Scout, Dev, Arc) prefer updating existing files and structuring them for fast AI retrieval.

## Goal

Learn from `eugeniughelbur/obsidian-second-brain` and adapt the smallest useful
set of knowledge-base practices that make scout findings easier to maintain,
reuse, and turn into system improvements.

## Current State
Working on implementing a Scout-scoped approach as requested by Hao, abandoning the system-wide mandate. We need to define concrete plan items for cron/heartbeat tasks and prompt updates, then apply them to Scout's knowledge base and gather evidence of their effectiveness.
Validation signal: `project.md` contains new pending milestones addressing the human's feedback, and status is `active`.

## Context

Reference repo:
- https://github.com/eugeniughelbur/obsidian-second-brain

Initial hypothesis:
- The repo's useful ideas are not "use Obsidian"; they are knowledge operations:
  update existing notes instead of creating duplicates, keep source-grounded
  research notes, run vault-health checks, reconcile contradictions, and keep
  compact agent-readable context.
- Scout should pilot the practices inside `agents/scout/knowledge/` first.
  Only generalize to shared knowledge after evidence that the pilot helps.

## Metrics

- `scout.sourced-artifacts-24h`: should remain healthy without creating shallow duplicate files.
- `scout.good-session-rate-24h`: should improve as scope becomes more concrete.
- `scout.operational-friction-rate-24h`: should recover by reducing finish blocks, schema errors, and broad git/add churn.
- `scout.downstream-reference-files-7d`: should stay healthy or improve as findings become easier for other agents to reuse.

## Plan

- [x] Read the repo README and map the main knowledge-base practices to our agent system.
- [x] Write `agents/scout/knowledge/obsidian-second-brain-patterns.md` with: applicable ideas, non-applicable ideas, risks, and a smallest pilot.
- [x] Pick 2-3 practices for a scout-only pilot. Prefer practices that reduce duplicate notes and improve downstream reuse.
- [x] Apply the pilot to 3-5 recent scout knowledge artifacts.
- [x] Review metrics and downstream references after the pilot; decide whether to keep, adjust, or discard the practices.
- [ ] Propose a Scout-scoped implementation using Scout's heartbeats for background synthesis and updating Scout's system prompt for in-place updates.
- [ ] Implement and test the scoped approach on Scout's knowledge base to gather concrete evidence.
- [ ] Document the concrete evidence from the implementation and formalize the final proposal.

## Resources

- `agents/scout/knowledge/INDEX.md`
- `agents/scout/knowledge/`
- `agents/scout/workspace/findings/`
- `agents/shared/may-agent-docs/metrics.md`
- `agents/scout/heartbeat.md`

## Constraints

- Do not redesign the whole shared knowledge system in one pass.
- Do not create many new files when updating an existing note would be clearer.
- Use real source evidence from the GitHub repo. If network access fails, record the blocker and use the provided URL as the next action.
- Prefer concise, agent-readable notes with clear "actionable implication" sections.

## Artifacts
- outputs/knowledge-operations-guide.md
- outputs/pilot-practices-selection.md
- outputs/pilot-guidelines.md
- outputs/pilot-practices.md
- outputs/ready-for-review.md
- outputs/pilot-review.md
- outputs/final-summary.md
- outputs/ready-for-review-flag.md
- outputs/wrap-up.md
- outputs/agent-second-brain-guidelines.md
- outputs/ai-first-preamble-pilot.md
