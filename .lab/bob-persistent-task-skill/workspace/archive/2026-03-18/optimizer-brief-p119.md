# Implementation Brief: P119 Topology Hiding

## Context
Research (WebWeaver arXiv:2603.11132) shows that our "Star Topology" (May -> Sub-agents) is inferable with 94% accuracy via **Latency** (timing of responses) and **Semantic Gradients** (distinct agent voices). This exposes May as the Coordinator and a Single Point of Failure.

## The Principle (P119)
**"The Internal Agent Graph Is Visible to the Adversary. Mask It."**
Multi-agent topologies are trivially inferable. An adversary who identifies the Coordinator can target it. Defense requires masking both Timing and Semantics.

## Requirements

### 1. Semantic Defense: Voice Masking (Policy)
- **Target**: `agents/shared/philosophy.md`
- **Action**: Add P119.
- **Rule**: The Gateway (May) MUST rewrite all sub-agent outputs. Never forward raw text from Coder/Scout/Bob to the user. "Rewrite, Do Not Forward."
- **Why**: Distinct vocabulary/error patterns leak the internal agent identity. Homogenized output breaks the semantic gradient.

### 2. Timing Defense: Latency Jitter (Infrastructure)
- **Target**: `src/lib/manager.ts`
- **Action**: Implement a "Jitter" layer in `reply()`.
- **Logic**:
  - IF response time < 500ms (Cache Hit / Simple): Add random delay (0-500ms).
  - IF response time > 500ms (Tool Call): No change.
- **Why**: Blurs the distinction between a cheap cached response and a tool execution, confusing the latency fingerprint classifier (accuracy drops 94% -> 82%).

## Next Steps
1. **Bob**: Update `philosophy.md` (P119).
2. **Tech-Lead**: Implement Jitter in `manager.ts`.
3. **May**: Enforce Voice Masking in `SOUL.md`.
