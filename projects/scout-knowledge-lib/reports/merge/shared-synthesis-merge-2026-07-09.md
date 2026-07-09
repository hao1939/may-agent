# Shared Synthesis Merge Batch

Date: 2026-07-09

Source directory: `/app/shared/knowledge/synthesis/`

## Result

The shared synthesis directory has been merged into Scout as a compact batch
record. The old files were mostly working syntheses from the agent-improvement
research period. Their durable content belongs in Scout as topic-level
knowledge, not as 28 separate shared files.

## Merged Themes

### Agent Behavior Change

Source files:

- `WKWA-001-behavioral-intervention.md`
- `WKWA-006-fewshot-skill-delivery.md`
- `WKWA-007-intervention-architecture.md`
- `WKWA-008-channel-theory-discovery-boundary.md`
- `WKWA-009-behavioral-internalization-illusion.md`
- `behavior-change-mechanisms.md`
- `ARCHIVE-KE066-collision-reasoning-behavior-gap-synthesis.md`

Merged knowledge:

- Text rules and negative examples do not reliably change judgment behavior.
- Structural interventions work when they change the action path, not just the
  wording around the action.
- Domain-matched few-shot examples are the lightweight middle path between
  passive text rules and hard workflows.
- Delivery channel matters: task-message examples, forced externalization, and
  workflow gates behave differently.
- Apparent guard learning is usually workflow substitution, not model-level
  internalization.
- Correct reasoning can still fail to become correct behavior; the fix must
  operate on the action path.

Scout destinations:

- `knowledge/agent-architectures.md`
- `knowledge/agent-runtime-hardening.md`
- `knowledge/agent-evaluation.md`
- `knowledge/the-subtraction-deficit.md`
- future focused note if the behavior-change material needs its own canonical
  page.

### Decision Topology And Workflow Fit

Source files:

- `WKWA-002-decision-topology.md`
- `SPRINT-SUMMARY-2026-04-research.md`
- `GYM-GRADUATION-REVIEW.md`
- `gym-failure-remediation-strategy.md`
- `DEPLOYMENT-PLAN-gym-remediation.md`

Merged knowledge:

- Workflow value depends on how many decisions can be eliminated safely.
- Strict workflows help mechanical or high-R tasks; they can hurt creative
  exploration.
- Gym remediation work shifted from exploration to maintenance once the known
  failures mapped to known mechanisms.
- The useful residue is the diagnostic pattern, not the old sprint files.

Scout destinations:

- `knowledge/agent-evaluation.md`
- `knowledge/agent-evaluation-research.md`
- `knowledge/agent-runtime-hardening.md`

### Memory, Capability Delivery, And Knowledge Use

Source files:

- `WKWA-003-self-improvement-limits.md`
- `WKWA-004-memory-control-loop.md`
- `WKWA-005-capability-delivery.md`
- `ANALYSIS-skill-utilization-deep-dive.md`
- `PROPOSAL-knowledge-consumability.md`
- `IDEAS-amy-knowledge-consumability.md`
- `IDEAS-coach-knowledge-consumability.md`
- `IDEAS-optimizer-knowledge-consumability.md`
- `IDEAS-tech-lead-knowledge-consumability.md`
- `DESIGN-heartbeat-knowledge-injection.md`
- `DESIGN-what-changed-briefing.md`
- `DRAFT-action-triggered-reminders.md`
- `DRAFT-universal-context-entries.md`
- `ROUTING-TABLE.md`
- `CONVENTION-query-compounding.md`

Merged knowledge:

- Agents do not reliably discover passive resources; capability delivery must
  be pushed into the active task path.
- Self-improvement tends to add, not prune. Cleanup needs external state and
  explicit deletion paths.
- Memory systems need write gates, routing, role delivery, and forgetting.
- Knowledge utilization is a delivery problem, not only an indexing problem.
- Query compounding is useful only when it routes findings into durable topic
  homes instead of creating more loose notes.

Scout destinations:

- `knowledge/agent-context-osmosis.md`
- `knowledge/agent-architectures.md`
- `knowledge/hn-agent-operational-memory.md`
- `knowledge/the-knowledge-asymmetry.md`
- `knowledge/the-subtraction-deficit.md`

### Tools, Scripts, And Runtime Support

Source files:

- `ANALYSIS-tools-vs-scripts.md`

Merged knowledge:

- Agents already rely heavily on shell/script execution; reusable scripts matter
  when they remove repeated mechanical decisions.
- Tooling should be judged by whether it enters the active workflow, not whether
  it exists somewhere in the filesystem.

Scout destinations:

- `knowledge/agent-runtime-hardening.md`
- `knowledge/agent-architectures.md`

## Removed Source Files

The old shared synthesis files are safe to remove after this batch because:

- their durable themes are represented above;
- the Scout index now points to this merge record;
- the remaining references are updated to this Scout-owned report or to generic
  Scout synthesis locations.

This batch does not close the whole shared-knowledge merge. It only removes the
first small shared directory.
