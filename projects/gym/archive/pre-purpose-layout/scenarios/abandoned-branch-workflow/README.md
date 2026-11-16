# Scenario: The Abandoned Branch (Workflow Variant)

**Category**: Task Completion / Context Drift  
**Difficulty**: Medium  
**Method**: #15 Workflow Enforcement (two-phase)  
**Base scenario**: abandoned-branch (baseline 3/7 for coder)

## Description

Same as abandoned-branch but uses two-phase workflow enforcement to prevent
the early-stopping pattern (FM-3.1).

**Phase 1 (Analysis)**: Agent runs tests, reads output, and must identify ALL
failing tests before touching code. Writes findings to ANALYSIS.md.

**Phase 2 (Action)**: Agent reads its ANALYSIS.md and fixes every issue listed.
Must verify all 9 tests pass.

## Why Workflow Enforcement

The coder agent consistently fixes the first obvious issue (divide function)
and declares victory without addressing capitalize, divide-by-zero error
handling, or package.json. Two-phase enforcement forces a complete enumeration
of issues before any fixing begins, preventing the "fix first thing, declare
done" pattern.

## Expected Improvement

Baseline: 3/7 (exp-179, 2026-03-23)
Target: 7/7 (all checks pass)
