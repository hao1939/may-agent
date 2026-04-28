# Output Improvement Plan

## Post-Cleanup Snapshot (2026-04-28)
- Active shared projects: 4 (system-efficiency, agent-system-literacy, skill-workflow-audit, request-deduplication)
- Completed: handler-reliability ✅
- Archived: 51 zombie projects
- Agent-owned projects alive: ~3 (coach/breadcrumb-gap, coach/prove-the-loop, qa/artifact-quality)
- Agent-owned projects dead (500+ skips): ~70
- Worker iterations producing deliverables (last 7 days): ~5
- Comment-only/no-output iterations: 14+

## Top 3 Actions to Increase Throughput

### 1. Fix worker instruction-following (highest impact)
Workers announce intent to write files but never call write(). This burned 5 iterations on this project alone, plus 9 on agent-system-literacy and 2+ on skill-workflow-audit.

**Fix**: Orchestrators must require write() as the FIRST tool call. No analysis, no reading — produce the file, then refine. The master-worker workflow should verify that at least one file was created/modified per iteration.

### 2. Archive remaining zombie projects
~70 agent-owned projects have 500+ consecutive skips. They waste health-checker cycles and create noise.

**Fix**: Archive all projects with consecutiveSkips > 100. This was done for 51 shared projects; now do it for agent-owned ones.

### 3. Increase active project count to 5+
Only 3 projects are actively iterating. To hit 10 iterations/24h, need more projects with clear milestones and capable workers.

**Fix**: Open 2-3 new projects focused on:
- Worker output verification (auto-check that iterations produce files)
- Agent-owned zombie archival
- A concrete feature or content project to prove the system works

## Next Milestones for This Project
- [ ] Archive agent-owned zombie projects (70+ with 500+ skips)
- [ ] Add output verification to master-worker workflow (reject iterations with no file writes)
- [ ] Open 2 new projects and get them to 3+ iterations each
- [ ] Measure: achieve 10 project iterations in a 24h window
- [ ] Measure: 5+ deliverable files produced in a 24h window
