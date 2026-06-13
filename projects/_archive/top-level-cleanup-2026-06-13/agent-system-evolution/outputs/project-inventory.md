# Learning/Evolution Project Inventory

Date: 2026-05-20 (inventory task)

## Decision Summary

Most learning/evolution projects are **closed or waiting** and should remain
independent lanes with cross-references from this umbrella. Evaluator
calibration projects with completed narrow deliverables have been merged into
the evaluator learning/calibration lane.

## Inventory

### Merged into agent-system-evolution

| Project | Former Owner | Status | Merged Lane |
|---------|--------------|--------|-------------|
| evaluator-false-good-calibration | evaluator | archived | `outputs/evaluator/false-good-calibration/` |
| evaluator-strategy-extractor-calibration | evaluator | archived | `outputs/evaluator/strategy-extractor/` |

### Referenced Live Lanes

| Project | Owner | Status | Relationship |
|---------|-------|--------|-------------|
| scout-second-brain-learning | scout | waiting | Child — agent learning behavior |
| ruflo-learning-loop | arc | paused | Child — external-methodology learning loop; keep independent until its falsifier trips |
| master-worker-context-sharing | master | closed | Split reference — behavior lessons here; transport/runtime work belongs to platform |
| eval-llm-lane-restoration | dev | closed | Reference — evaluation infra watched by system operations |
| system-operations | may | waiting | Reference — operational cadence and reliability watch, not evolution logic |
| closed-loop-reliability | may | closed | Historical reliability-watch project merged into system operations |

### Independent lanes (closed/done, no action needed)

| Project | Owner | Status | Reason independent |
|---------|-------|--------|-------------------|
| agent-memory-learning | coach | closed | Complete (14/14 items done) |
| agent-system-literacy | bob | closed | Skill training, not evolution |
| evaluator-low-quality-rate-calibration | evaluator | done | Completed metric split |
| evaluator-aftermath-null-trigger-loop | evaluator | done | Bug fix, not evolution |
| evaluation-revival | coach | closed | Pipeline restoration, done |
| coach-quality | coach | closed | Quality target met |
| cross-agent-collaboration | optimizer | closed | Infra complete, closed |

### Out of scope (not learning/evolution)

All other projects in `projects/` are domain-specific, platform infra, or
operational and do not belong under this umbrella.

## Decision Rules Applied

1. **Closed/done projects** → independent, no action. They're historical.
2. **Completed evaluator calibration projects** → merge into the evaluator learning/calibration lane with archive redirects.
3. **Waiting/paused projects with agent learning scope** → referenced as children in `project.md` Related Projects section.
4. **Platform, infra, or operational reliability projects** → out of scope per coupling contract.
5. **No ownership transfer for references** — child references don't change the project owner; they establish visibility for evolution planning.

## Recommended project.md Update

Completed: evaluator false-good and strategy-extractor calibration are now
merged lanes under `projects/agent-system-evolution/outputs/evaluator/`.
