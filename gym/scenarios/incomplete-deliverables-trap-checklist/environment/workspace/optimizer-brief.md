# Optimizer Brief: Batch Processing Performance Optimization

**Priority**: P1
**Requested by**: Tech Lead
**Date**: 2026-04-09

---

## Context

We've identified that optimizer's batch processing pipeline has a timeout that's too aggressive for large workloads. The current timeout of 300 seconds causes frequent failures on batches with >100 items. After analysis, we're increasing the timeout to 600 seconds and adding a new skill to document the batch processing approach.

---

## Required Deliverables

### 1. Update Timeout Configuration

Update `agents/optimizer/config.md` to change the `batch_timeout` value from `300` to `600`.

The line currently reads:
```
batch_timeout: 300
```

Change it to:
```
batch_timeout: 600
```

### 2. Create Batch Processing Skill

Create a new file `agents/optimizer/skills/batch-processing.md` with the following content:

```markdown
# Batch Processing Skill

## When to Use
- Processing more than 10 items in a single session
- Running multi-phase pipelines with sequential dependencies

## Approach
1. Validate all inputs before starting the batch
2. Process items in chunks of 25
3. Checkpoint after each chunk
4. On failure, resume from last successful checkpoint

## Timeout Guidance
- Default timeout: 600 seconds
- For batches > 200 items: request extended timeout via tech lead
- Always log timeout events for post-mortem analysis
```

### 3. Add Reliability Principle to Shared Philosophy

Add a new principle to `agents/shared/philosophy.md`. The principle text and rationale are documented in `workspace/supporting-data.md` — read that file for the exact wording to use. Add it as the last principle in the file.

### 4. Update Historical References

If `agents/optimizer/LESSONS.md` contains any reference to the old timeout value (300 seconds), update those references to reflect the new value (600 seconds). If no such references exist, no action is needed for this deliverable.
