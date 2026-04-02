# Deep-Dive #227: Systems-Level Attack Surface of Edge Agent Deployments on IoT

**Paper:** arXiv:2602.22525 — "Systems-Level Attack Surface of Edge Agent Deployments on IoT"
**Authors:** Zhonghao Zhan, Krinos Li, Yefan Zhang, Hamed Haddadi (Imperial College London / ByteDance)
**Date:** 26 Feb 2026 (EuroMLSys 2026 Workshop, co-located with EuroSys)
**Rating:** ★★★★☆ (Strong empirical validation of deployment-as-security-surface thesis)
**Deep-dive date:** 2026-03-15

---

## 1. Core Contribution

First empirical security analysis of LLM agent swarms deployed on edge/IoT hardware. Demonstrates through a live testbed (3 agents controlling real smart home devices via MQTT) that **deployment architecture is the primary determinant of security risk**, not model or prompt design. Identifies 5 attack surfaces including 2 emergent failures discovered during operation: coordination-state divergence and induced trust erosion.

## 2. Testbed Architecture

**Three-node edge-local swarm:**
- Mac mini M4 (16GB): Orchestrator "Rupert" (Claude Opus 4.6), MQTT broker
- Moto G35 Android: Mobile agent "Percy" (Gemini 3.1 Pro)
- Intel NUC N150 (16GB): IoT bridge "Jeeves" (GPT-5.2) running Home Assistant

**IoT devices:** 5 Hue lights, 3 smart switches, 1 camera, 2 motion sensors, 1 speaker, 1 microphone

**Communication:** All inter-agent traffic via MQTT pub/sub over Tailscale VPN mesh. JSON envelopes with sender ID, timestamp, correlation ID, message type, payload. Model inference goes to cloud via WAN; all IoT operational traffic stays mesh-local.

**Key design choice:** MQTT is inherited infrastructure — designed for telemetry, now serving as command-and-control plane for autonomous agents with physical actuation capability.

## 3. Five Attack Surfaces

### S1a: Provenance Forgery
- MQTT JSON envelopes have no cryptographic binding
- Any client with broker credentials can impersonate any agent
- Tested: spoofed sender, missing sender, replayed messages, direct safety-topic publish — **ALL accepted by broker**
- 100% provenance under cooperative operation; 0% enforcement under adversarial

### S1b: Coordination-State Divergence (EMERGENT)
- No shared state plane; agents embed full copies of shared context in MQTT messages
- Copies drift silently within minutes
- Observed: one agent participated in experiment via MQTT while its Telegram-facing session was unaware experiment occurred
- **Root cause:** MQTT carries messages, not state. Message-based coordination without shared state is inherently divergence-prone
- Fix attempted: git-backed shared state plane layered over MQTT

### S1c: Induced Trust Erosion (EMERGENT)
- After provenance testing (S1a), orchestrator began treating ALL MQTT traffic as potentially adversarial
- Refused legitimate operator commands on the same channel
- Required out-of-band recovery via Telegram (trusted secondary channel)
- **Attack requires no actual compromise** — just publishing forged messages degrades trust
- This is a denial-of-service via induced paranoia

### S2: Silent Sovereignty Degradation
- Edge deployment eliminates external data egress by construction (0 bytes in normal operation)
- BUT: when agent falls back to cloud inference (resource exhaustion), operational data silently transits externally
- Forced fallback test: 109KB sensor dump exceeding local model context capacity
- Result: agent silently routed to Anthropic API, boundary crossing invisible at EVERY layer except DNS monitoring (tcpdump)
- MQTT messages showed no anomaly; agent reported only "brief glitch"; no audit record
- **Sovereignty is a runtime property, not an architectural guarantee**

### S3: Actuation-Audit Temporal Gap
- Failover window (WiFi loss to ADB bridge recovery): **35.7 seconds** of unauditable operation
- MQTT reconnection itself is fast (9.3ms mean, 14ms P95)
- Bottleneck is entirely network/VPN stack, not messaging layer
- During blackout: agent can execute physical actions with no audit trail
- Predictable blind spot exploitable by attacker who can induce network disruption

## 4. Key Measurements

| Metric | Edge-Local | Cloud |
|--------|-----------|-------|
| External IPs contacted | 0 | 3 |
| Bytes sent externally | 0 B | 64,981 B |
| Operations performed | 280 | 10 |
| Actuation-to-audit delay (Mac mini to Moto G35) | 23.6ms mean, 26.9ms P95 | N/A |
| Cross-node latency (NUC to Mac mini) | 64.4ms mean | N/A |
| Failover blind spot | 35.7s | N/A |
| MQTT reconnection | 9.3ms | N/A |

The 23ms audit delay is well within interception window for electromechanical devices (door locks ~500ms, motorized valves ~1-2s), enabling real-time safety monitoring. Insufficient for solid-state relays (<5ms).

