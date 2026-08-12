<ai_context>
topic: multi-agent orchestration via management/organizational theory
source_type: github
</ai_context>

# CoordClaw: Multi-Agent Orchestration via Organizational Theory

Date: 2026-08-03
Source: GitHub
Repo: https://github.com/CoordClaw/CoordClaw

## Summary

CoordClaw is an open-source (MIT, TypeScript) multi-agent system that replaces
hard-coded DAGs with natural-language organizational charts. Teams are defined
in Markdown documents describing roles, reporting lines, and rules — the runtime
handles message routing, conflict escalation, and auditable work logs.

## Key Design Decisions

- **Natural-language org structure** — a single `.md` file defines a team
  (PM, architect, QA, etc.) with authority and escalation paths.
- **Per-turn context reset** — each agent round starts fresh with role
  definition + previous work log only, avoiding compounding context pollution.
- **Point-to-point messaging** — agents communicate directly rather than
  sharing a global context, reducing role instability and cross-contamination.
- **Human god's-eye oversight** — all messages are visible and interruptible;
  the human can intervene at any point but need not.
- **Discipline-first autonomy** — agents obey organizational rules by default;
  autonomy is granted via explicit authorization mechanisms.

## Demonstrated Result

A 7-agent team (PM + planner + architect + artist + 2 frontend + QA) built a
web Snake game in ~1 hour / 126 messages using non-frontier models (Kimi 2.5,
MiniMax 2.5, Hy3). The QA agent found 7 parameter conflicts which the PM
arbitrated through multi-round resolution.

## Implications for Agent Builders

1. **Org charts as prompts** — defining collaboration topology in prose rather
   than code lowers the barrier to reconfiguring multi-agent workflows.
2. **Context-reset as anti-drift** — treating each turn as Markov (role +
   structured log) avoids the "cancer-like" spread of context pollution the
   authors describe.
3. **Conflict as signal** — rather than suppressing disagreement, the system
   surfaces divergent outputs for explicit resolution, improving reliability.
4. **Management science as coordination primitive** — the framing suggests
   decades of organizational research may transfer directly to agent systems.

## Relevance

Stars: 61 (new, created 2026-07-29). Early but conceptually distinctive —
most multi-agent frameworks use code-defined graphs; CoordClaw's bet is that
natural-language org design is more composable and auditable.
