# Workflow Coverage Fix: project-resume workflowRunId Propagation

**Date**: 2026-04-20
**Author**: optimizer (iteration 6)

## Problem

Workflow coverage is **43.8%** (last 24h, LLM sessions only). The goal is 80%.

### Measured Coverage (last 24h, LLM sessions with opCount > 0)
| Agent | Workflow / Total | Coverage |
|-------|-----------------|----------|
| may | 128/281 | 46% |
| optimizer | 102/176 | 58% |
| tech-lead | 99/168 | 59% |
| bob | 67/131 | 51% |
| coach | 45/121 | 37% |
| amy | 0/79 | 0% |
| scout | 23/71 | 32% |
| qa | 9/52 | 17% |
| **Total** | **473/1080** | **43.8%** |

### Root Cause Analysis

Non-workflow sessions by source (last 24h, LLM only):
- **`cron` source (project-resume)**: ~160 sessions — the `project-resume` handler calls `ctx.manager.callAgent()` with `{ source: "workflow" }` but **no `workflowRunId`**. The session-sync handler counts sessions with workflowRunId for coverage.
- **`agents.fork` source**: ~46 sessions — child sessions forked via the `agents` tool don't inherit workflowRunId from the parent workflow session.

## Fix Applied

### File: `agents/may/handlers/project-resume.ts`

**Change**: Added `generateRunId()` function and pass `workflowRunId: runId` to `ctx.manager.callAgent()` calls.

This ensures every session spawned by the project-resume handler (persistent-task workflow) gets a proper workflowRunId, making it countable as a workflow session.

### Expected Impact

The ~160 project-resume sessions/day that currently lack workflowRunId will now have one. This alone should push coverage from **43.8% → ~58-62%**.

## Remaining Gap to 80%

To reach 80%, we also need:
1. **agents.fork sessions** (~46/day): Propagate workflowRunId from parent session context to forked child sessions. Requires changes to the session/tool infrastructure.
2. **amy agent** (0%): Amy has 79 sessions/day with zero workflow coverage. Needs workflow wiring.
3. **qa agent** (17%): Most QA sessions come through non-workflow paths.

### Specific next steps to close remaining gap:
- Wire `agents.fork` to inherit parent's workflowRunId (infra change in session creation)
- Add amy-kimi heartbeat workflow to cron (currently disabled)
- Route QA repo-gate-check spawned sessions through workflow
