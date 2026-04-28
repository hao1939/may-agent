# System Output Audit — 2026-04-28

## 1. Active Project Inventory

### Shared Projects (actively iterating)
| Project | Status | Iterations | Last Activity | Issue |
|---------|--------|-----------|---------------|-------|
| system-efficiency | active | 15 (9 comment-only) | 2026-04-28 | Comment loop (now broken) |
| agent-system-literacy | active | 9 (25 journal entries) | 2026-04-28 | Worker fails to produce deliverables (9 iterations, no gym-run output) |
| skill-workflow-audit | active | 5 (34 journal entries) | 2026-04-28 | Worker fails to produce audit file for 2+ iterations |
| request-deduplication | waiting | 10 | 2026-04-28 | Done — duplicate storms fixed at platform level. Should be closed. |
| handler-reliability | closed | 3 | 2026-04-28 | Complete ✅ |

### Agent-Owned Projects (sample of ~70+ total)
Almost all have **consecutiveSkips > 500** — effectively dead. Examples:
- `bob/context-learning`: 567 skips
- `optimizer/cron-consolidation`: 567 skips  
- `coach/agent-autonomy`: 567 skips
- `may/metric-reactivity`: 567 skips
- `tech-lead/project-tracking-db`: 567 skips

**Only 3 agent projects with low skips**: `coach/breadcrumb-gap` (0), `coach/prove-the-loop` (0), `qa/artifact-quality` (0)

### Archived Projects
51 projects in `_archive/` — massive graveyard of completed/abandoned work.

## 2. Output Metrics (Last 7 Days)

- **Total projects making real progress**: ~3 (handler-reliability completed, skill-workflow-audit and agent-system-literacy attempted work)
- **Total worker iterations with deliverables**: ~5 across all projects
- **Comment-only iterations**: 9+ (system-efficiency alone had 9)
- **Projects stuck in loops**: 2 (system-efficiency comment loop, request-deduplication re-processing same comment)
- **Active project count**: 3 shared + ~3 agent-owned = ~6 nominally active, but only 2-3 producing anything

## 3. Blocker Analysis

### Blocker #1: Worker Instruction-Following Failure
**Impact**: HIGH — Multiple projects iterate without producing deliverables.
- agent-system-literacy: 9 iterations, worker never produced gym-run-1.md
- skill-workflow-audit: worker fails to produce audit file for 2+ iterations
- Workers consume sessions/budget but produce nothing

### Blocker #2: Zombie Projects (~70 projects with 500+ skips)
**Impact**: MEDIUM — System carries massive dead weight. Health checker wastes cycles scanning them. No one closes or archives them. Creates noise in project tracking.

### Blocker #3: Comment Loop / Iteration Infrastructure
**Impact**: MEDIUM — system-efficiency lost 9 iterations to a comment replay bug. request-deduplication re-processed the same hao comment 4 times. Infrastructure allows comment iterations to consume iteration budget without work.

## 4. Recommendations

### R1: Archive zombie projects (immediate, high impact)
All ~70 projects with consecutiveSkips > 100 should be moved to `_archive/` or marked closed. This cleans up health tracking and focuses attention on live work.

### R2: Improve worker instruction compliance (high impact, needs investigation)
The biggest output blocker is workers that iterate without producing required files. Options:
- Add pre/post checks to master-worker workflow: verify output file exists before marking iteration complete
- Coach agents on file creation (coach/instruction-following project exists but is stuck at 505 skips)

### R3: Create 2-3 new high-value projects (directly addresses project.active-count metric)
Current active project count is ~3. To hit target of 10 iterations/24h across 3+ active projects, need to:
- Define new projects with clear, achievable milestones
- Assign to agents that have demonstrated output capability (bob, tech-lead)
- Focus on infrastructure improvements that compound (e.g., auto-archive, worker output verification)
