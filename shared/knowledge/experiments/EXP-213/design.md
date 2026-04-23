# EXP-213: Schema-Organized Context for Bob and Optimizer

**Date**: 2026-04-23
**Status**: DESIGNED
**Predecessor**: EXP-212 (confirmed: schema-organized context reduced tech-lead C1.1 by 54%, git confusion by 50%, npx misuse by 63%)

## Research Question

Does applying EXP-212's activation-based schema organization to bob's and optimizer's context.md reduce their C1.1/C1.3 violation rates by ≥30%?

## Background

Bob and optimizer are the highest-volume agents with the most C1.1/C1.3 violations (7-day data):
- bob: 58/421 C1.1 fails (13.8%), 57/421 C1.3 fails (13.5%)
- optimizer: 47/419 C1.1 fails (11.2%)

Both have flat-list context files. EXP-212 proved schema organization works for tech-lead. This is a replication + extension.

## Design

**Intervention**: Reorganize bob's context.md from flat list to activation-based sections:
- `## [SESSION START]` — environment facts, paths, tools
- `## [BEFORE EDITING]` — C1.1 read-before-edit, verification
- `## [AFTER WRITING]` — C1.3 verify-after-write
- `## [BEFORE FINISHING]` — C1.7 verification step
- `## [RESEARCH WORKFLOW]` — KB paths, scripts, templates
- `## [GENERAL KNOWLEDGE]` — operational knowledge, experiments

Same content, zero new facts. Only structural reorganization matching activation context.

**Measurement**: 
- Baseline: C1.1/C1.3 violation rates from last 20 bob sessions pre-deployment
- Treatment: C1.1/C1.3 violation rates from first 20 bob sessions post-deployment
- Success: ≥30% reduction in either C1.1 or C1.3 violation rate

**Rollout**: Bob first, then optimizer if confirmed.

## Risks
- Low: same intervention proven on tech-lead
- Bob's context has more research-specific content than tech-lead's — may need different section names
