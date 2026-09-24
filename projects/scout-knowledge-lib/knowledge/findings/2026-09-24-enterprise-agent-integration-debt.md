---
summary: "A practitioner who says they moved into enterprise agent work six months earlier reports spending roughly three times as long integrating one legacy MES query interface as writing the agent orchestration. The useful signal is qualitative: production agent work can be dominated by data and system integration debt, while the post's market-size and hiring figures remain unsourced."
triggers: ["enterprise agents", "legacy integration", "MES", "WebService", "agent engineering", "integration debt", "data readiness"]
last_updated: "2026-09-24"
source_basis: "Body-level XHS post 6a55a3ba0000000011018ee3 by 口可口可; a first-person practitioner account with no employer, project artifact, implementation record, or citations for its market statistics."
---

# Enterprise agent work can be mostly integration work

<ai_context>
Use this as a qualitative practitioner signal that enterprise agent delivery may be bottlenecked by legacy interfaces and inaccessible data rather than orchestration code. Do not use the post's market forecasts, hiring ratios, or three-times estimate as representative statistics: none is independently documented in the inspected source.
</ai_context>

**Observed:** 2026-09-24  
**Disposition:** New source-grounded finding  
**Coverage:** Full XHS text post and its three visible comments. Attached images and any projects behind the author's account were not inspected.

## Source

- **XHS body:** [转agent半年，聊一下“现在入局晚不晚”](https://www.xiaohongshu.com/explore/6a55a3ba0000000011018ee3) — 口可口可, note ID `6a55a3ba0000000011018ee3`

## What the source says

The author says they had moved into agent work six months earlier. Their concrete delivery example is not a model or prompt problem: they report fighting a WebService interface dating from 2008 and spending roughly three times as long integrating one MES query interface as writing the agent-orchestration logic. They also say customers expect AI to solve broad problems even when the relevant data has not been connected.

The post surrounds that account with claims about China's enterprise-agent market, hiring demand, patent growth, and Gartner forecasts. It supplies no links, report titles, definitions, currencies, sampling methods, or dates sufficient to verify those numbers. They are therefore not evidence used by this finding.

## Why it matters

The narrow practitioner report reinforces an important planning distinction: **agent logic and deployment readiness are different workstreams**. A convincing orchestration demo does not establish that production systems expose reliable data, stable identifiers, authorized operations, or reconcilable outcomes.

For enterprise-agent planning, estimate and track at least these layers separately:

1. model and orchestration behavior;
2. source-system discovery and interface adaptation;
3. data identity, freshness, and access authority;
4. write-side idempotency, failure recovery, and reconciliation; and
5. user expectation and exception handling.

Otherwise, estimates based on prompt graphs and model calls can hide the work that actually determines deployment time. The report also suggests a practical discovery metric: before promising autonomy, inventory the target systems and measure the fraction of required reads and writes that already have documented, testable interfaces.

## Evidence boundary

- This is one self-reported experience, not a survey of enterprise agent projects.
- The author does not identify the employer, customer, MES vendor, interface, task, or measured hours.
- “Three times” is an anecdotal comparison and may not generalize.
- The post does not show that the resulting agent was deployed successfully or that integration was the only bottleneck.
- Its market and labor statistics are unsourced in the body and should not be repeated as verified facts.
