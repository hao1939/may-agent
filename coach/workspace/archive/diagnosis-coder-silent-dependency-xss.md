# Diagnosis: Coder Silent-Dependency XSS Incomplete Fix

**Date**: 2026-03-30
**Error Pattern**: FM-3.3 (incomplete fix) — partial sanitization
**Agent**: coder
**Scenario**: silent-dependency (baseline 4/5, workflow 4/5)

## Error Pattern

The coder correctly identifies that `marked` 4.3.0's `sanitize: true` option
is deprecated/nonfunctional, and applies a fix for `<script>` tag XSS. However,
the coder consistently fails to handle **event handler XSS** (`<img onerror=...>`),
resulting in the `xss-onerror-sanitized` check failing.

This is a **knowledge/completeness gap**, not a judgment failure. The coder
knows XSS sanitization is needed but doesn't enumerate all XSS vectors. It
fixes the most obvious one (script tags) and stops.

## What Was Already Tried

- **exp-070 (baseline)**: 4/5 — `xss-onerror-sanitized` FAILED. Script tags
  sanitized but onerror missed. Duration 61s.
- **exp-071 (Method #15 workflow)**: 4/5 — Two-phase analyze→fix approach.
  Different check distribution but still 4/5. The generic workflow task didn't
  guide the coder to check all XSS vectors.

## Root Cause Analysis

The current workflow task.md (silent-dependency-workflow) says:
- "Investigate the dependency configuration"
- "Does this version of marked actually support those options?"
- "Write your analysis to ANALYSIS.md"

This is **too generic**. The coder understands the `sanitize:true` deprecation
but doesn't connect it to needing comprehensive XSS coverage across ALL
vectors. A task that explicitly names the vectors (script tags, event handlers,
javascript: URIs) would guide the coder to implement a complete solution.

## Selected Method

**Method #14 (Task Structuring)** applied within #15 (Workflow Enforcement) framework.

Specifically: **Enhance the task.md to explicitly list XSS vectors that
comprehensive sanitization must cover.** This puts domain knowledge directly
into the task (Layer 2 authority — partial but measurable influence).

### Why This Method

1. **Context.md fact** — Wrong fit. This is domain knowledge about XSS, not
   environmental knowledge. A context.md entry about XSS vectors would be
   Layer 3 (no measurable influence).

2. **Workflow enforcement (#15)** — Already tried. The structure (analyze→fix)
   is correct but the task CONTENT is too vague. The coder follows the workflow
   but doesn't know to check all vectors.

3. **Task structuring (#14)** — Layer 2 authority. By making the task itself
   enumerate what "comprehensive sanitization" means (script tags, event
   handlers, javascript: URIs), the coder has the knowledge at the point of
   action. Combined with workflow enforcement for the analyze→fix structure.

4. **Skill file (#4)** — Proven ineffective (0/5 on EXP-215). Layer 4 content
   that coder doesn't read during oneshot tasks.

## What Specifically To Change

Create a new scenario variant `silent-dependency-xss-vectors` (or modify
`silent-dependency-workflow/task.md`) with explicit XSS vector enumeration:

Phase 1 (Analysis) should include:
- "Test EACH type of XSS vector against the current renderer:
  - `<script>` tags
  - Event handler attributes (`onerror`, `onload`, `onclick`, etc.)
  - `javascript:` protocol URLs
  - Document your findings for EACH vector type in ANALYSIS.md"

Phase 2 (Fix) should include:
- "Your fix must sanitize ALL XSS vectors you identified in Phase 1"
- "After fixing, verify EACH vector type is neutralized"

## Gym Scenarios to Test

1. **Target**: `silent-dependency` (or new variant `silent-dependency-xss-vectors`)
2. **Regression**: `phantom-fix`, `wrong-tool-args` (baseline-passing scenarios)

## Expected Outcome

The explicit vector enumeration in the task should guide the coder to
implement comprehensive sanitization (e.g., using a proper sanitizer library,
or regex-based stripping of all HTML event handlers — not just script tags).
Target: 5/5 on silent-dependency checks.
