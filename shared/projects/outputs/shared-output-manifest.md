# Shared Output Manifest

An index of all project deliverables available for cross-agent reuse.

## Deliverables Index

| Project | Deliverable | Path | Tags | Description |
|---------|------------|------|------|-------------|
| system-efficiency | Satellite Triage | `/app/agents/shared/projects/outputs/satellite-triage.md` | [planning] [metrics] | Ranked list of all satellite projects with gap analysis |
| system-efficiency | Regression Guard Config | `/app/agents/shared/projects/outputs/regression-guard-config.md` | [monitoring] [metrics] | Alert thresholds for all 12 satellite metrics |
| system-efficiency | Efficiency Playbook | `/app/agents/shared/projects/outputs/efficiency-playbook.md` | [workflow] [patterns] | Rules for orchestrators and workers to avoid no-op iterations |
| system-efficiency | Retrospective | `/app/agents/shared/projects/system-efficiency/outputs/system-efficiency-retrospective.md` | [docs] [retrospective] | Full project retrospective with timeline and lessons |
| system-efficiency | Next Frontier Proposal | `/app/agents/shared/projects/system-efficiency/outputs/next-frontier-proposal.md` | [planning] [proposals] | 3 proposals for next initiatives after satellite completion |
| test-coverage | Coverage Reports | `/app/agents/shared/projects/test-coverage/outputs/` | [testing] [quality] | Test coverage analysis and improvement tracking |
| proof-of-life-dashboard | Dashboard Spec | `/app/agents/shared/projects/proof-of-life-dashboard/outputs/` | [monitoring] [observability] | Agent liveness monitoring specification |
| hao-alignment | Alignment Audit | `/app/agents/shared/projects/hao-alignment/outputs/` | [docs] [compliance] | HAO compliance checks and recommendations |
| agent-system-literacy | Literacy Guide | `/app/agents/shared/projects/agent-system-literacy/outputs/` | [docs] [onboarding] | System architecture documentation for agents |
| evaluation-revival | Eval Framework | `/app/agents/shared/projects/evaluation-revival/outputs/` | [testing] [evaluation] | Evaluation pipeline restoration and results |
| request-deduplication | Dedup Logic | `/app/agents/shared/projects/request-deduplication/outputs/` | [workflow] [optimization] | Request deduplication analysis and implementation |
| prompt-efficiency | Prompt Analysis | `/app/agents/shared/projects/prompt-efficiency/outputs/` | [optimization] [prompts] | Prompt token usage analysis and improvements |
| coach-quality | Coach Metrics | `/app/agents/shared/projects/coach-quality/outputs/` | [quality] [coaching] | Coaching output quality assessment |
| skill-workflow-audit | Behavioral Audit v2 | `/app/agents/shared/projects/skill-workflow-audit/outputs/skill-behavioral-audit-v2.md` | [audit] [metrics] [compliance] | Measures SCBA/Evidence/Verify compliance across 12 sessions and 7 agents |
| skill-workflow-audit | Skill ROI Measurement | `/app/agents/shared/projects/skill-workflow-audit/outputs/skill-roi-measurement.md` | [metrics] [quality] | Top 5 skills by deployment with WITH/WITHOUT success analysis |
| skill-workflow-audit | Skill Freshness Audit | `/app/agents/shared/projects/skill-workflow-audit/outputs/skill-freshness-audit.md` | [audit] [docs] | Per-agent skill file counts and freshness methodology |
| skill-workflow-audit | Skill Conflict Audit | `/app/agents/shared/projects/skill-workflow-audit/outputs/skill-conflict-audit.md` | [audit] [quality] | Identifies contradictions/overlaps between skill files |
| handler-reliability | Reliability Report | `/app/agents/shared/projects/handler-reliability/outputs/` | [reliability] [errors] | Handler error rates and fix tracking |
| gym-quality-improvement | Quality Metrics | `/app/agents/shared/projects/gym-quality-improvement/outputs/` | [quality] [training] | Gym content quality improvements |
| agent-convention-compliance | Compliance Report | `/app/agents/shared/projects/agent-convention-compliance/outputs/` | [compliance] [conventions] | Convention adherence tracking |
| cross-agent-collaboration | This Manifest | `/app/agents/shared/projects/cross-agent-collaboration/outputs/shared-output-manifest.md` | [discovery] [index] | Master index of all reusable deliverables |

## Discovery Convention

### How to Query This Manifest

1. **By topic tag**: `grep -i "\[testing\]" shared-output-manifest.md` — finds all testing-related deliverables
2. **By project**: `grep -i "system-efficiency" shared-output-manifest.md` — finds all outputs from a specific project
3. **By recency**: Files are listed in approximate chronological order (newest projects at bottom)

### Tags Reference

- `[testing]` — test suites, coverage reports, evaluation results
- `[docs]` — documentation, guides, onboarding materials
- `[workflow]` — process improvements, automation specs
- `[monitoring]` — dashboards, alerts, observability
- `[metrics]` — measurement data, targets, tracking
- `[planning]` — proposals, triage, roadmaps
- `[optimization]` — efficiency improvements, deduplication
- `[quality]` — quality assessments, rubrics, scoring
- `[compliance]` — convention adherence, alignment checks
- `[discovery]` — cross-agent indexing and search

### Agent Protocol

Before starting any analysis or deliverable:
1. Check this manifest for existing relevant outputs
2. If a related deliverable exists, read it first to avoid duplication
3. After producing a new deliverable, add an entry to this manifest
4. Tag entries with at least 2 relevant tags from the reference above

### Maintenance

This manifest should be updated whenever:
- A new project produces its first deliverable
- A project is completed (mark its entries with ✅)
- An output is superseded by a newer version (mark old entry with ⚠️)
