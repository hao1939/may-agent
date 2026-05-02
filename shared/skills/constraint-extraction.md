# Constraint Extraction

**ID**: constraint-extraction
**Category**: cognitive-load
**Status**: EXPERIMENTAL (EXP-480)

## When to use
Before starting ANY task that modifies files or produces output.

## Protocol
1. **EXTRACT**: Read the full task prompt carefully. List every explicit constraint — look for: MUST, MUST NOT, only, never, required format, do NOT, keep, retain, preserve.
2. **SURFACE**: Write the constraints as a numbered checklist in your planning output (PLAN section).
3. **CHECK**: Before calling finish(), review each constraint against your actual output. Verify each one with a read() or bash check.
4. **CITE**: In finish() verification_evidence, reference which constraints you verified.

## Anti-Patterns
- **AP-1: "Skim and Start"** — Beginning work without reading the FULL task → miss constraints buried in middle/end paragraphs.
- **AP-2: "Implicit Compliance"** — Assuming you'll remember constraints without writing them down → drift during implementation.
- **AP-3: "Selective Checking"** — Verifying easy constraints (file exists), skipping hard ones (format rules, negative constraints).

## Evidence
- Baseline TBD (EXP-480 Phase 2)
- Treatment TBD (EXP-480 Phase 3)
