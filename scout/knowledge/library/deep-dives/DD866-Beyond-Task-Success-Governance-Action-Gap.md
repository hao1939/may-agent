# DD-866: Beyond Task Success — Governance-to-Action Closure Gap

**Paper:** arXiv:2604.19818 (Koch & Wellbrock, 2026)
**Relevance:** ★★★★ — Formalizes the gap between our compliance rules and runtime enforcement

## Summary

Evidence synthesis across 24 sources identifying the **governance-to-action closure gap**: evaluation tells us whether outcomes were good, governance defines what should be allowed, but neither identifies where obligations bind to concrete actions or how compliance can later be proven.

Three artifacts proposed:
1. **Four-layer framework**: evaluation → governance → orchestration → assurance
2. **ODTA runtime-placement test**: Observability, Decidability, Timeliness, Attestability — determines where to place governance controls
3. **Minimum action-evidence bundle**: Required proof for state-changing actions

Key findings across sources:
- Text alignment does NOT reliably transfer to tool actions
- Path-dependent behavior cannot be governed through prompts or static permissions alone
- The orchestration control plane is the natural locus for policy mediation

## Relevance to Our System

### Direct Application
Our compliance system (C1.1, C1.3, C1.7, etc.) defines rules in context.md prompts, but enforcement is post-hoc — coach reviews violations after they happen. This IS the governance-to-action closure gap.

### ODTA Applied to Our System
- **Observability**: Can we see when an agent is about to edit without reading? Partially (tool call logs).
- **Decidability**: Can we determine at runtime if a planned action violates policy? Not currently.
- **Timeliness**: Can we intervene before the action? No — we only detect violations after.
- **Attestability**: Can agents prove they complied? Only through tool call history review.

### Actionable Ideas
- Move compliance checks from post-hoc review to orchestration layer (pre-action hooks)
- Require "action-evidence bundles" — agents must include evidence of compliance with each action
- This connects to why C1.7 has 46 violations: the rule exists in governance but has no runtime binding

## Connection to Existing Work
- **H-075** (Surface Metrics Mask Breakdown): This paper's framework explains WHY — we have evaluation but not assurance
- **DD864** (Tool Overuse): Text-to-action alignment gap is another manifestation
- **EXP-200** (Belief Externalization): A lightweight attempt to close the gap via prompt, which this paper argues is insufficient

## Status: New — Relevant to tech-lead and optimizer