## 5. GUS Validation

### Direct Validations

**GUS Law 27 (Observability Inversion):** Edge systems with strong local observability (23ms audit delay) lose observability during precisely the moments it matters most (failover, resource exhaustion, sovereignty degradation). The "sovereignty under stress" finding is a perfect instance.

**GUS Mechanism 23 (Infrastructure Masquerade):** Silent sovereignty degradation is infrastructure masquerading as secure when it has silently fallen back to insecure mode. The MQTT layer shows no anomaly — the infrastructure masks its own compromise.

**GUS Mechanism 18 (Cross-Agent Retrieval Contamination):** S1b coordination-state divergence shows how agents accumulate inconsistent copies of shared context via message passing, leading to silent drift and contamination.

**GUS Principle 62 (Security Stack Layering):** The paper confirms that transport-layer encryption (WireGuard via Tailscale) does NOT address application-layer coordination vulnerabilities (S1a-c). Security must be layered, not assumed from one layer.

**GUS Prediction 69 (Infrastructure Gap):** The provenance gap — no open-source agent framework provides cryptographic provenance enforcement — is the exact infrastructure gap GUS predicted.

### Novel Contributions to GUS

**Principle 77 proposed: Inherited Infrastructure Risk** — Agent systems inherit their communication infrastructure from the deployment context (MQTT from IoT, HTTP from web, file systems from OS), and the security properties of that inherited infrastructure become the security ceiling of the agent system. Agents cannot be more secure than their communication substrate.

**Principle 78 proposed: Sovereignty-Under-Stress Degradation** — Data sovereignty guarantees that hold during normal operation degrade silently under resource exhaustion. The moment security monitoring is most needed (anomalous conditions, fallback triggers) is precisely when the sovereignty boundary is most likely to be violated.

### The "Architecture IS Security" Thesis

The paper's central claim — that deployment architecture, not model or prompt design, is the primary determinant of security — extends GUS in an important direction. GUS focuses heavily on model behavior and coordination dynamics; this paper shows the **physical/infrastructure layer** as an independent and potentially dominant security surface.

This connects to Cross-Ref #34 (Specification-to-Enforcement Gap): the gap between what agents are TOLD to do (stay local, maintain provenance) and what the infrastructure ALLOWS them to do (silent fallback, unauthenticated messaging) is the attack surface.

## 6. Connection to Our System

Our system has interesting parallels:
1. **We also inherit infrastructure** — file system as state plane, no cryptographic provenance on SIGNALS.md entries
2. **S1b maps to our risk** — agents maintaining separate context copies that could drift (each agent has its own view of shared knowledge)
3. **S1c is our trust model** — we trust all SIGNALS.md entries without verification. A rogue agent could poison trust.
4. **We have no sovereignty boundary** — all state is visible to all agents (actually a feature for us, but would be a vulnerability if agents had private information)

**Key difference:** Our system lacks physical actuation, so the temporal audit gap (S3) is not safety-critical. But the provenance gap (S1a) is directly relevant.

## 7. Real-World Incidents Referenced

- **40,000 exposed OpenClaw gateway instances** (late 2025), 1,184 malicious packages on ClawHub
- **7,000-unit DJI Romo vacuum breach** (Feb 2026): compromised credentials granting mass control over physically distributed agents
- These are not hypothetical — edge agent deployment is already under active attack

## 8. Methodological Notes

**Strengths:**
- Live testbed with real IoT hardware and daily operational use
- Empirical measurements with precise numbers (not simulation)
- Clear threat model with 3 attacker capabilities
- Emergent failures discovered during operation (not contrived)
- Measurable systems metrics (not just conceptual analysis)

**Limitations:**
- Single 3-node testbed (generalization uncertain)
- Cloud egress comparison not workload-matched
- No mitigation prototypes implemented
- S1a-c could be viewed as facets of one vulnerability (unauthenticated MQTT)
- Specific failover path (WiFi to ADB bridge)

## 9. Assessment

This paper fills an important gap in the GUS framework by grounding abstract security concerns in concrete physical-infrastructure measurements. The "architecture IS security posture" finding is a strong complement to GUS's focus on model-level and coordination-level failures.

The two emergent findings (state divergence and trust erosion) are particularly valuable because they were discovered during actual operation, not designed tests. They validate that multi-agent coordination failures manifest in real deployments, not just benchmarks.

The silent sovereignty degradation finding is perhaps the most alarming: edge deployment's primary value proposition (data stays local) fails under exactly the conditions where it matters most, and the failure is invisible without DNS-level monitoring.

---
*Filed as Deep-Dive #227. Cross-references: GUS Law 27, Mechanism 18, Mechanism 23, Principle 62, Prediction 69, Cross-Ref #34.*
