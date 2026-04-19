# Workflow Health Check — 2026-04-20 Afternoon

**Period**: Last 6 hours (sessions with opCount > 5)
**Data source**: `.state/may.db` sessions table

## 1. Workflow Coverage by Agent

| Agent | Total Sessions | Workflow Sessions | Coverage % |
|-------|---------------|-------------------|-----------|
| optimizer | 68 | 53 | 77.9% |
| amy | 34 | 0 | 0.0% |
| coach | 31 | 15 | 48.4% |
| bob | 30 | 24 | 80.0% |
| tech-lead | 19 | 6 | 31.6% |
| scout | 17 | 7 | 41.2% |
| may | 14 | 0 | 0.0% |
| qa | 11 | 1 | 9.1% |
| **TOTAL** | **224** | **106** | **47.3%** |

## 2. Effectiveness: Workflow vs Non-Workflow

| Mode | Total | Done | Error | Interrupted | Done Rate |
|------|-------|------|-------|-------------|-----------|
| workflow | 106 | 105 | 0 | 1 | 99.1% |
| non-workflow | 118 | 117 | 0 | 0 | 99.2% |

## 3. Comparison to Baseline

| Metric | Baseline (project-workflow-first.md) | Current | Delta |
|--------|--------------------------------------|---------|-------|
| Coverage | 30.8% | **47.3%** | **+16.5pp** ↑ |
| WF Effectiveness | 96.4% | **99.1%** | **+2.7pp** ↑ |
| Non-WF Effectiveness | — | 99.2% | — |

**Coverage is up significantly** from 30.8% → 47.3%. Workflow adoption is growing.

**Effectiveness is essentially equal** between workflow and non-workflow (99.1% vs 99.2%). Workflows are not hurting reliability.

## 4. Bloat & Failure Analysis

### Bloated Workflow Runs

| workflowRunId | Sessions | Agents | Issue |
|---------------|----------|--------|-------|
| `wr_1776612336112_alpj` | **65** | optimizer | Persistent iterative task with many REVIEW_ONLY + iteration cycles |
| `wr_1776620434053_ooiy` | 14 | bob | Normal-ish for multi-step work |
| `wr_1776626730818_spuy` | 11 | tech-lead | — |
| `wr_1776626434089_ivkr` | 11 | coach | — |

The 65-session optimizer workflow is the outlier — it's a persistent/iterative review workflow that spawns alternating review + work sessions. This is by design (not a bug) but worth watching.

### Op Count Bloat

| Mode | Avg Ops | Max Ops |
|------|---------|---------|
| workflow | 16.3 | 114 |
| non-workflow | 13.9 | 48 |

Workflow sessions average ~17% more ops. Max ops (114) comes from the iterative optimizer workflow above. Not alarming.

### Coverage Gaps

- **amy (0%)** and **may (0%)** have zero workflow coverage. These agents appear to run via heartbeats/direct calls without workflow orchestration.
- **qa (9.1%)** is nearly zero — QA runs are mostly ad-hoc.

### Failure Rate

Zero errors across all workflow runs in this window. One interrupted session. No workflow has a high failure rate.

## 5. Recommendation

**NO_DISPATCH**

Rationale:
- Coverage is trending well (+16.5pp over baseline), organic adoption is working
- Effectiveness is near-perfect (99.1%) and equal to non-workflow paths
- No broken or failing workflows detected
- The 65-session optimizer workflow is by-design iterative, not a bug
- amy/may zero-coverage is structural (heartbeat agents) not a gap to fix urgently
- No intervention needed; re-check in 12-24h
