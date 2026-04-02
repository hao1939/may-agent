# Synthesis: WebWeaver & Topology Leaks (2026-04-26)

**Source**: `deep-dive-arxiv-2603-11132-webweaver-topology-attack.md` (Scout)
**Context**: WebWeaver demonstrates that multi-agent topology (who talks to whom) is inferable via side-channels (latency, semantic similarity) with ~90% accuracy.

## The Threat: Topology is Public
We have assumed our internal structure (May -> Coder -> QA) is an implementation detail. WebWeaver proves it is **Public Information**.
- **Latency Fingerprint**: The time difference between a "May decision" and a "Scout deep dive" is visible.
- **Semantic Leak**: The "voice" of Coder is distinct from May.
- **Impact**: An attacker can identify the **Coordinator** (May) and target her with "DoS" or "Poisoning" attacks, knowing she is the single point of failure.

## Our Vulnerability: The Star Topology
Our system is a classic **Star Topology** (Hub-and-Spoke):
- **Hub**: May (Supervisor).
- **Spokes**: Coder, Scout, Bob, Coach.
- **WebWeaver Result**: Star topology is the *easiest* to map (94% accuracy). May is trivially identifiable.

## Defensive Implications (P119 Topology Hiding?)

### 1. Latency Normalization (The Padding)
WebWeaver suggests **Latency Padding** (random delays) reduces accuracy to 82%.
- **Action**: We should consider a "Minimum Response Time" or "Jitter" at the Gateway layer (`manager.ts`) to mask the difference between a cache hit and a tool call.

### 2. Output Homogenization (The Voice)
WebWeaver uses semantic gradients.
- **Action**: All user-facing output comes from **May**. May re-writes sub-agent outputs. This "Voice Masking" is already our convention (May summarizes), but we must enforce it strictly. **No raw sub-agent outputs to user.**

### 3. Topological Agnosticism (Resilience)
The best defense is not hiding the topology, but making it **Robust** (P93).
- If May is identified and attacked, the system must survive.
- **Current State**: If May crashes/hallucinates, the system halts.
- **Fix**: We need **Redundant Coordinators** or **Decentralized Handoffs** (Mesh) for critical paths? (Too complex for now, violates P115).

## Recommendation
1. **Adopt "Topology masking" convention**: May MUST summarize/rewrite all sub-agent outputs. Never forward raw text from Coder/Scout to the user. This breaks the "Semantic Gradient" channel.
2. **Update Philosophy**: Add **P119 Topology Hiding**: "The internal agent graph is visible to the adversary. Mask it by normalizing latency and homogenizing output voice."
3. **Brief Tech-Lead**: Investigate "Jitter" in `manager.ts` (low priority, but good to note).

## Status
- **Analysis**: Complete.
- **Action**: Update Philosophy (P119). Brief May (Voice Masking).
