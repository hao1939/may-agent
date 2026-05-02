# Cross-Project Reusable Assets Manifest
## File-Level Discovery Index

> **Purpose**: Help agents find specific reusable files across projects without browsing directories.  
> **Scope**: Top 5 most-populated projects, 3-5 highest-value files each.  
> **Updated**: 2026-07

---

### skill-workflow-audit

| File | Description | Tags |
|------|-------------|------|
| `outputs/skill-gap-inventory.md` | Inventory of agent skill gaps from 33 iterations and 60+ trials across 50 scenarios | skills, gaps, inventory |
| `outputs/skill-behavioral-audit.md` | Audit of whether agents actually act on injected skills (10 sessions scored) | skills, behavior, measurement |
| `outputs/skill-freshness-audit.md` | Staleness check of 185 skill files; methodology for freshness tracking | skills, freshness, audit |
| `outputs/workflow-reliability-baseline.md` | 14-day workflow reliability baseline measurements | workflow, reliability, baseline |
| `outputs/cycle2-skill-freshness-audit.md` | Second-cycle freshness re-audit with trend data | skills, freshness, trends |

---

### agent-memory-learning

| File | Description | Tags |
|------|-------------|------|
| `outputs/agent-memory-learning-lesson-retrieval-system.md` | Design for querying past lessons before tasks to reduce repeated mistakes | memory, retrieval, design |
| `outputs/agent-memory-lesson-database-v1.md` | First populated lesson DB drawn from 27+ iterations of system-efficiency work | memory, database, lessons |
| `outputs/agent-memory-learning-benchmarks.md` | Retrieval performance targets and benchmark methodology | memory, benchmarks, perf |
| `outputs/agent-memory-learning-memory-audit.md` | Audit of current memory state across agents | memory, audit |
| `outputs/structured-lesson-format.md` | Standard format specification for structured lessons | memory, format, standard |

---

### documentation-gen

| File | Description | Tags |
|------|-------------|------|
| `outputs/documentation-gen-architecture-guide.md` | Full architecture guide: agents, communication, workflows, coordination | architecture, docs, overview |
| `outputs/documentation-gen-doc-gen-script.md` | Script pipeline for auto-generating docs from code/configs/agent definitions | automation, pipeline, docs |
| `outputs/documentation-gen-workflow-docs.md` | Documentation of core workflows: master-worker, circuit-breaker, budget-checkpoint | workflows, docs, reference |
| `outputs/docs-inventory.md` | Documentation coverage inventory (12/12 agents at 100%) | inventory, coverage, docs |
| `outputs/agent-onboarding-guide.md` | Quick-start guide for new agents joining the system | onboarding, guide |

---

### workflow-reliability

| File | Description | Tags |
|------|-------------|------|
| `outputs/workflow-reliability-baseline.md` | 14-day reliability baseline with failure rate measurements | reliability, baseline, metrics |
| `outputs/workflow-guardrails-v3-design.md` | V3 guardrails design for workflow fault tolerance | guardrails, design, reliability |
| `outputs/retry-strategy.ts` | Reusable retry strategy implementation with backoff | retry, code, reusable |
| `outputs/error-boundary.ts` | Error boundary wrapper for workflow steps | errors, code, reusable |
| `outputs/provider-retry.ts` | Provider-level retry logic with circuit breaking | retry, provider, code |

---

### system-efficiency (archived — reference only)

| File | Description | Tags |
|------|-------------|------|
| `outputs/system-efficiency-retrospective.md` | Full retrospective of efficiency improvements achieved | retrospective, metrics |
| `outputs/efficiency-playbook.md` | Playbook of efficiency patterns applicable to other projects | efficiency, patterns, playbook |
| `outputs/system-throughput-baseline.md` | Throughput baseline measurements for the agent system | throughput, baseline |

---

## How to Use

```bash
# Find files by tag
grep "retry" cross-project-reusable-manifest.md

# Find all code assets
grep "\.ts" cross-project-reusable-manifest.md

# Find design docs
grep "design" cross-project-reusable-manifest.md
```

## Maintenance
- Re-run file discovery quarterly or when projects close
- Remove entries for deleted files
- Total rows kept under 50 for scannability (currently: 28)
