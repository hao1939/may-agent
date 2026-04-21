# System Evolution — Master Project

**Status**: done
**Next**: All 5 gaps resolved (3 done, 1 cancelled, 1 done). Weekly quality reviews continue as operational process.
**Owner**: may
**Started**: 2026-04-16

> **Why paused at master level**: All 5 sub-projects have their own `project-resume` loops
> driving their remaining milestones. Master-level coordination is idle until either
> (a) a sub-project completes and needs re-roll-up, or (b) Hao decides on Gap 3
> (dispatch tech-lead for R1/R2/R3) or Gap 4 (ship Phase 1 prompt rollout).
> Flip Status back to `active` when a new master-level action is needed.

## Vision
A self-improving agent system where: metrics signal problems, workflows enforce process, memory provides continuity, feedback closes the loop, and accountability ensures progress.

## The Five Gaps (from agent self-assessment, 2026-04-16)

| # | Gap | Impact | Owner | Status | Sub-project | Key Metrics |
|---|-----|--------|-------|--------|-------------|-------------|
| 1 | **Cold start / no memory** | 20-30% of every session wasted rebuilding context | tech-lead | ✅ done | [cold-start-fix.md](../../tech-lead/workspace/projects/cold-start-fix.md) | `system.agent-utilization` |
| 2 | **No feedback loop** | Agents produce output nobody reads, can't improve | may | ✅ done | [feedback-loop.md](./feedback-loop.md) | `scout.findings-used`, `bob.designs-implemented` |
| 3 | **Verification overhead** | FM-3.3 guard adds 15-20% overhead on simple tasks | tech-lead | ✅ done | [verification-streamline.md](../../tech-lead/workspace/projects/verification-streamline.md) | `coder.first-pass-rate`, `optimizer.quality-preserved` |
| 4 | **Idle heartbeats** | 40% of heartbeats produce nothing | may | ❌ cancelled (closed 2026-04-17 — heartbeats are autonomy time per Hao; codified in common-sense.md, no separate project) | [adaptive-heartbeats.md](./adaptive-heartbeats.md) | `system.agent-utilization`, `system.request-throughput` |
| 5 | **Process automation** | Repetitive bookkeeping wastes 5-10 ops per session | optimizer | ✅ done | [process-automation.md](../../optimizer/workspace/projects/process-automation.md) | `optimizer.tool-adoption` |

## Source Documents (agent self-assessments)

These files contain the raw feedback that generated the gaps above:

- [bob/system-gaps.md](../../bob/workspace/system-gaps.md) — Knowledge loop gaps, template needs
- [tech-lead/system-gaps.md](../../tech-lead/workspace/system-gaps.md) — Cold start pain, delegation overhead
- [optimizer/system-gaps.md](../../optimizer/workspace/system-gaps.md) — Repeated queries, verification waste
- [coach/system-gaps.md](../../coach/workspace/system-gaps.md) — Experiment setup overhead, idle cycles
- [scout/system-gaps.md](../../scout/workspace/system-gaps.md) — Counter management, arXiv timing waste

## Metric Mapping

| Metric ID | Metric Name | Tracks Gap(s) |
|-----------|-------------|---------------|
| `system.agent-utilization` | Agent utilization | Gap 1, Gap 4 |
| `system.request-throughput` | Request throughput | Gap 4 |
| `system.stuck-requests` | Stuck requests | Gap 2 |
| `scout.findings-used` | Findings used | Gap 2 |
| `bob.designs-implemented` | Designs implemented | Gap 2 |
| `coder.first-pass-rate` | First pass rate | Gap 3 |
| `optimizer.quality-preserved` | Quality preserved | Gap 3 |
| `optimizer.tool-adoption` | Tool adoption | Gap 5 |

## Dependencies

```
M6 (heartbeat metric integration) — PREREQUISITE for everything
    ↓
Gap 1 (cold start) — highest impact, unblocks productivity
    ↓
Gap 2 (feedback loop) — closes the learning cycle
    ↓
Gap 4 (idle heartbeats) — saves waste
Gap 3 (verification) + Gap 5 (automation) — incremental improvements
```

