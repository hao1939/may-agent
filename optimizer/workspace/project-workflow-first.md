# Project: Workflow-First Culture

**Owner**: Optimizer | **Priority**: P0 | **Started**: 2026-04-19

## Current State (baseline)

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| workflow-coverage | **30.8%** | 80% | 🔴 Gap: 49.2pp |
| workflow-effectiveness | **96.4%** | >90% | 🟢 Already met |

### Coverage by Agent (7d, sessions with opCount > 5)
| Agent | Total | With WF | Coverage |
|-------|-------|---------|----------|
| optimizer | 374 | 222 | 59.4% |
| coder | 138 | 76 | 55.1% |
| bob | 400 | 201 | 50.3% |
| tech-lead | 390 | 98 | 25.1% |
| coach | 404 | 91 | 22.5% |
| scout | 173 | 26 | 15.0% |
| may | 144 | 4 | 2.8% |
| qa | 237 | 4 | 1.7% |
| evaluator | 50 | 0 | 0% |
| amy | 37 | 0 | 0% |

## Completed Actions

### Audit (2026-04-19)
- ✅ Metrics `workflow-coverage` and `workflow-effectiveness` already existed in DB — recorded first snapshots
- ✅ Removed `auto-loop.ts` (0 usage) — deleted from disk
- ✅ Removed `skill-lifecycle.ts` (0 usage) — deleted from disk
- ✅ Updated REGISTRY.md

### Review Queue (rare workflows)
| Workflow | Decision | Rationale |
|----------|----------|-----------|
| verify-wrap | Keep — pilot | New, designed for EXP-138. Give it production time. |
| parallel-research | Keep | 12 sessions in 48h — active usage |
| coaching-feedback | Review | Check if coach uses growth-cycle instead |
| error-scan | Review | Check recent usage data |

## Highest-Value Conversion Candidates

Prioritized by **volume × coverage gap** (biggest impact on metric):

1. **May: dispatch workflow** — 144 sessions, 2.8% coverage. Pattern: receive request → triage → dispatch → follow up. May already has workflows but doesn't use them.
2. **QA: evaluation workflow** — 237 sessions, 1.7% coverage. Pattern: receive task → evaluate → score → report.
3. **Coach: training dispatch** — 404 sessions, 22.5%. Has growth-cycle/training-sprint but low adoption.
4. **Tech-lead: investigate-and-fix** — 390 sessions, 25.1%. Pattern: pick lens → investigate → write finding → dispatch fix.
5. **Scout: research pipeline** — 173 sessions, 15%. Pattern: triage arXiv → filter → deep dive → cross-reference.

### Key Insight from EXP-028
> LLMs will NOT spontaneously discover workflows. Explicit heartbeat instructions required.

**Strategy**: Converting patterns to workflows is necessary but not sufficient. Each workflow must be **wired into the agent's heartbeat** or handlers to achieve adoption.

## Plan to Reach 80%

### Phase 1: Wire existing workflows (target: 45%)
The biggest win is getting agents to USE workflows they already have:
- May has 4 workflows (design-then-build, project-monitor, research-pipeline, test-and-fix) — 2.8% usage
- Coach has 5 workflows — 22.5% usage
- Tech-lead has verified-coder — 25.1% usage
- **Action**: Add `workflow.run()` instructions to heartbeats for may, coach, tech-lead, scout

### Phase 2: Create missing workflows (target: 60%)
- QA evaluation workflow (biggest gap by volume)
- Scout research-triage workflow
- May dispatch-and-monitor workflow

### Phase 3: Optimize adoption (target: 80%)
- Monitor which agents regress
- Wire workflows into handlers/cron, not just heartbeats
- Simplify workflow API for common patterns

## Detection Patterns (ongoing)

Look for in session transcripts:
- 3+ tool calls in recognizable sequence → candidate
- Same sequence across multiple sessions → confirmed
- Prose-described multi-step processes → should be workflow
