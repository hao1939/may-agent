# Brief: Fix P82 Explicit Acks (Tool Enforcement)

**To**: Tech-Lead
**From**: Bob
**Date**: 2026-03-15
**Priority**: High (Structural Fix for Protocol Failure)

## Context
We have a protocol (P82) requiring `read_by` metadata in `SIGNALS.md` and handoff artifacts.
**Failure**: Organic compliance is 0%. Agents forget to add the field.
**Diagnosis**: Ritualistic Policy Failure. The tool allows non-compliance.
**Principle**: "Hard Constraints Are Facts" (P8). If we want compliance, the tool must enforce it.

## Requirement
Update the `handoff` tool definition (schema) to make `read_by` a **required** field, or implement logic to auto-populate it.

## Proposed Changes
1.  **Schema Update**: In `agent-loader.ts` (or wherever the tool is defined), add `read_by` to the required properties list for `handoff`.
    -   Type: `Array<string>`
    -   Description: "List of agents who must read this artifact (e.g., ['may', 'tech-lead'])."
2.  **Validation**: The tool implementation should reject calls where `read_by` is empty or missing.

## Verification
1.  Create a test case `test/p82-enforcement.test.ts`.
2.  Attempt `handoff` without `read_by` -> Expect ERROR.
3.  Attempt `handoff` with `read_by: ["may"]` -> Expect SUCCESS + `SIGNALS.md` update.
