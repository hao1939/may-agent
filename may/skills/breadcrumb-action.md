# Skill: Act on Red Metrics Before Other Work

## The Problem
When your heartbeat prompt shows metrics with "⚠️ BELOW TARGET", you often skip investigating them and jump to project work or inbox processing. This leaves red metrics unaddressed.

## The Rule
**Red metrics come FIRST in your heartbeat — before projects, before inbox, before anything else.**

## Required Steps When You See BELOW TARGET

1. **Run the diagnostic command** shown next to the metric (if provided)
2. **State what you found** — even if it's "metric is improving, no action needed"
3. **Take action OR explicitly defer** — fork work, nudge an owner, or state why you're deferring

## What Counts as Action

- Running the suggested diagnostic command and noting the result
- Forking work to address the root cause
- Nudging the metric owner
- Stating "Metric X deferred because [concrete reason]"

## What Does NOT Count

- Ignoring the metrics section entirely
- Saying "system looks healthy" without addressing specific red metrics
- Moving straight to projects/inbox

## In Your finish() Summary

Always mention what you did about red metrics. Example:
> "Investigated handler.fires-per-hour (12 vs target 30) — ramping up naturally after restart, no action needed."
