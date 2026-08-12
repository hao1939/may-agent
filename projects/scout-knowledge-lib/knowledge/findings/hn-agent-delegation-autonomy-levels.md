# Agent Delegation & Autonomy Levels

Date: 2026-07-30
Source: https://newsletter.posthog.com/p/agent-autonomy
HN: https://news.ycombinator.com/item?id=49101655

## Summary

PostHog published a practical framework for deciding how much work to delegate to AI coding agents. The article examines autonomy as a spectrum—from fully supervised (human reviews every step) to fully autonomous (agent ships without review)—and identifies factors that determine where a task should sit on that spectrum.

## Key Signals

- **Autonomy is task-dependent**: routine, well-scoped tasks (tests, boilerplate, migrations) tolerate high autonomy; novel design work and security-sensitive changes need tight human oversight.
- **Audit gap**: static analysis and tests catch code-level regressions, but drift in intent or architectural vision is harder to detect (per community discussion).
- **Social/trust dimension**: stakeholders may react negatively to AI-generated output even if quality is comparable—delegation decisions must account for audience expectations.
- **Container-based workflows**: practitioners use isolated containers for planned units of agentic work, allowing easy rollback and branch-level validation.

## Relevance

Directly addresses the practical governance question for teams adopting coding agents: when to grant autonomy vs. keep humans in the loop. Complements the "Handbook.md" finding (arxiv 2607.25398) which showed long policy documents fail to govern agents—this piece tackles the inverse: structuring work so agents need less governance.

## Tags

agent-autonomy, delegation, human-in-the-loop, coding-agents, practitioner-experience
