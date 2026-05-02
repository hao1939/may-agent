# Shared Output Manifest

An index of all project deliverables available for cross-agent reuse.
Query with: `grep -i "[tag]" /app/agents/shared/projects/outputs/shared-output-manifest.md`

## Deliverables Index

| Project | Deliverable | Path | Tags | Description |
|---------|------------|------|------|-------------|
| skill-workflow-audit | Behavioral Audit v2 | `skill-workflow-audit/outputs/skill-behavioral-audit-v2.md` | [audit] [metrics] | SCBA/Evidence/Verify compliance across 12 sessions and 7 agents |
| skill-workflow-audit | Skill ROI Measurement | `skill-workflow-audit/outputs/skill-roi-measurement.md` | [metrics] [quality] | Top 5 skills by deployment with WITH/WITHOUT success analysis |
| skill-workflow-audit | Per-Agent Fit Assessment | `skill-workflow-audit/outputs/per-agent-fit-assessment.md` | [audit] [optimization] | Identifies agents with too many/few skills causing bloat or gaps |
| skill-workflow-audit | Context Cost Analysis | `skill-workflow-audit/outputs/context-cost-analysis.md` | [metrics] [optimization] | Token cost breakdown of skill files per agent |
| skill-workflow-audit | Skill Prune Plan | `skill-workflow-audit/outputs/skill-prune-plan.md` | [planning] [optimization] | Prioritized list of skills to remove/consolidate |
| agent-memory-learning | Lesson Retrieval System | `agent-memory-learning/outputs/lesson-retrieval-system.md` | [workflow] [docs] | Design for querying past lessons via .state/lessons.json |
| agent-memory-learning | Memory Benchmarks | `agent-memory-learning/outputs/memory-benchmarks.md` | [metrics] [testing] | Retrieval performance targets and measurement methodology |
| agent-memory-learning | Structured Lesson Format | `agent-memory-learning/outputs/structured-lesson-format.md` | [docs] [schema] | Standard JSON schema for lesson capture with field definitions |
| documentation-gen | Architecture Guide | `documentation-gen/outputs/architecture-guide.md` | [docs] [onboarding] | Multi-agent system architecture overview with communication patterns |
| documentation-gen | Agent Onboarding Guide | `documentation-gen/outputs/agent-onboarding-guide.md` | [docs] [onboarding] | Quick-start guide for new agents to become productive |
| documentation-gen | Workflow Docs | `documentation-gen/outputs/workflow-docs.md` | [docs] [workflow] | Documentation of available workflows and their usage |
| documentation-gen | Docs Inventory | `documentation-gen/outputs/docs-inventory.md` | [docs] [audit] | Complete inventory of all system documentation with freshness |
| test-coverage | Test Gap Analysis | `test-coverage/outputs/test-gap-analysis.md` | [testing] [planning] | Identifies untested code paths and priority areas |
| test-coverage | Critical Path Tests | `test-coverage/outputs/critical-path-tests.md` | [testing] [quality] | Tests covering the most important execution paths |
| test-coverage | Coverage Standards | `test-coverage/outputs/coverage-standards.md` | [testing] [conventions] | Target coverage levels and measurement approach |
| test-coverage | Regression Test Strategy | `test-coverage/outputs/regression-test-strategy.md` | [testing] [workflow] | Strategy for preventing regressions via automated tests |
| system-efficiency | Efficiency Playbook | `outputs/efficiency-playbook.md` | [workflow] [patterns] | Rules for orchestrators/workers to avoid no-op iterations |
| system-efficiency | Regression Guard Config | `outputs/regression-guard-config.md` | [monitoring] [metrics] | Alert thresholds for all 12 satellite metrics |
| hao-alignment | Alignment Audit | `hao-alignment/outputs/` | [docs] [compliance] | HAO compliance checks and recommendations |
| prompt-efficiency | Prompt Analysis | `prompt-efficiency/outputs/` | [optimization] [prompts] | Prompt token usage analysis and improvements |

## How to Use

1. `grep -i "testing" /app/agents/shared/projects/outputs/shared-output-manifest.md` — find test-related deliverables
2. Read the file at the path shown to get the full deliverable
3. All paths are relative to `/app/agents/shared/projects/`
