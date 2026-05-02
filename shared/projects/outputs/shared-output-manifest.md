# Shared Output Manifest

> A discoverable index of all project deliverables across the agent system.
> Tags enable quick lookup. Check this manifest before starting new analysis.

## Index

| Project | Deliverable | Path | Tags | Description |
|---------|------------|------|------|-------------|
| system-efficiency | satellite-triage.md | /app/agents/shared/projects/outputs/satellite-triage.md | `[analysis]` `[projects]` | Ranked list of all satellite projects with gap analysis |
| system-efficiency | regression-guard-config.md | /app/agents/shared/projects/outputs/regression-guard-config.md | `[monitoring]` `[metrics]` | Alert thresholds for all 12 satellite metrics |
| system-efficiency | efficiency-playbook.md | /app/agents/shared/projects/outputs/efficiency-playbook.md | `[workflow]` `[patterns]` | Rules for orchestrators and workers to avoid no-op iterations |
| system-efficiency | system-efficiency-retrospective.md | /app/agents/shared/projects/system-efficiency/outputs/system-efficiency-retrospective.md | `[docs]` `[retrospective]` | Full project retrospective with timeline and lessons |
| system-efficiency | next-frontier-proposal.md | /app/agents/shared/projects/system-efficiency/outputs/next-frontier-proposal.md | `[planning]` `[proposals]` | Three proposals for next initiatives after satellite completion |
| cross-agent-collaboration | shared-output-manifest.md | /app/agents/shared/projects/cross-agent-collaboration/outputs/shared-output-manifest.md | `[discovery]` `[index]` | This file — the master index of all reusable outputs |
| test-coverage | coverage reports | /app/agents/shared/projects/test-coverage/outputs/ | `[testing]` `[quality]` | Test coverage analysis and improvement plans |
| prompt-efficiency | prompt analysis | /app/agents/shared/projects/prompt-efficiency/outputs/ | `[prompts]` `[optimization]` | Token usage analysis and compression strategies |
| coach-quality | coaching rubrics | /app/agents/shared/projects/coach-quality/outputs/ | `[coaching]` `[quality]` | Quality scoring rubrics for agent coaching |
| handler-reliability | error patterns | /app/agents/shared/projects/handler-reliability/outputs/ | `[reliability]` `[errors]` | Handler failure patterns and retry strategies |
| gym-quality-improvement | gym metrics | /app/agents/shared/projects/gym-quality-improvement/outputs/ | `[training]` `[quality]` | Gym exercise quality assessments |
| agent-convention-compliance | convention docs | /app/agents/shared/projects/agent-convention-compliance/outputs/ | `[conventions]` `[compliance]` | Agent convention adherence reports |

## Discovery Convention

### How to Query This Manifest

**By topic tag**: Search for bracket-enclosed tags to find relevant outputs.
```bash
grep -i "\[testing\]" shared-output-manifest.md
grep -i "\[workflow\]" shared-output-manifest.md
```

**By project**: Filter the table by project column.
```bash
grep "system-efficiency" shared-output-manifest.md
```

**By recency**: Files are listed roughly in creation order. Recent additions appear at the bottom of the index table.

### Agent Protocol

1. **Before starting analysis**: Check this manifest for existing work on the same topic. Grep for relevant tags.
2. **After producing output**: Add an entry to this manifest with path, tags, and one-line description.
3. **When consuming another agent's output**: Note the reuse in your session (drives the cross-agent-reuse-count metric).

### Tag Taxonomy

| Tag | Meaning |
|-----|---------|
| `[analysis]` | Data analysis, assessments, audits |
| `[monitoring]` | Alerting, thresholds, health checks |
| `[workflow]` | Process improvements, orchestration patterns |
| `[testing]` | Test coverage, test infrastructure |
| `[docs]` | Documentation, retrospectives |
| `[planning]` | Proposals, roadmaps, project plans |
| `[discovery]` | Indexing, search, cross-referencing |
| `[prompts]` | Prompt engineering, token optimization |
| `[quality]` | Quality metrics, scoring rubrics |
| `[reliability]` | Error handling, resilience, retries |
| `[conventions]` | Standards, compliance, patterns |
| `[training]` | Gym exercises, skill development |
| `[coaching]` | Agent coaching, feedback |

---
*Last updated: This session. Maintainer: optimizer agent.*
