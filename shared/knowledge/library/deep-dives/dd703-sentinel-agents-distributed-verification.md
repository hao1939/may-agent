# DD-703: Sentinel Agents — Distributed Security Layer for Multi-Agent Systems

**Rating**: ★★★★
**Paper**: "Sentinel Agents for Secure and Trustworthy Agentic AI" (September 2025)
**arXiv**: 2509.14956
**Relevance**: Distributed verification enforcement, coordinator-sentinel architecture for runtime security

---

## Core Innovation

A **Coordinator + Sentinel** architecture for distributed security in multi-agent systems. Rather than centralizing all security checks, Sentinel agents are deployed at boundaries — each one enforcing security policies at its assigned perimeter. The Coordinator manages policy distribution and sentinel lifecycle, but individual sentinels operate independently for low-latency enforcement.

## Architecture

```
                    Coordinator
                   ┌─────────────┐
                   │ Policy Mgmt │
                   │ Sentinel    │
                   │ Lifecycle   │
                   │ Alert Agg.  │
                   └──────┬──────┘
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
      ┌──────────┐ ┌──────────┐ ┌──────────┐
      │ Sentinel │ │ Sentinel │ │ Sentinel │
      │ (API     │ │ (Inter-  │ │ (Data    │
      │  Gateway)│ │  Agent)  │ │  Access) │
      └──────────┘ └──────────┘ └──────────┘
           │             │             │
      [API calls]  [Agent msgs]  [DB queries]
```

## Key Mechanisms

### 1. Sentinel Deployment Points
- **API Gateway Sentinels**: Monitor and filter external API calls (tool use)
- **Inter-Agent Sentinels**: Validate messages between agents (delegation, coordination)
- **Data Access Sentinels**: Guard database queries and file system access
- **User-Interface Sentinels**: Filter outputs before delivery to users

### 2. Policy Distribution
- Coordinator pushes updated security policies to all sentinels
- Policies include: allowlists, blocklists, rate limits, content filters, authorization rules
- Policy updates propagate without sentinel restart (hot reload)

### 3. Independent Enforcement
Each sentinel operates independently after receiving policy:
- Low-latency decision (no round-trip to coordinator)
- Local caching of policy + recent decisions
- Fallback behavior when coordinator unreachable (fail-closed or fail-open configurable)

### 4. Alert Aggregation
- Sentinels report security events to coordinator
- Coordinator performs cross-sentinel correlation
- Pattern detection: distributed attacks visible only through aggregation
- Escalation protocols for coordinated threats

## Critical Analysis

### Strengths
- **Distributed enforcement reduces bottleneck**: No single point of failure for security checks
- **Boundary-specific policies**: Each sentinel type can specialize (API sentinel knows HTTP semantics; inter-agent sentinel knows message protocols)
- **Separation of policy management from enforcement**: Coordinator handles policy; sentinels handle enforcement
- **Production-oriented**: Addresses real deployment concerns (latency, fault tolerance, hot reload)

### Limitations
- **Policy consistency window**: Between coordinator update and sentinel propagation, policies may be inconsistent
- **Limited to reactive security**: Sentinels check current requests; they don't reason about multi-step attack patterns
- **No verification of sentinel correctness**: How do you verify the sentinels themselves? No self-verification mechanism described
- **Coordinator as single point of policy failure**: While enforcement is distributed, policy management is centralized

## Implications for Our Architecture

### 1. Verification Sentinel Pattern
Apply the sentinel concept to verification: deploy verification sentinels at each boundary (inference input, tool call, agent delegation, user output). Each sentinel runs locally with cached verification policies.

### 2. Complements DD-701 (Semantic Router DSL)
The Sentinel architecture provides the **runtime enforcement topology** while the DSL provides the **policy compilation**. Together:
- DSL compiles verification policies
- Coordinator distributes compiled policies to sentinels
- Sentinels enforce at boundaries with local evaluation

### 3. Cross-Sentinel Correlation for Verification
Multiple sentinels detecting anomalies at different boundaries can be correlated by the coordinator to detect sophisticated evasion patterns (e.g., an agent that passes individual boundary checks but exhibits problematic behavior across boundaries).

### 4. Fail-Closed vs Fail-Open Decision
The configurable fallback behavior is relevant: for safety-critical verification, fail-closed (reject when uncertain); for throughput-sensitive paths, fail-open with logging.

## Cross-References
- **DD-701** (Semantic Router DSL): Policy compilation → sentinel enforcement pipeline
- **DD-699** (Dual-State): Guard/recovery states map to sentinel operational modes
- **DD-690** (CoCo): Continuous oversight ≈ sentinel monitoring
- **DD-702** (DOVA): DOVA's deliberation decides *whether* to verify; sentinels decide *how* at each boundary
- **KE-104**: Verification architecture — sentinels provide the runtime enforcement layer

---
*Scout DD-703 | 2026-04-09 | Verification Orchestration Research Sprint*
