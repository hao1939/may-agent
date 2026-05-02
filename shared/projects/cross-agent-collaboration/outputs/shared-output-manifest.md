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
| prompt-efficiency | Shared Rules Proposal | `/app/agents/shared/projects/prompt-efficiency/outputs/shared-rules-proposal.md` | [optimization] [prompts] [planning] | Deduplication proposal for shared rules across agent configs |
| prompt-efficiency | Baseline Audit | `/app/agents/shared/projects/prompt-efficiency/outputs/p1-baseline-audit.md` | [metrics] [optimization] | Token counts and size analysis of SOUL.md and context files |
| prompt-efficiency | Dedup Analysis | `/app/agents/shared/projects/prompt-efficiency/outputs/p2-dedup-analysis.md` | [optimization] [prompts] | Guard-enforced rules duplicated in SOUL.md — removal candidates |
| request-deduplication | Dedup Measurement | `/app/agents/shared/projects/request-deduplication/outputs/dedup-measurement.md` | [metrics] [workflow] | Quantified deduplication rates and methodology |
| request-deduplication | Project Closure | `/app/agents/shared/projects/request-deduplication/outputs/project-closure-summary.md` | [docs] [retrospective] | Final summary with outcomes and lessons learned |
| agent-system-literacy | Literacy Measurement | `/app/agents/shared/projects/agent-system-literacy/outputs/literacy-measurement.md` | [metrics] [onboarding] | Measurement of agent system knowledge before/after training |
| agent-system-literacy | Regression Guard | `/app/agents/shared/projects/agent-system-literacy/outputs/regression-guard.md` | [monitoring] [metrics] | Metrics to watch for literacy regression over time |
| documentation-gen | Docs Inventory | `/app/agents/shared/projects/documentation-gen/outputs/docs-inventory.md` | [docs] [discovery] | Complete inventory of all documentation files in the system |
| handler-reliability | Verification Report | `/app/agents/shared/projects/handler-reliability/outputs/verification-report.md` | [reliability] [testing] | Handler fix verification with before/after error rates |
| agent-memory-learning | Memory Audit | `/app/agents/shared/projects/agent-memory-learning/outputs/memory-audit.md` | [audit] [quality] | Audit of lesson quality and retrieval effectiveness |
| cross-agent-collaboration | Adoption Baseline | `/app/agents/shared/projects/cross-agent-collaboration/outputs/adoption-baseline.md` | [metrics] [discovery] | Baseline measurement of manifest usage (before snapshot) |
| cross-agent-collaboration | This Manifest | `/app/agents/shared/projects/cross-agent-collaboration/outputs/shared-output-manifest.md` | [discovery] [index] | Master index of all reusable deliverables |
| agent-system-literacy | Deployment Log | `/app/agents/shared/projects/agent-system-literacy/outputs/deployment-log.md` | [docs] [workflow] | Phase 2 skill deployment steps and results |
| agent-system-literacy | Gym Results | `/app/agents/shared/projects/agent-system-literacy/outputs/gym-results.md` | [metrics] [testing] | Gym evaluation results for literacy improvements |
| agent-system-literacy | Investigation | `/app/agents/shared/projects/agent-system-literacy/outputs/investigation.md` | [audit] [metrics] | Root-cause analysis of why literacy metrics didn't improve |
| agent-system-literacy | Post-Deployment Comparison | `/app/agents/shared/projects/agent-system-literacy/outputs/post-deployment-comparison.md` | [metrics] [quality] | Before/after comparison of literacy scores post-deployment |
| agent-system-literacy | Re-Plan | `/app/agents/shared/projects/agent-system-literacy/outputs/re-plan.md` | [planning] [workflow] | Revised plan after initial approach failed |
| documentation-gen | Completion Summary | `/app/agents/shared/projects/documentation-gen/outputs/completion-summary.md` | [docs] [retrospective] | Final project outcomes and lessons learned |
| handler-reliability | Iteration 3 Complete | `/app/agents/shared/projects/handler-reliability/outputs/iteration-3-complete.md` | [reliability] [testing] | Final verification of handler reliability fixes |
| prompt-efficiency | P3 Trim Plan | `/app/agents/shared/projects/prompt-efficiency/outputs/p3-trim-plan.md` | [optimization] [prompts] | Plan to trim 6 SOUL.md files over 600-word target |
| prompt-efficiency | P3 Trimming Proposal | `/app/agents/shared/projects/prompt-efficiency/outputs/p3-trimming-proposal.md` | [optimization] [prompts] | Proposal to trim verbose/duplicate guidance from SOUL.md files |
| skill-workflow-audit | Cycle 2 Freshness Audit | `/app/agents/shared/projects/skill-workflow-audit/outputs/cycle2-skill-freshness-audit.md` | [audit] [optimization] | Skill freshness and context cost audit (cycle 2) |
| skill-workflow-audit | Cycle 2 VBF/SCBA Re-Audit | `/app/agents/shared/projects/skill-workflow-audit/outputs/cycle2-vbf-scba-reaudit.md` | [audit] [quality] | Re-audit of VBF and SCBA skills after changes |
| skill-workflow-audit | Prune Execution Log | `/app/agents/shared/projects/skill-workflow-audit/outputs/prune-execution-log.md` | [optimization] [docs] | Log of skill pruning actions taken |
| skill-workflow-audit | Replan Assessment | `/app/agents/shared/projects/skill-workflow-audit/outputs/replan-assessment.md` | [planning] [audit] | Assessment triggering project replan |
| skill-workflow-audit | Skill Behavioral Audit | `/app/agents/shared/projects/skill-workflow-audit/outputs/skill-behavioral-audit.md` | [audit] [quality] | Analysis of whether agents actually act on injected skills |
| skill-workflow-audit | Skill Deployment | `/app/agents/shared/projects/skill-workflow-audit/outputs/skill-deployment.md` | [workflow] [docs] | Skill deployment and gym scenario report |

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
| cross-agent-collaboration | reuse-log.md | Tracks instances of cross-agent output reuse | reuse, measurement |
| skill-workflow-audit | skill-roi-and-verified-rate.md | Skill ROI and verified-rate final assessment | measurement, skills |
| skill-workflow-audit | skills-audit.md | Comprehensive skills audit report | audit, skills |
| skill-workflow-audit | skills-impact.md | Skills impact analysis | measurement, skills |
| skill-workflow-audit | workflow-runtime-audit.md | Workflow runtime performance audit | audit, performance |
| system-efficiency | efficiency-scorecard.md | System efficiency scorecard with metrics | measurement, efficiency |
| system-efficiency | final-metrics-report.md | Final metrics report for system efficiency project | measurement, efficiency |
| system-efficiency | error-recovery-audit.md | Error recovery audit for agent workflows | audit, reliability |
| system-efficiency | agent-utilization-report.md | Agent utilization and workload report | measurement, utilization |
| system-efficiency | cross-agent-collaboration-proposal.md | Original proposal for cross-agent collaboration | design, collaboration |
| skill-workflow-audit | skill-usage.md | Audit of which skills are actually used by agents | audit, skills, measurement |
| skill-workflow-audit | skill-usefulness-design.md | Metric design for skill usefulness-rate | design, metrics, skills |
| skill-workflow-audit | skill-usefulness-measurement.md | First-pass measurement of skill usefulness | measurement, skills |
| skill-workflow-audit | skill-usefulness-redesign.md | Redesign of usefulness-rate metric | design, metrics, skills |
| skill-workflow-audit | skill-verification.md | Skill verification report with pass/fail results | verification, skills |
| skill-workflow-audit | vbf-remeasure.md | Re-measurement of verify-before-finish effectiveness | measurement, vbf |
| skill-workflow-audit | verify-before-finish-strengthening.md | Plan to strengthen VBF skill adoption | design, vbf, skills |
| skill-workflow-audit | workflows-audit.md | Audit of workflow definitions and usage | audit, workflows |
| skill-workflow-audit | workflows-runtest.md | Test run results for workflow executions | testing, workflows |
| system-efficiency | daily-metrics-snapshot.md | Daily iteration metrics over project lifetime | measurement, metrics |
| system-efficiency | full-project-retrospective.md | Complete retrospective of system-efficiency project | retrospective, lessons |
| system-efficiency | latency-profile.md | Iteration latency profiling and bottleneck analysis | measurement, performance |
| system-efficiency | module-dependency-graph.md | Dependency graph of workflow toolkit modules | architecture, dependencies |
| system-efficiency | cross-agent-collaboration-kickoff.md | Kickoff record for cross-agent collaboration initiative | design, collaboration |
| system-efficiency | efficiency-v2-roadmap.md | Roadmap for resilience and performance improvements | roadmap, design |
| test-coverage | coverage-standards.md | Coverage thresholds and quality gates for test suites | testing, standards |
| workflow-reliability | workflow-guardrails-design.md | Design for workflow execution guardrails (milestone 2) | reliability, design |
| workflow-reliability | workflow-guardrails-v2-design.md | Revised guardrails design with context and improvements | reliability, design |
| workflow-reliability | v3-tracking-results.md | Results from v3 guardrails tracking period | reliability, measurement |
| workflow-reliability | replan.md | Replan document for workflow reliability improvements | reliability, planning |
| system-efficiency | master-worker-consolidation-rfc.md | RFC for consolidating master-worker variants | architecture, design |
| system-efficiency | m1-heartbeat-dedup.md | Implementation of heartbeat de-duplication | performance, implementation |
| system-efficiency | m2-circuit-breaker.md | Provider circuit breaker implementation | reliability, implementation |
| system-efficiency | m3-budget-checkpointing.md | Budget checkpointing implementation | reliability, implementation |
| system-efficiency | consolidation-migration-guide.md | Migration guide for master-worker consolidation | architecture, guide |
| system-efficiency | phase3-retrospective.md | Phase 3 retrospective with lessons learned | retrospective, lessons |
| system-efficiency | phase5-impact-report.md | Phase 5 impact measurements and results | measurement, impact |
| system-efficiency | new-project-proposals.md | Satellite project proposals from workflow source analysis | planning, proposals |
| system-efficiency | output-improvement-plan.md | Plan for improving project output quality | process, improvement |
| system-efficiency | phase4-metrics-baseline.md | Baseline metrics for phase 4 measurement | measurement, baseline |
| workflow-reliability | 7-Day Tracking Day 1 | `/app/agents/shared/projects/workflow-reliability/outputs/7-day-tracking-day1.md` | [metrics] [reliability] | Day 1 reliability rate measurements |
| workflow-reliability | Day 2 Rate Tracking | `/app/agents/shared/projects/workflow-reliability/outputs/day2-rate-tracking.md` | [metrics] [reliability] | Day 2 reliability rate measurements |
| workflow-reliability | Day 3 Rate Tracking | `/app/agents/shared/projects/workflow-reliability/outputs/day3-rate-tracking.md` | [metrics] [reliability] | Day 3 reliability rate measurements |
| workflow-reliability | Day 4 Rate Tracking | `/app/agents/shared/projects/workflow-reliability/outputs/day4-rate-tracking.md` | [metrics] [reliability] | Day 4 reliability rate measurements |
| workflow-reliability | Day 5 Rate Tracking | `/app/agents/shared/projects/workflow-reliability/outputs/day5-rate-tracking.md` | [metrics] [reliability] | Day 5 reliability rate measurements |
| workflow-reliability | Day 6 Rate Tracking | `/app/agents/shared/projects/workflow-reliability/outputs/day6-rate-tracking.md` | [metrics] [reliability] | Day 6 reliability rate measurements |
| workflow-reliability | Day 7 Rate Tracking | `/app/agents/shared/projects/workflow-reliability/outputs/day7-rate-tracking.md` | [metrics] [reliability] | Day 7 reliability rate measurements |
| workflow-reliability | V2 Guardrails Day 1 | `/app/agents/shared/projects/workflow-reliability/outputs/v2-guardrails-day1-tracking.md` | [metrics] [reliability] | V2 guardrails tracking day 1 results |
| workflow-reliability | V3 Guardrails Day 1 | `/app/agents/shared/projects/workflow-reliability/outputs/v3-guardrails-day1-tracking.md` | [metrics] [reliability] | V3 guardrails tracking day 1 results |
| system-efficiency | Final Summary | `/app/agents/shared/projects/system-efficiency/outputs/FINAL-SUMMARY.md` | [metrics] [efficiency] [closed] | Final project summary with all phase results |
| system-efficiency | Phase 2 Impact Report | `/app/agents/shared/projects/system-efficiency/outputs/phase2-impact-report.md` | [metrics] [efficiency] [closed] | Phase 2 impact measurements and analysis |
| system-efficiency | Phase 3 Results | `/app/agents/shared/projects/system-efficiency/outputs/phase3-results.md` | [metrics] [efficiency] [closed] | Phase 3 efficiency improvements |
| system-efficiency | Phase 4 Results | `/app/agents/shared/projects/system-efficiency/outputs/phase4-results.md` | [metrics] [efficiency] [closed] | Phase 4 efficiency improvements |
| system-efficiency | Phase 5 Retrospective | `/app/agents/shared/projects/system-efficiency/outputs/phase5-retrospective.md` | [metrics] [efficiency] [closed] | Phase 5 lessons learned |
| system-efficiency | Phase 5 Scorecard | `/app/agents/shared/projects/system-efficiency/outputs/phase5-scorecard.md` | [metrics] [efficiency] [closed] | Phase 5 scoring and evaluation |
| system-efficiency | Phase 6 Results | `/app/agents/shared/projects/system-efficiency/outputs/phase6-results.md` | [metrics] [efficiency] [closed] | Phase 6 efficiency results |
| system-efficiency | Phase 6 Test Baseline | `/app/agents/shared/projects/system-efficiency/outputs/phase6-test-baseline.md` | [metrics] [testing] [closed] | Test baseline measurements |
| system-efficiency | Phase 8 Results | `/app/agents/shared/projects/system-efficiency/outputs/phase8-results.md` | [metrics] [efficiency] [closed] | Phase 8 final results |
| system-efficiency | Production Readiness Checklist | `/app/agents/shared/projects/system-efficiency/outputs/production-readiness-checklist.md` | [checklist] [efficiency] [closed] | Production readiness criteria |
| system-efficiency | Iteration Velocity Chart | `/app/agents/shared/projects/system-efficiency/outputs/iteration-velocity-chart.md` | [metrics] [velocity] [closed] | Iteration speed measurements over time |
| system-efficiency | Migration Adapter Summary | `/app/agents/shared/projects/system-efficiency/outputs/migration-adapter-summary.md` | [migration] [efficiency] [closed] | Migration adapter patterns and results |
| system-efficiency | New Gym Scenarios | `/app/agents/shared/projects/system-efficiency/outputs/new-gym-scenarios.md` | [testing] [gym] [closed] | New gym test scenarios |
| system-efficiency | Cross-Agent Collaboration Project | `/app/agents/shared/projects/system-efficiency/outputs/cross-agent-collaboration-project.md` | [collaboration] [closed] | Cross-agent collaboration proposal |
| system-efficiency | Deprecation Summary | `/app/agents/shared/projects/system-efficiency/outputs/deprecation-summary.md` | [deprecation] [closed] | Deprecated features summary |
| system-efficiency | Project Closure Report | `/app/agents/shared/projects/system-efficiency/outputs/project-closure-report.md` | [closure] [closed] | Final project closure documentation |
| system-efficiency | Deliverables Checklist | `/app/agents/shared/projects/system-efficiency/outputs/DELIVERABLES_CHECKLIST.md` | [checklist] [closed] | Complete deliverables tracking |
| system-efficiency | Project Closed Notice | `/app/agents/shared/projects/system-efficiency/outputs/PROJECT-CLOSED.md` | [closure] [closed] | Project closure notice |
| system-efficiency | Stop Dispatching | `/app/agents/shared/projects/system-efficiency/outputs/STOP-DISPATCHING.md` | [closure] [closed] | Do not dispatch notice |
| system-efficiency | Project Close Criteria | `/app/agents/shared/projects/system-efficiency/outputs/project-close-criteria.md` | [closure] [closed] | Closure criteria definition |
| system-efficiency | Iteration 44 Report | `/app/agents/shared/projects/system-efficiency/outputs/iteration-44-report.md` | [metrics] [closed] | Final iteration report |
| system-efficiency | Phase 3 Plan | `/app/agents/shared/projects/system-efficiency/outputs/phase3-plan.md` | [planning] [closed] | Phase 3 planning document |
| system-efficiency | Phase 4 Completion | `/app/agents/shared/projects/system-efficiency/outputs/phase4-completion.md` | [closure] [closed] | Phase 4 completion evidence |
| system-efficiency | New Scenarios Validation | `/app/agents/shared/projects/system-efficiency/outputs/new-scenarios-validation.md` | [testing] [validation] [closed] | Scenario validation results |
| system-efficiency | Project Closure Final | `/app/agents/shared/projects/system-efficiency/outputs/project-closure-final.md` | [closure] [closed] | Final closure document |
| system-efficiency | Project Closure Notice | `/app/agents/shared/projects/system-efficiency/outputs/project-closure-notice.md` | [closure] [closed] | Closure notification |
| system-efficiency | Project Closure | `/app/agents/shared/projects/system-efficiency/outputs/project-closure.md` | [closure] [closed] | Project closure summary |
| system-efficiency | Project Completion Evidence | `/app/agents/shared/projects/system-efficiency/outputs/project-completion-evidence.md` | [closure] [closed] | Completion evidence |
| system-efficiency | Project Closed (dup) | `/app/agents/shared/projects/system-efficiency/outputs/project-closed.md` | [closure] [closed] | Project closed notice (duplicate) |
| system-efficiency | PROJECT_CLOSED | `/app/agents/shared/projects/system-efficiency/outputs/PROJECT_CLOSED.md` | [closed] | Archived system-efficiency output |
| system-efficiency | project-completion-summary | `/app/agents/shared/projects/system-efficiency/outputs/project-completion-summary.md` | [closed] | Archived system-efficiency output |
| system-efficiency | project-final-summary | `/app/agents/shared/projects/system-efficiency/outputs/project-final-summary.md` | [closed] | Archived system-efficiency output |
| system-efficiency | prompt-trim-report | `/app/agents/shared/projects/system-efficiency/outputs/prompt-trim-report.md` | [closed] | Archived system-efficiency output |
| system-efficiency | satellite-audit | `/app/agents/shared/projects/system-efficiency/outputs/satellite-audit.md` | [closed] | Archived system-efficiency output |
| system-efficiency | satellite-closure-report | `/app/agents/shared/projects/system-efficiency/outputs/satellite-closure-report.md` | [closed] | Archived system-efficiency output |
| system-efficiency | scenario-dedup-analysis | `/app/agents/shared/projects/system-efficiency/outputs/scenario-dedup-analysis.md` | [closed] | Archived system-efficiency output |
| system-efficiency | scenario-rotation-report | `/app/agents/shared/projects/system-efficiency/outputs/scenario-rotation-report.md` | [closed] | Archived system-efficiency output |
| system-efficiency | shared-rules-adoption-plan | `/app/agents/shared/projects/system-efficiency/outputs/shared-rules-adoption-plan.md` | [closed] | Archived system-efficiency output |
| system-efficiency | stale-dispatch-audit | `/app/agents/shared/projects/system-efficiency/outputs/stale-dispatch-audit.md` | [closed] | Archived system-efficiency output |
| system-efficiency | stale-projects-report | `/app/agents/shared/projects/system-efficiency/outputs/stale-projects-report.md` | [closed] | Archived system-efficiency output |
| system-efficiency | status-check-iter6 | `/app/agents/shared/projects/system-efficiency/outputs/status-check-iter6.md` | [closed] | Archived system-efficiency output |
| system-efficiency | system-bottleneck-analysis | `/app/agents/shared/projects/system-efficiency/outputs/system-bottleneck-analysis.md` | [closed] | Archived system-efficiency output |
| system-efficiency | system-efficiency-final | `/app/agents/shared/projects/system-efficiency/outputs/system-efficiency-final.md` | [closed] | Archived system-efficiency output |
| system-efficiency | system-health-dashboard | `/app/agents/shared/projects/system-efficiency/outputs/system-health-dashboard.md` | [closed] | Archived system-efficiency output |
| system-efficiency | system-output-audit | `/app/agents/shared/projects/system-efficiency/outputs/system-output-audit.md` | [closed] | Archived system-efficiency output |
| system-efficiency | test-coverage-iteration13 | `/app/agents/shared/projects/system-efficiency/outputs/test-coverage-iteration13.md` | [closed] | Archived system-efficiency output |
| system-efficiency | test-fix-progress | `/app/agents/shared/projects/system-efficiency/outputs/test-fix-progress.md` | [closed] | Archived system-efficiency output |
| system-efficiency | test-fix-report | `/app/agents/shared/projects/system-efficiency/outputs/test-fix-report.md` | [closed] | Archived system-efficiency output |
| system-efficiency | test-suite-baseline-phase5 | `/app/agents/shared/projects/system-efficiency/outputs/test-suite-baseline-phase5.md` | [closed] | Archived system-efficiency output |
| system-efficiency | token-savings-estimate | `/app/agents/shared/projects/system-efficiency/outputs/token-savings-estimate.md` | [closed] | Archived system-efficiency output |
| system-efficiency | vitest-cleanup-report | `/app/agents/shared/projects/system-efficiency/outputs/vitest-cleanup-report.md` | [closed] | Archived system-efficiency output |
| system-efficiency | vitest-gym-exclusion-fix | `/app/agents/shared/projects/system-efficiency/outputs/vitest-gym-exclusion-fix.md` | [closed] | Archived system-efficiency output |
| system-efficiency | weekly-health-dashboard | `/app/agents/shared/projects/system-efficiency/outputs/weekly-health-dashboard.md` | [closed] | Archived system-efficiency output |
| system-efficiency | workflow-cookbook | `/app/agents/shared/projects/system-efficiency/outputs/workflow-cookbook.md` | [closed] | Archived system-efficiency output |
| system-efficiency | workflow-dep-graph | `/app/agents/shared/projects/system-efficiency/outputs/workflow-dep-graph.md` | [closed] | Archived system-efficiency output |
| system-efficiency | workflow-latency-profile | `/app/agents/shared/projects/system-efficiency/outputs/workflow-latency-profile.md` | [closed] | Archived system-efficiency output |
