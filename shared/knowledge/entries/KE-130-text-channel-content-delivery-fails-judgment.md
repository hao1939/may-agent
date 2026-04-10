# KE-130: Text-Channel Content Delivery Fails for Contradiction Detection

**Status**: Active
**Source**: EXP-127 (Channel Separation Direct Test, N=24)
**Date**: 2026-04-10
**Confidence**: ★★★★ (High — 0/24 text-delivered runs succeeded)
**Extends**: KE-058 (injected knowledge has no effect), KE-007 (structural enforcement > text rules)

---

## Core Finding

A high-quality, domain-matched contradiction detection worked example was delivered through every available text channel — system prompt (Ch1), task message (Ch3), and both simultaneously (Ch1+Ch3). **Zero of 24 text-delivered runs produced the desired behavior.** The same scenario achieves 100% (10/10 cumulative) with a structural gate (Ch2) that does NOT include the worked example.

| Delivery Method | Content Present? | Structural Gate? | Result |
|----------------|:----------------:|:----------------:|--------|
| System prompt only (Ch1) | ✅ | ❌ | **0/6 (0%)** |
| Task message only (Ch3) | ✅ | ❌ | **0/6 (0%)** |
| Both Ch1 + Ch3 | ✅ ✅ | ❌ | **0/6 (0%)** |
| Baseline (no content) | ❌ | ❌ | **0/6 (0%)** |
| Forced externalization (Ch2) | ❌ | ✅ | **6/6 (100%)** |

**This confirms H-098's central claim**: Channel 2 works through **mechanism** (forcing the analysis step), not through **content** (providing examples or rules).

## What the Content Included

The `contradiction-detection.md` skill and few-shot example contained:
- Explicit instruction to identify contradictions before implementing
- A worked example of a physical impossibility in requirements (analogous to the test scenario)
- Clear guidance: "If you find contradictions, document them and propose alternatives"

The content was relevant, high-quality, and domain-matched. The agent simply ignored it.

## Why Content Delivery Fails

Evidence from run-level analysis:
1. **The agent reads the content** — skill text is in the system prompt, few-shot is in the task message. Both are tokenized and processed.
2. **The agent begins correctly** — it reads the task and code files
3. **"Action momentum" takes over** — the agent transitions to coding without an analysis step
4. **Content is overridden** — the strong "just start coding" pull of the task context overwhelms the text-based instruction

The critical gap is not **knowledge** (the agent has the content) but **behavior** (the agent doesn't act on it). Structural gates bridge this gap by making the behavior mandatory.

## Cumulative Evidence Against Text Interventions

| Source | Text Intervention | N | Pass Rate |
|--------|------------------|---|-----------|
| EXP-127 Arm A | Ch1 skill in system prompt | 6 | 0% |
| EXP-127 Arm B | Ch3 few-shot in task message | 6 | 0% |
| EXP-127 Arm B (with Ch1) | Ch1 + Ch3 combined | 6 | 0% |
| EXP-127 Baseline (had Ch1 confound) | Ch1 skill (unintentional) | 6 | 0% |
| Pre-EXP-127 baseline history | None | 19 | 0% |
| EXP-084 Ch3 | Ch3 task message | 3 | 33% (1/3) |
| **Total text-only on this scenario** | | **46** | **2%** (1/46) |

One success in 46 text-only attempts. This is not a sampling artifact.

## Relationship to Other Findings

- **KE-058** (injected knowledge has no effect): EXP-127 provides the strongest evidence yet. Even doubling exposure (Ch1 + Ch3) = 0%.
- **KE-007** (structural > text): Confirmed with the clearest side-by-side comparison: same scenario, same agent, same content — only the delivery mechanism differs.
- **KE-059** (channel hierarchy): Ch3 was predicted to work but didn't. The hierarchy isn't just about ordering — there's a qualitative gap between text and structural channels.
- **KE-129** (forced ext. only reliable channel): This entry focuses on the content-delivery failure; KE-129 focuses on the channel that succeeds.

## Boundary Conditions

Text-channel content delivery does work in some contexts:
- **EXP-095**: Ch3 achieved 100% on behavior-escalation-stubborn (behavioral task, not analytical)
- **KE-059**: 18/18 with domain-matched task-message delivery (various scenarios)

The failure appears specific to **judgment tasks with strong action momentum** — tasks where the agent has a clear "just do it" path that competes with the instruction to analyze first.

## Predictions

- **P-130a**: Adding MORE text content (longer examples, multiple worked cases) to Ch1/Ch3 will not improve pass rate above 15% on contradictory-requirements
- **P-130b**: The 1/46 success (EXP-084 run) was stochastic; at N≥20 per arm, Ch3-only will converge to ≤10%
- **P-130c**: Combining text content WITH a structural gate (Ch1+Ch2 or Ch3+Ch2) will not improve over Ch2 alone (content adds nothing when behavior is already forced)

## Implications

1. **Stop investing in text-based skills for judgment tasks** — 0/24 is a definitive failure rate
2. **The `contradiction-detection.md` skill should be removed** — it consumes ~500 tokens per prompt with zero measurable benefit (0/18)
3. **Future interventions for analytical judgment must be structural** — forced externalization, mandatory analysis files, gated workflows
4. **Text delivery may still work for behavioral tasks** — different mechanism, different boundary

## Limitations

- Only tested on one judgment scenario (contradictory-requirements)
- Ch3-in-isolation was never cleanly tested (Ch1 confound in all EXP-127 runs)
- The worked example quality was not varied — maybe a better example would work (but 0/24 makes this unlikely)
- Only tested with one model/agent configuration

---
*The strongest negative result in the knowledge base: 0/24 text-delivered runs succeeded on a task that achieves 100% with structural enforcement. Content delivery is not the bottleneck — behavioral forcing is.*
