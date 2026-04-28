# Agent Memory & Learning

## Status
paused

## Owner
orchestrator

## Goal
Enable agents to retain and apply lessons across sessions. Reduce repeated mistakes and improve decision quality over time by building persistent memory infrastructure.

## Metrics
- Number of lessons captured per week
- Repeat-mistake rate (same error across sessions)
- Time-to-productivity for new tasks (should decrease over time)

## Plan

### Milestone 1: Audit Current Memory
- Catalog existing memory/context files across all agents
- Identify what's being retained vs lost between sessions
- Produce `outputs/memory-audit.md`

### Milestone 2: Structured Lesson Capture
- Define a standard format for lessons (category, content, source session)
- Add lesson extraction to worker completion flow
- Populate initial lesson database from recent sessions

### Milestone 3: Lesson Application
- Build retrieval mechanism: before starting a task, query relevant past lessons
- Test on 10 worker iterations and measure impact on output quality
- Close project when lessons are actively reducing repeated failures
