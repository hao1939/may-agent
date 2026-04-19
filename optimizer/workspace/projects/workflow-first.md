# Project: Workflow-First Culture

**Status**: active
**Owner**: optimizer
**Priority**: P0

## Goal

Make workflows the default way agents work. When an agent does something repeatedly, enforces a process, or builds stable operations — it should be a workflow.

## Three Principles

### 1. Repeat tasks → workflow
When an agent does the same pattern more than twice (investigate → diagnose → fix, research → synthesize → write), that pattern should become a workflow. The workflow captures the process so it's consistent every time.

### 2. Enforcement → workflow or guard
When something needs to happen reliably (verify after write, check metrics before deciding), it should be structural. If it's per-session process → workflow. If it's a quality check across all sessions → guard.

### 3. Stable operations → workflow
When a process is proven and should be reused (persistent-task for projects, implement-and-verify for code), it's a workflow. Not instructions in a doc — executable process.

## Metrics

| Metric | Type | What it measures | Target |
|--------|------|-----------------|--------|
| `optimizer.workflow-coverage` | continuous | % of multi-step work that uses a workflow | 80% |
| `optimizer.repeat-task-detection` | continuous | Repeat patterns identified and converted to workflows per week | ≥2 |
| `optimizer.workflow-effectiveness` | health | % of workflow runs that complete successfully vs freestyle | >90% |

## How to Drive It

### Detection
Optimizer reviews session transcripts for patterns:
- Agent does 3+ tool calls in a recognizable sequence → candidate for workflow
- Same sequence appears in multiple sessions → confirmed repeat task
- Agent's heartbeat describes a multi-step process in prose → should be a workflow

### Creation
When a pattern is detected:
1. Design the workflow (steps, inputs, outputs)
2. Implement as `agents/<owner>/workflows/<name>.ts` or `agents/shared/workflows/<name>.ts`
3. Test with gym or direct execution
4. Add to the agent's preferred workflows section
5. Monitor adoption

### Monitoring
Track via metrics:
- Are agents using the workflow? (tool call data)
- Does it complete successfully? (workflow run records)
- Is it better than freestyle? (compare quality/efficiency)

## Current Workflows (audit — updated 2026-04-20)

| Workflow | References | Status |
|----------|-----------|--------|
| verify-wrap | 539 | ✅ Keep — heavily used |
| growth-cycle | 85 | ✅ Keep — core coaching |
| parallel-research | 54 | ✅ Keep — active |
| implement-and-verify | 49 | ✅ Keep — code changes |
| implement-and-review | 49 | ✅ Keep |
| persistent-task | 36 | ✅ Keep — project engine |
| training-sprint | 29 | ✅ Keep |

### Removed 2026-04-20

Dead workflows (0 code references, deleted from disk):
- `coaching-feedback` — shared, never called from workflow runner
- `error-scan` — shared, never called
- `convention-review` — coach, only self-referencing
- `verify-setup` — coach, only self-referencing
- `design-then-build` — may, only self-referencing
- `test-and-fix` — may, only self-referencing
- `research-pipeline` — may, only self-referencing

Previously removed: `auto-loop`, `skill-lifecycle` (2026-04-19), plus 12 archived shared workflows (2026-04-11).

Note: `auto-loop` and `skill-lifecycle` references are all in docs/archives/findings — no code usage. Already deleted.

## Candidate Patterns to Convert

From agent self-assessments and session archaeology:
- Bob: find paper → evaluate → write deep dive → generate hypothesis → link to system
- Tech-lead: pick lens → investigate → write finding → dispatch fix
- Scout: triage arXiv → filter → deep dive → cross-reference
- May: receive request → triage → dispatch to agent → follow up

## Milestones

- [x] Audit all workflows with real usage data (iteration 7)
- [x] Remove dead workflows — coaching-feedback, error-scan, convention-review, verify-setup, design-then-build, test-and-fix, research-pipeline (iteration 8)
- [x] Remove auto-loop and skill-lifecycle (confirmed dead in code)
- [ ] Design and implement Bob's research-deep-dive workflow
- [ ] Design and implement May's dispatch-and-follow-up workflow
- [ ] Wire workflow.run() calls into agent heartbeats/handlers
- [ ] Measure workflow coverage metric (target: 80%)

## Next Action

1. **Design Bob's research workflow**: Bob's pattern (find paper → evaluate → deep dive → hypothesize → link to system) is the top candidate. Create `agents/bob/workflows/research-deep-dive.md` spec.
2. **Design May's dispatch workflow**: May's pattern (receive → triage → dispatch → follow up) is the second candidate.
3. **Wire workflows into handlers**: Add `workflow.run()` calls where appropriate.

- [2026-04-19 hao] Don't remove dead workflows. Some are dead because agents don't use them properly — not because the workflow is bad. Two options: 1) Fix agent adoption — investigate WHY the workflow isn't used and fix the routing/framing so agents invoke it. 2) Archive for reference — move to an archive directory, keep for future use. Don't delete knowledge.
