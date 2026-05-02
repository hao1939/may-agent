# Shared Output Manifest

Index of reusable deliverables across all projects. Enables cross-agent discovery.

## Deliverables Index

| Project | Deliverable | Path | Description | Useful For |
|---------|------------|------|-------------|------------|
| system-efficiency | satellite-triage.md | `/app/agents/shared/projects/outputs/satellite-triage.md` | Ranked assessment of all 12 satellite projects with metrics and gaps | Any agent planning work prioritization |
| system-efficiency | regression-guard-config.md | `/app/agents/shared/projects/outputs/regression-guard-config.md` | Alert thresholds for all closed projects' metrics | Monitoring agents, health-check workflows |
| system-efficiency | efficiency-playbook.md | `/app/agents/shared/projects/outputs/efficiency-playbook.md` | Rules for orchestrators/workers to avoid no-op iterations | All agents, especially new ones |
| system-efficiency | next-frontier-proposal.md | `/app/agents/shared/projects/system-efficiency/outputs/next-frontier-proposal.md` | 3 proposals for next initiatives after satellite completion | Orchestrators deciding what to work on |
| system-efficiency | system-efficiency-retrospective.md | `/app/agents/shared/projects/system-efficiency/outputs/system-efficiency-retrospective.md` | Full project retrospective with timeline and lessons | Future project leads |
| test-coverage | coverage reports | `/app/agents/shared/projects/test-coverage/outputs/` | Test coverage analysis and gap identification | Developers, CI agents |
| proof-of-life-dashboard | dashboard spec | `/app/agents/shared/projects/proof-of-life-dashboard/outputs/` | Agent health monitoring specification | Infrastructure agents |
| hao-alignment | alignment audit | `/app/agents/shared/projects/hao-alignment/outputs/` | HAO compliance checks and recommendations | All agents for convention adherence |
| agent-system-literacy | literacy materials | `/app/agents/shared/projects/agent-system-literacy/outputs/` | Onboarding docs for understanding the agent system | New agents, humans onboarding |
| evaluation-revival | eval framework | `/app/agents/shared/projects/evaluation-revival/outputs/` | Evaluation methodology and scoring rubrics | Quality-focused agents |
| request-deduplication | dedup rules | `/app/agents/shared/projects/request-deduplication/outputs/` | Patterns for detecting duplicate work requests | Orchestrators, request routing |
| prompt-efficiency | prompt patterns | `/app/agents/shared/projects/prompt-efficiency/outputs/` | Optimized prompt templates and anti-patterns | All agents crafting prompts |
| coach-quality | coaching rubric | `/app/agents/shared/projects/coach-quality/outputs/` | Quality standards for coaching interactions | Coach agents |
| skill-workflow-audit | workflow analysis | `/app/agents/shared/projects/skill-workflow-audit/outputs/` | Audit of skill-building workflows and gaps | Workflow designers |
| handler-reliability | handler patterns | `/app/agents/shared/projects/handler-reliability/outputs/` | Reliability patterns for event handlers | Infrastructure agents |
| gym-quality-improvement | gym standards | `/app/agents/shared/projects/gym-quality-improvement/outputs/` | Quality criteria for training exercises | Training content creators |
| agent-convention-compliance | convention rules | `/app/agents/shared/projects/agent-convention-compliance/outputs/` | Compliance checklist for agent conventions | All agents for self-audit |
| cross-agent-collaboration | shared-output-manifest.md | `/app/agents/shared/projects/outputs/shared-output-manifest.md` | This file — index of all reusable outputs | All agents seeking existing work |

## How to Use This Manifest

1. **Before starting work**: Search this table for existing deliverables in your problem space
2. **After producing output**: Add your deliverable to this manifest via PR or edit
3. **Discovery query**: Filter by "Useful For" column to find outputs relevant to your role

## Maintenance

- Updated whenever a project produces a significant reusable deliverable
- Stale entries (project closed, file deleted) should be marked or removed
- Each project owner is responsible for registering their outputs here

---
*First deliverable of the cross-agent-collaboration project.*
