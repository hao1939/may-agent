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
| agent-memory-learning | Lesson Retrieval System | `/app/agents/shared/projects/agent-memory-learning/outputs/lesson-retrieval-system.md` | [workflow] [docs] | Design for querying past lessons via .state/lessons.json before tasks |
| agent-memory-learning | Cross-Session Retrieval | `/app/agents/shared/projects/agent-memory-learning/outputs/cross-session-retrieval.md` | [workflow] [docs] | Structured retrieval API for querying lessons without reading full checkpoints |
| agent-memory-learning | Lesson Database v1 | `/app/agents/shared/projects/agent-memory-learning/outputs/lesson-database-v1.md` | [docs] [quality] | Initial lesson corpus with category/tag schema |
| agent-memory-learning | Memory Benchmarks | `/app/agents/shared/projects/agent-memory-learning/outputs/memory-benchmarks.md` | [metrics] [testing] | Retrieval accuracy and latency measurements |
| documentation-gen | Agent Onboarding Guide | `/app/agents/shared/projects/documentation-gen/outputs/agent-onboarding-guide.md` | [docs] [onboarding] | Step-by-step guide for new agents to get productive |
| documentation-gen | Architecture Guide | `/app/agents/shared/projects/documentation-gen/outputs/architecture-guide.md` | [docs] [architecture] | Multi-agent system overview: roles, communication, shared files |
| documentation-gen | Agent Quick Reference | `/app/agents/shared/projects/documentation-gen/outputs/agent-quick-reference.md` | [docs] [onboarding] | Cheat sheet for agent conventions and commands |
| documentation-gen | Workflow Docs | `/app/agents/shared/projects/documentation-gen/outputs/workflow-docs.md` | [docs] [workflow] | Available workflows and how to use them |
| workflow-reliability | Guardrails v3 Design | `/app/agents/shared/projects/workflow-reliability/outputs/workflow-guardrails-v3-design.md` | [workflow] [reliability] | Structural write-first enforcement via first-call gate interception |
| workflow-reliability | Reliability Baseline | `/app/agents/shared/projects/workflow-reliability/outputs/workflow-reliability-baseline.md` | [metrics] [reliability] | Baseline: 33% worker success rate with failure mode breakdown |
| workflow-reliability | Sustained Rate Tracking | `/app/agents/shared/projects/workflow-reliability/outputs/sustained-rate-tracking.md` | [metrics] [monitoring] | Multi-day tracking of worker iteration success rates |
| skill-workflow-audit | Context Cost Analysis | `/app/agents/shared/projects/skill-workflow-audit/outputs/context-cost-analysis.md` | [metrics] [optimization] | Per-agent skill context token costs and bloat identification |
| skill-workflow-audit | Per-Agent Fit Assessment | `/app/agents/shared/projects/skill-workflow-audit/outputs/per-agent-fit-assessment.md` | [audit] [quality] | Identifies agents with too many/few skills causing bloat or gaps |
| skill-workflow-audit | Skill Prune Plan | `/app/agents/shared/projects/skill-workflow-audit/outputs/skill-prune-plan.md` | [optimization] [planning] | Actionable pruning plan for 16 conflicting skills (~85KB savings) |
| agent-memory-learning | Structured Lesson Format | `/app/agents/shared/projects/agent-memory-learning/outputs/structured-lesson-format.md` | [docs] [workflow] | JSON schema for lesson capture with category/tag fields |
| agent-memory-learning | Pipeline Metrics | `/app/agents/shared/projects/agent-memory-learning/outputs/pipeline-metrics.md` | [metrics] [monitoring] | Measures whether context-learn pipeline fires organically |
| documentation-gen | Doc Freshness Checker | `/app/agents/shared/projects/documentation-gen/outputs/check-freshness.sh` | [monitoring] [docs] | Shell script reporting doc file ages and staleness |
| documentation-gen | Doc-Gen Script | `/app/agents/shared/projects/documentation-gen/outputs/doc-gen-script.md` | [workflow] [docs] | Auto-generation pipeline spec for extracting docs from code/configs |
| test-coverage | Test Gap Analysis | `/app/agents/shared/projects/test-coverage/outputs/test-gap-analysis.md` | [testing] [quality] | Identifies untested critical paths and prioritizes coverage work |
| test-coverage | Critical Path Tests | `/app/agents/shared/projects/test-coverage/outputs/critical-path-tests.md` | [testing] [reliability] | Test definitions for highest-risk system paths |
| test-coverage | Regression Test Strategy | `/app/agents/shared/projects/test-coverage/outputs/regression-test-strategy.md` | [testing] [workflow] | Strategy balancing test thoroughness with execution speed |
| test-coverage | Coverage Baseline | `/app/agents/shared/projects/test-coverage/outputs/coverage-baseline.md` | [testing] [metrics] | Initial coverage measurements as improvement reference point |
| test-coverage | Test Automation Plan | `/app/agents/shared/projects/test-coverage/outputs/test-automation-plan.md` | [testing] [workflow] | Automated execution strategy for continuous validation |
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
