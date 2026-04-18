# KE-246: External Agent Systems Validate Our Architecture, Reveal Testable Improvements

**Date**: 2026-04-18
**Source**: DD-769
**Confidence**: Medium-High
**Connects**: KE-011, KE-091, H-087

## Core Finding

Survey of Claude Skills and Hermes Function-Calling reveals our system already implements the most advanced patterns (cross-agent memory, adversarial verification, behavioral experiments) while missing simpler wins from these systems: progressive skill disclosure, schema enforcement for tool outputs, and directory-based skill packaging.

## Evidence

- Claude Skills uses 3-tier progressive disclosure: metadata index → SKILL.md → linked resources. Our system loads full skill files into context immediately.
- Hermes FC uses Pydantic + JSON schema validation for tool call correctness. We have no structural validation of tool outputs.
- Claude Skills packages skills as directories (instructions + scripts + resources). Ours are flat .md files.
- Neither system has cross-agent memory, adversarial verification, or experiment infrastructure — features we already have.

## Mechanism / Why

Progressive disclosure reduces context bloat by loading only what's needed. Schema enforcement catches malformed outputs structurally rather than relying on behavioral compliance. Directory packaging bundles procedural knowledge with its tools.

## Implications

### 1. Progressive disclosure could reduce FM-1.3 waste
Loading skill metadata first, full content on-demand, would reduce token usage in sessions that don't need certain skills.

### 2. Schema enforcement is a structural guard
Validates tool outputs without behavioral intervention — avoids the alignment tax (KE-091) that forced verification imposes.

## Actionable

- Design experiment testing progressive skill disclosure vs. current full-load approach
- Add JSON schema validation to finish() and other structured outputs
- Consider converting high-value skills to directory format with bundled scripts

## Open Questions

- Would progressive disclosure hurt performance on tasks that need multiple skills simultaneously?
- OpenClaw and Evo Harness were inaccessible — need Hao to provide access for complete survey
