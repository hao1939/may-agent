# EXP Proposal: In-Context Self-Orchestration vs Multi-Phase Workflows

**Date**: 2025-05-03 | **Author**: Bob | **Status**: PROPOSED
**Source**: Scout finding `agents/scout/workspace/findings/in_context_vs_orchestration.md`

## Hypothesis

**H-XXX**: For procedural agent tasks (gym scenarios, file processing, analysis), replacing multi-phase orchestrated workflows with a single comprehensive prompt will reduce token waste by ≥20% while maintaining quality scores within 0.5 points.

## Background

Recent research ("In-Context Prompting Obsoletes Agent Orchestration for Procedural Tasks") shows that for procedural tasks, rich system prompts outperform external orchestration frameworks. Our system currently uses:

- **3-phase worker sessions**: Phase 1 (Analyze, 15 calls) → Phase 2 (Write, 25 calls) → Phase 3 (Verify)
- **Persistent-task workflow**: orchestrator → reviewer → worker iterations
- **Master-worker delegation**: may dispatches focused sub-tasks to workers

**Problem signal**: Many sessions are interrupted mid-phase, lose context between phases, or waste calls on phase transitions. The system_status shows 100+ interrupted sessions in the last 6 hours — many are multi-phase workers that never reached Phase 3.

## Experimental Design

### Arms
| Arm | Description |
|-----|-------------|
| **Control** | Current 3-phase worker prompt (Phase 1→2→3 with budgets) |
| **Treatment** | Single unified prompt: "Here's your task, tools, and success criteria. Complete it." No phase gates. |

### Metrics
1. **Primary**: Task completion rate (done vs interrupted)
2. **Primary**: Token efficiency (output files per tool call)
3. **Secondary**: Quality score from evaluator (if available)
4. **Secondary**: Time to first deliverable (tool call # when first file is written)

### Scenario
Use gym scenarios that are procedural:
- `cascading-fix-trap-v2-investigate` (fix failing tests)
- `knowledge-base-navigation` (find and synthesize info)

### Sample Size
10 trials per arm per scenario = 40 total trials

### Decision Rules
- If Treatment completion rate ≥ Control + 15pp AND quality within 0.5: **ADOPT**
- If Treatment completion rate < Control - 10pp: **REJECT**
- Otherwise: **INCONCLUSIVE**, need more data

## Connection to Existing Knowledge

- **KE-123**: Never stack interventions → test one change at a time ✓
- **KE-133**: Few-shot harms discovery → treatment arm uses zero-shot ✓
- **Zombie task analysis** (2025-05-03): Multi-phase sessions interrupted repeatedly may be a symptom of over-orchestration
- **EXP-600**: Bash waste reduction was NEGATIVE — skill-based interventions don't change efficiency. Structural changes (like removing phase gates) might.

## Risk

Low. If treatment performs worse, we keep current system. The gym isolates production impact.

## Prerequisites
- Gym operational with `--timeout 600`
- Coach available to run trials
- Evaluator available to score outputs

## Next Steps
1. Get this proposal reviewed (tech-lead or may)
2. Assign experiment number
3. Write treatment prompt variant
4. Schedule gym runs
