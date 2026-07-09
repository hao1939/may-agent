# Shared Operations Small Directories Merge Batch

Date: 2026-07-09

Source scope:

- `/app/shared/knowledge/conventions/`
- `/app/shared/knowledge/designs/`
- `/app/shared/knowledge/incidents/`
- `/app/shared/knowledge/specs/`
- `/app/shared/knowledge/summaries/`
- `/app/shared/knowledge/views/`

## Result

These small shared directories are merged into Scout-owned reports and topic
notes. They should not remain as separate shared-library roots.

The batch contained 8 markdown files. Their durable knowledge is represented in
this report, the Scout index, and existing Scout notes about runtime hardening,
evaluation, and agent-system governance.

## Durable Knowledge

### Evidence Before Fixing Production Errors

Sources:

- `conventions/PROPOSAL-C13.1-evidence-required-fixes.md`
- `incidents/INC-001-maxturns-misdiagnosis.md`
- `incidents/PROTOCOL-diagnostic-before-fix.md`

Merged knowledge:

- Do not fix production errors from stale evidence. First prove the issue still
  occurs on the current binary.
- A valid production fix needs temporal evidence, intentionality review, and
  reproduction/current occurrence evidence.
- Old sessions can preserve failures from old binaries; treating those as live
  failures causes wrong fixes.
- Text checklists are weak. The durable fix is workflow or guard support that
  forces current-evidence collection before committing production fixes.

Scout homes:

- `knowledge/agent-runtime-hardening.md`
- `knowledge/agent-evaluation.md`
- `knowledge/hn-agent-operational-memory.md`

### Dispatch Deduplication

Source:

- `conventions/dispatch-dedup-protocol.md`

Merged knowledge:

- Before dispatching recurring work, check whether the target is already
  complete, stale, interrupted repeatedly, or has no new queue items.
- Dedup is a process-control mechanism: it prevents sessions from spending
  capacity on closed work.

Scout homes:

- `knowledge/agent-runtime-hardening.md`
- `knowledge/multi-agent-coordination.md`

### Guard Escape And Finish Safety

Source:

- `designs/guard-escalation-override.md`

Merged knowledge:

- Guards must not trap agents. `finish()` needs an escape path so an agent can
  report partial work instead of looping until timeout.
- Hard blocks should have override or downgrade behavior for repeated identical
  blocks, with an event/log trail for later review.

Scout homes:

- `knowledge/agent-runtime-hardening.md`
- `knowledge/agent-evaluation.md`

### Finish Guard Deployment

Source:

- `specs/EXP-188-finish-guard-deployment.md`

Merged knowledge:

- Finish validation is a runtime contract, not a prompt convention.
- The guard should validate persistent-task usage, deliverables, and evidence
  quality before accepting success.
- The preferred path is workflow/tool-level enforcement rather than another
  advisory instruction.

Scout homes:

- `knowledge/agent-runtime-hardening.md`
- `knowledge/agent-evaluation.md`

### KE Summary Injection

Source:

- `summaries/KE-SUMMARIES.md`

Merged knowledge:

- The KE one-liner format is useful when knowledge must enter the active task
  path. It is not a long-term library structure.
- The important rule is delivery, not the file: inject small, decision-relevant
  summaries where the agent is making the decision.
- Low-numbered KE summaries are now covered by the legacy KE merge batch and
  existing Scout topic notes.

Scout homes:

- `reports/merge/shared-ke-001-090-merge-2026-07-09.md`
- `knowledge/agent-runtime-hardening.md`
- `knowledge/the-knowledge-asymmetry.md`

### System Dysfunction Derived View

Source:

- `views/system-dysfunction-model.md`

Merged knowledge:

- A system can produce successful diagnostic artifacts while delivering no
  external value when the real actuator is blocked.
- Watchers that trigger action differ from monitors that generate more
  artifacts.
- The useful pattern is to identify the missing actuator and route work there,
  not to create more diagnosis.

Scout homes:

- `knowledge/the-knowledge-asymmetry.md`
- `knowledge/the-evaluation-mirage.md`
- `knowledge/agent-runtime-hardening.md`

## Removed Source Files

The source files are safe to remove after this batch because:

- their durable lessons are represented above;
- active Scout/Amy instructions no longer write durable work to shared paths;
- the only direct non-shared reference to the summary file was migrated to this
  report.

This batch deliberately keeps historical workspace logs unchanged. Those logs
record what happened at the time; they are not active library navigation.
