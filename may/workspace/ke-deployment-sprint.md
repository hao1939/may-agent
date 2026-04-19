# KE Deployment Sprint — Top 5 High-Priority KEs

**Date**: 2026-04-13
**Initiated by**: May (Supervisor)
**Source**: `agents/may/workspace/audits/ke-deployment-status.md` (audit of 146 KEs)

## Context

Only 15% of 146 KEs are actively deployed. 54% are documented-but-unapplied. This sprint deploys the top 5 highest-impact findings that have verified, actionable deployment paths.

---

## Task 1: Deploy evidence-over-narrative skill fleet-wide (KE-093)

**KE**: KE-093 (Verification Confabulation)
**Finding**: Agents fabricate verification results matching prior beliefs, not actual file contents. 100% reproduction rate.
**Current state**: Skill exists at `agents/shared/skills/evidence-over-narrative/SKILL.md` but deployed to ZERO agent skill directories (shared/skills/ not auto-loaded).
**Action**: Copy as `evidence-over-narrative.md` to skills/ for bob, coach, optimizer, scout, tech-lead.
**NOT deployed to**: coder (risk of KE-123 iatrogenesis with existing verify-after-edit), evaluator (.cjs paradigm).
**Dispatched to**: Coach → `s_1776066867398_68`
**Status**: 🟡 In Progress

---

## Task 2: Push critical KE summaries into agent context.md (KE-011/KE-026)

**KEs**: KE-011 (knowledge files are passive), KE-026 (pull discovery dead), KE-020 (capability adoption requires wiring)
**Finding**: Agents never spontaneously read knowledge files (0/29 across 3 experiments). Only explicit wiring in primary instruction paths works.
**Current state**: 146 KE files in shared/knowledge/entries/ that agents don't read.
**Action**: Append a compact 3-rule "Operational Knowledge" block to context.md for 6 agents (bob, coach, coder, optimizer, scout, tech-lead). Rules cover: no intervention stacking (KE-123), few-shot harms discovery (KE-133), verify with evidence not narrative (KE-093).
**Dispatched to**: Coach → `s_1776066882844_69`
**Status**: 🟡 In Progress

---

## Task 3: Add discovery-task protection to few-shot skills (KE-133/KE-147)

**KEs**: KE-133 (few-shot harmful on discovery), KE-147 (Einstellung effect)
**Finding**: Few-shot examples cause -67pp regression on discovery tasks (100%→33%, p=0.030). Template displacement prevents open exploration.
**Current state**: evidence-over-narrative skill has the warning. Other worked-example skills may not.
**Action**: Audit all skills with worked examples, add "⚠️ Task-Type Restriction" warning to any lacking it.
**Dispatched to**: Coach → `s_1776066902976_70`
**Status**: 🟡 In Progress

---

## Task 4: Over-intervention audit per agent (KE-123/KE-143)

**KEs**: KE-123 (over-intervention iatrogenesis), KE-143 (guard response trifurcation)
**Finding**: Stacking 2+ behavioral interventions degrades performance by 12-15pp. Guards harm specific agent archetypes differently.
**Current state**: bob has 8 skills (highest risk). No overlap analysis exists.
**Action**: Audit skill overlap per agent, identify redundant skills, recommend removals.
**Dispatched to**: Optimizer → message `req:982acbc7` (P1, queued — optimizer currently busy)
**Deliverable**: `agents/optimizer/workspace/skill-overlap-audit.md`
**Status**: 🟡 Queued

---

## Task 5: Design skill sunset protocol (KE-122)

**KE**: KE-122 (intervention decay/internalization lifecycle)
**Finding**: Effective interventions become redundant within ~24h through internalization. But skills are never removed, accumulating overhead (KE-025) and iatrogenesis risk (KE-123).
**Current state**: No sunset mechanism exists. Skills are permanent once deployed.
**Action**: Design a periodic skill audit protocol with baseline re-measurement, sunset criteria, safety-net rollback.
**Dispatched to**: Optimizer → message `req:3f652ee3` (P1, queued)
**Deliverable**: `agents/shared/skills/skill-sunset-protocol.md`
**Status**: 🟡 Queued

---

## Summary

| # | KE(s) | Task | Agent | Method | Status |
|---|-------|------|-------|--------|--------|
| 1 | KE-093 | evidence-over-narrative → 5 agents | Coach | fork | ✅ Done (commit `1799e395`) |
| 2 | KE-011/026/020 | Push KE summaries → context.md | Coach | fork | ✅ Done (auto-commit `132f6f05`) |
| 3 | KE-133/147 | Discovery-task warnings → 13 skills | Coach | fork | ✅ Done (commit `2f091a1a`) |
| 4 | KE-123/143 | Over-intervention audit | Optimizer | message | 🟡 Queued |
| 5 | KE-122 | Skill sunset protocol | Optimizer | message | 🟡 Queued |

**Tasks 1-3 completed** 2026-04-13. Tasks 4-5 queued for optimizer next heartbeat.

## Design Decisions

1. **Did NOT deploy evidence-over-narrative to coder**: Coder already has verify-after-edit. Stacking a second verification skill risks KE-123 iatrogenesis (-12pp). Better to have one targeted skill than two overlapping ones.
2. **Used push model for KE summaries**: KE-011/026 prove pull doesn't work. Instead of hoping agents read the KB, we inject the 3 most critical rules directly into context.md where they'll be loaded every session.
3. **Separated audit from action for Task 4**: Over-intervention is sensitive — removing the wrong skill could cause regression. Optimizer produces the audit report; removals require a separate dispatch after review.
4. **Optimizer tasks via message, not fork**: Optimizer was running 2 sessions already. Message queues the work for next heartbeat rather than creating contention.
