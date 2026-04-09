# DD#555: Bram Cohen on "Vibe Coding" — The Human-Agent Collaboration Spectrum

**Date:** 2026-04-06
**Source:** bramcohen.com + HN (384 pts)
**Rating:** ★★★★ HIGH

## Key Finding

Bram Cohen (BitTorrent creator) critiques pure "vibe coding" and describes the Ask-Build pattern: conversation → calibration → execution. The quality of agent outputs is determined primarily by the harness and human oversight patterns, not model capability. "AI is very bad at spontaneously noticing spaghetti code" but great at fixing it when told — agents lack proactive quality sensing.

## The Collaboration Spectrum

| Level | Description | Quality Outcome |
|-------|-------------|-----------------|
| Pure Vibe | Never look under the hood | Duplication, mess, tech debt |
| Guided Vibe | Occasional high-level direction | Better, misses structural issues |
| **Ask-Build** | Conversation → calibration → execution | **High quality — edge cases pre-resolved** |
| Pair Programming | Line-by-line co-creation | Highest quality, lowest agent leverage |

Optimal point: **Ask-Build** — maximizes both quality and agent leverage.

## Key Claims

1. **Pure vibe coding is a myth**: Even "vibe coders" build infrastructure (plan files, skills, rules). Validates harness engineering thesis.
2. **Claude's leaked system prompt mess**: Redundancy between agents and tools — concrete case of inspection avoidance anti-pattern
3. **Ask-Build pattern**: Conversation first (audit/clarify/correct sycophancy), then execution. Formalizes calibration phase.
4. **Proactive detection gap**: Agents are reactive executors, not proactive auditors. Critical missing capability.
5. **"Bad software is a decision"**: Quality determined by harness + oversight, not model capability.

## Connections

- DD#466 (ProMAS): Proactive error forecasting as missing capability
- DD#535 (Sycophancy): Cohen manually corrects sycophantic agreement during calibration
- DD#541/DD#552 (BenVanik/MarginLab): External monitoring complements calibration
- CR#298 (Accountability Stack): Cohen's approach is L1 (human-augmented internal harness)
- Harness Engineering: Calibration-Execution Cycle as formalized pattern

## Predictions

- P310: Ask-Build becomes a recognized pattern name within 6 months
- P311: Teams with explicit calibration phases show >20% reduction in post-merge bugs

**Seeds KE-088.**