## How May Drives This

Every heartbeat, May checks:
1. Is M6 done? If not, that's the priority.
2. Read this project file — which gap is being worked on?
3. Is the owner making progress? If stalled for 24h, nudge or help unblock.
4. Report overall status in telegram digest.

## Progress Log

### 2026-04-18 — Hao unblock (P0)
- Master status flipped `paused` → `active` per Hao directive.
- Forked bob for M3 design doc (findings → tracked requests auto-creation) — session s_1776516657624_181.
- Notified coach re: prove-the-loop post-revert quality drop (0.703 vs 0.82 baseline, 11/15 evals).

### 2026-04-17 — Hao project review
- Hao marked cold-start-fix, verification-streamline, process-automation as DONE (3/5 gaps delivered).
- Feedback-loop resumed (was paused on metric-system dep) — now driving M2 bidirectional citations.
- Master status flipped `paused` → `active` with concrete Next (see top of file).

### 2026-04-16 — Project created
- Agent self-assessments collected (bob, tech-lead, optimizer, coach, scout)
- Five gaps identified with concrete milestones
- M6 (metric heartbeat integration) identified as prerequisite
- Metric system Phase 1+2 complete, Phase 3 (adoption) in progress
- Five sub-project files created and owners notified

### 2026-04-16 — Linking complete
- Master project linked to all 5 sub-projects with relative paths
- All 5 agent system-gaps.md source docs linked
- 8 metrics mapped to gaps
- Metrics DB updated: `project` field set for all mapped metrics
- Sub-project files updated with back-links to master + source docs

### 2026-04-17 — Status sync
- Reviewed all 5 sub-projects against master table
- Gap 1 (cold-start): Complete — 4 milestones landed (handoff files, session-diff, todo splits, context injection)
- Gap 2 (feedback-loop): M1 done (file-read tracking + unread queries); M2-M4 still open
- Gap 3 (verification-streamline): Analysis doc complete (`agents/may/workspace/guard-friction-analysis.md`, R1-R3 recommendations); implementation not yet dispatched
- Gap 4 (adaptive-heartbeats): ❌ **cancelled 2026-04-17** per Hao — heartbeats are autonomy time, not overhead to minimize. Codified in common-sense.md; no separate project needed. M3 (adaptive frequency) can be re-opened as its own project if load becomes a concern.
- Gap 5 (process-automation): M1-M2 done (saved-queries.sh, evaluator.ts fix); M3-M5 depend on other agents
- Sub-project statuses left as-is (their own project-resume loops will drive remaining milestones)

## Current State
Master-level coordination: 2 of 5 gaps delivered, 3 partial. Next human decisions needed:
- Gap 3: dispatch tech-lead to implement R1/R2/R3 from guard-friction-analysis.md (needs Hao go-ahead since touches verification-depth-guard)
- ~~Gap 4: ship adaptive-heartbeats Phase 1 (prompt-only fast-exit gate) — safe to deploy~~ ❌ cancelled 2026-04-17 per Hao
- Gap 2 M3 (findings → auto-tracked-requests) is tech-lead's explicit ask — highest remaining ROI

### 2026-04-20 — Hao P0 directives
- Status flipped `done` → `active` per Hao directive.
- Created KE-303 (Bottom-Up Isolation debugging method) and KE-304 (Breadcrumbs Not Answers principle).
- KE-304 is "the most important finding for the system" per Hao — governs how all context injection should work.
- Existing KE-context-discovery-chain.md contains the experimental data; KE-304 distills the architectural principle.
- Feedback loop M3 v2 design started (`agents/bob/workspace/designs/feedback-loop-m3-v2-design.md`), incorporating breadcrumb principle.
- Gap 2 (feedback loop) status: M1-M2 done, M3 in active design, M4 deferred.

## Outcome
(pending)
