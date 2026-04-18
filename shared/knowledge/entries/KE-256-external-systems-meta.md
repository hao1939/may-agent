# KE-256: External System Patterns — 3/4 Failed Testing; Only Structural Interventions Transfer

**Date**: 2026-04-18
**Source**: EXP-180/181 (dead ends), EXP-182 (fragility), EXP-183 (dreaming), prescreen retrospective
**Confidence**: High
**Connects**: KE-021 (process > knowledge > judgment), KE-002 (text rules 0%), KE-007 (workflow enforcement only reliable method), KE-123 (stacking degrades)

## Core Finding

We tested 4 patterns from external agent systems (EvoHarness, OpenClaw). 3 behavioral/knowledge interventions failed with 0pp improvement across 60 trials. The only success was a structural process change (prescreen gate, 100% accuracy on 19 retrospective arms). This reinforces KE-021's hierarchy: process changes > knowledge injection > behavioral nudges.

## Evidence

| Pattern | Type | Source | Trials | Result |
|---------|------|--------|--------|--------|
| Dead ends memory | Knowledge injection | EvoHarness | 30 | 0pp (FAIL) |
| Fragility tracking | Knowledge injection | EvoHarness | 15 | 0pp (FAIL) |
| Dreaming/consolidation | Behavioral/process | OpenClaw | 15 | 0pp (FAIL) |
| Prescreen gate | Structural process | EvoHarness | 19 arms retro | 100% accuracy (PASS) |

- Dead ends as general advice = no effect, consistent with KE-002 (text rules don't work)
- Fragility ratings injected into context = ignored, consistent with KE-011 (knowledge files are passive)
- Dreaming/consolidation = no improvement over existing heartbeat pattern
- Prescreen gate = structural change to experiment workflow, no behavioral component → works

## Mechanism / Why

Behavioral and knowledge interventions fail because they require the agent to *choose* to use them at the right moment. The agent's decision-making during complex tasks doesn't reliably incorporate injected advice. Structural interventions work because they change the *process itself* — the agent can't skip them.

This is the same mechanism behind KE-002 (text rules 0%) and KE-007 (only workflow enforcement works). External systems face the same constraint: EvoHarness's dead_ends.md works there because the *system loop* forces re-reading it each iteration, not because the agent voluntarily consults it.

## Implications

### 1. Don't cargo-cult behavioral patterns from other systems
Patterns that work in System X often work because of X's structural loop, not because the pattern content is inherently useful. Always test before adopting.

### 2. When scouting external systems, prioritize process/structural patterns
Skip behavioral nudges and knowledge injection patterns — they have a ~0% transfer rate in our system. Focus on workflow changes, gating mechanisms, and structural process modifications.

### 3. The intervention hierarchy is robust across sources
Internal experiments (KE-002, KE-007) and external system patterns both confirm: structural > knowledge > behavioral. This is likely a general property of LLM agents, not specific to our system.

## Actionable

- When evaluating external patterns, classify as structural vs behavioral FIRST — only test structural ones
- Prescreen gate adopted: use 3-trial prescreen before full gym batches
- Skip remaining low-impact patterns (#5-7) from the learn-from-existing-systems project
- Update scout guidance: prioritize process/workflow patterns over behavioral ones

## Open Questions

- Would dead-ends work if delivered as *specific experience replay* (like EvoHarness's actual loop) rather than general advice?
- Are there hybrid patterns (structural delivery of behavioral content) that could work?
