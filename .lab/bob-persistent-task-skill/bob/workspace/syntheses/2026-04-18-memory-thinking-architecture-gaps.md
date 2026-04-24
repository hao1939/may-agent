# Synthesis: Memory, Thinking, and Architecture Gaps

**Date**: 2026-04-18
**Sources**: KE-227 (graph memory), KE-228 (cognitive companions), KE-229 (cognitive-executive separation)
**Deep Dives**: DD-763, DD-768, DD-770, DD-772

## Thread Summaries

**KE-227 (Graph memory vs flat KB)**: Three independent papers converge on hierarchical graph memory outperforming flat stores. Key advantages: encoding/consolidation decoupling, multi-hop retrieval, interference minimization. Our flat KE-XXX system lacks all three.

**KE-228 (Heartbeats as cognitive companions)**: Our heartbeat architecture already implements DD-770's "companion monitoring" pattern, and our auto-matched knowledge is a crude version of DD-772's context recovery. Gaps: no adaptive frequency (fixed 30min), no gap detection (push not pull), no degradation sensing.

**KE-229 (Cognitive-executive mapping)**: Our multi-agent roles are all cognitive — the real cognitive-executive boundary is the tool call interface. Hard gates work (100% compliance) because they sit at this boundary; prompt-level interventions fail because they're inside the cognitive layer.

## Cross-Thread Connections

### 1. The retrieval problem is the common thread
All three KEs point at the same core issue from different angles:
- **KE-227**: Flat retrieval misses conceptually-related knowledge (no graph links)
- **KE-228**: Push-based retrieval sends irrelevant context, misses actual gaps
- **KE-229**: No information flow control — everything accessible but nothing targeted

**Pattern**: Our architecture captures knowledge well (200+ KEs) but retrieves it poorly. The bottleneck isn't generation — it's getting the right knowledge to the right agent at the right moment.

### 2. Structural boundaries beat behavioral interventions (again)
KE-229's finding that hard gates work at the cognitive-executive boundary reinforces KE-228's recommendation to enhance heartbeats rather than adding monitoring agents, and KE-227's suggestion that graph structure (a data architecture change) would outperform retrieval prompt improvements.

### 3. Encoding vs consolidation maps to heartbeat vs synthesis
KE-227's encoding/consolidation split from GAM maps directly to KE-228's heartbeat/synthesis distinction. Fast capture in heartbeats, careful integration in synthesis sessions. We do this informally but don't enforce it.

## Biggest Gap: Gap-Aware Retrieval

The single biggest architectural gap: **agents don't know what they don't know, and the system can't tell them.** Current auto-match retrieval pushes context by keyword similarity. DD-772 shows 91.4% gap recall with structured gap detection. The difference between our ~3 auto-matched KEs per session and actually-relevant knowledge is the difference between keyword matching and gap-aware pulling.

This matters because it connects to our top failure modes:
- FM-3.3 (verification collapse): agents don't retrieve relevant verification patterns
- FM-1.3 (avoidable errors): agents don't retrieve known path/command patterns
- KE-011/KE-026 (passive knowledge is dead): the retrieval mechanism is the problem

## Proposed Hypothesis

**H-173: Gap-aware knowledge retrieval reduces failure rates**

*Claim*: If agents declare explicit knowledge gaps at session start ("what am I uncertain about for this task?") and retrieval targets those gaps (rather than keyword-matching the task description), then auto-matched knowledge relevance increases by >50% and downstream FM-3.3 rate decreases.

*Testable via*: Compare current auto-matched KEs against gap-targeted KEs for 20 recent sessions. Score relevance (was the KE actually used/needed?). This is a retrospective analysis — no live experiment needed.

*Connects to*: KE-228 (gap detection), KE-227 (multi-hop retrieval), KE-011 (passive knowledge problem), DD-772 (CONCORD gap recall)

## Impact Ranking

1. **Gap-aware retrieval** (KE-228 × KE-227) — highest impact, addresses root cause of knowledge-action gap
2. **Graph relationships between KEs** (KE-227) — medium-term structural improvement, enables multi-hop retrieval
3. **Adaptive heartbeat frequency** (KE-228) — targets FM-3.3 directly but harder to implement
4. **Formalized dispatcher tiers** (KE-229) — safety improvement, lower urgency given current compliance rates

## Next Steps

1. Write H-173 to hypotheses directory
2. Design retrospective analysis: for 20 recent sessions, compare auto-matched KEs vs what agents actually needed
3. Prototype simple `relates-to:` frontmatter in KE files as a step toward graph structure
