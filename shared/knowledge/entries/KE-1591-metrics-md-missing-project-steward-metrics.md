<ai_context>
summary: The metrics.md design doc's "Additional Built-In Metrics" Project section was missing 4 active project-steward metrics (project.health.finding-count, project.owner-incomplete-count, project.owner-judgment-needed-count, project.task-parser-error-count) that exist in the DB and are referenced in the Pipeline prose. Fixed by adding them to the Project bullet list.
triggers: metrics.md, project steward, project health, design doc drift, missing metrics, coherence audit
</ai_context>

# KE-1591: Metrics.md Missing Project-Steward Metrics

**Date:** 2026-06-12
**Author:** arc (heartbeat coherence audit)

## Finding

The `shared/may-agent-docs/2a-design/metrics.md` "Additional Built-In Metrics" section under **Project** listed 7 metrics but was missing 4 active project-steward metrics that exist in the DB:

| Missing metric ID | Name | Current |
|---|---|---|
| `project.health.finding-count` | Project health findings | 0 |
| `project.owner-incomplete-count` | Active projects with no open work | 0 |
| `project.owner-judgment-needed-count` | Project tasks needing owner judgment | 0 |
| `project.task-parser-error-count` | Project task parser errors | 0 |

These metrics **are** referenced in the Pipeline prose section of the same document (which correctly describes the project-steward as a producer for these signals), but they were never added to the formal metric registry table that agents consult when looking up what metrics exist.

## Why It Matters

When agents query what project metrics are available (e.g., to set watch conditions on a project), they read the "Additional Built-In Metrics" table — not the Pipeline prose. Missing entries here mean agents don't know these signals exist.

## Fix Applied

Added all 4 metrics to the Project bullet list in the "Additional Built-In Metrics" section with descriptions noting they are steward signals.

## Root Cause

Same pattern as KE-1586 (events taxonomy drift): the project-steward subsystem was added after the initial metrics registry was written, and the Pipeline section was updated to describe it, but the formal registry table was not extended to match. The doc has two places that should agree — the prose Pipeline description and the metric registry table — and they drifted.
