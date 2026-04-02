# Cross-Reference: Bureaucracy of Speed × GNAP — From Protocol Theory to Protocol Practice

**Scout Cross-Reference #4** | 2026-03-13

## Papers Under Synthesis

1. **arXiv:2603.09875** — *The Bureaucracy of Speed: Cache Coherence as Multi-Agent Authorization* (Parakhin, Okta)
2. **GNAP v4** — *Git-Native Agent Protocol* (Farol Labs)

## The Complementarity

These two analyses address the same fundamental problem — **how do multi-agent systems manage authority and coordination?** — from opposite ends of the abstraction spectrum:

| Dimension | Bureaucracy of Speed | GNAP |
|-----------|---------------------|------|
| **Approach** | Formal theory (MESI mapping, proofs) | Practical protocol (JSON schemas, heartbeat loop) |
| **Focus** | Authorization revocation dynamics | Task coordination mechanics |
| **Key entity** | Capability (credential, authority) | Task (work item, assignment) |
| **Coherence model** | Cache coherence (MESI states) | Eventual consistency (git pull/rebase) |
| **Key innovation** | Operation-bounded credentials (RCC) | Run records + typed messages |
| **Threat model** | Stale credentials → unauthorized ops | No explicit threat model |
| **Validation** | Tick-based simulation | Production use (4 agents, 50+ tasks) |

**The gap is stark:** Bureaucracy of Speed identifies the critical vulnerability (stale authorization causing unbounded unauthorized operations) but provides no practical protocol for agents to follow. GNAP provides a complete practical protocol but has **zero security model** — any agent with git push can modify any file. Together, they describe the full stack: GNAP for coordination mechanics, CCS for authorization governance.

## Five Cross-Cutting Insights

### 1. GNAP's Task Lifecycle IS a Credential Lifecycle

GNAP's task state machine (`backlog → ready → in_progress → review → done`) maps directly onto Bureaucracy of Speed's Capability Coherence System:

| GNAP Task State | CCS Authorization State | Meaning |
|----------------|------------------------|---------|
| `ready` | Shared (S) | Agent can read but hasn't acquired exclusive access |
| `in_progress` | Exclusive (E) or Modified (M) | Agent holds active credential to perform work |
| `review` | Transient: EIA | Credential being revoked (reviewer can reject) |
| `done` | Invalid (I) after successful completion | Credential consumed, no further operations permitted |
| `blocked` | Transient: ISG | Pending grant of dependency resolution |
| `cancelled` | Invalid (I) after revocation | Credential explicitly revoked |

**Critical insight:** The `in_progress` state in GNAP has NO operation bound. An agent can stay `in_progress` indefinitely, performing unlimited operations. This is exactly the vulnerability Bureaucracy of Speed identifies — without an operation budget, a rogue or malfunctioning agent in `in_progress` state can cause unbounded damage.

**Concrete fix:** Add an `op_budget` field to GNAP task assignments:
```json
{
  "id": "FA-1",
  "assigned_to": ["carl"],
  "state": "in_progress",
  "op_budget": 50,          // ← max operations before re-authorization
  "ops_used": 23            // ← current count
}
```
At `ops_used >= op_budget`, the agent MUST transition the task to `review` (for re-authorization) or `blocked` (for assistance). This implements RCC semantics within the GNAP protocol.

### 2. GNAP's Read Receipts Solve CCS's Revocation Acknowledgment Problem

CCS's transient states (EIA, SIA, MIC) exist because revocation requires acknowledgment — the revoking authority doesn't know the revocation has taken effect until the agent acknowledges it. During this window, unauthorized operations accumulate.

GNAP's `read_by` mechanism on messages provides exactly the acknowledgment channel needed:

```json
{
  "type": "alert",
  "text": "Task FA-1 authority revoked. Stop all operations immediately.",
  "to": ["carl"],
  "read_by": []    // ← Carl hasn't acknowledged yet
}
```

When `"read_by": ["carl"]`, the revoking authority knows the transient state has resolved. This converts the unknown revocation window into a **measured** window.

**Combined protocol:**
1. Authority sends `alert` message with revocation notice
2. Agent's heartbeat loop picks up the message
3. Agent marks `read_by`, transitions task to `cancelled` or `blocked`
4. Authority sees `read_by` → knows transient state resolved
5. Maximum damage window = heartbeat_sec (bounded, measurable)

### 3. GNAP's Run Records Enable Velocity Vulnerability Assessment

Bureaucracy of Speed's core equation is V_v(v, Δt) = v · Δt — damage = velocity × time window. But GNAP's run records provide the data needed to **measure** agent velocity empirically:

```
velocity_agent = tokens.output / duration_seconds
```

Or more practically for our system:
```
velocity_agent = file_operations / run_duration
```

With run records tracking operations, cost, and duration, we can:
1. **Measure** each agent's operational velocity
2. **Calculate** the velocity vulnerability for each authorization strategy
3. **Set** operation budgets (RCC n values) proportional to acceptable risk

**Without run records, velocity vulnerability is theoretical.** With them, it's measurable and manageable.

### 4. The Typed Message Gap Creates Authorization Ambiguity

GNAP distinguishes five message types: `directive`, `status`, `request`, `info`, `alert`. Bureaucracy of Speed's CCS requires six event types: `grant`, `revoke`, `delegate`, `introspect`, `exhaust`, `expire`.

These partially overlap:

| CCS Event | Best GNAP Type | Gap |
|-----------|---------------|-----|
| `grant` | `directive` | Works — authority directs agent to begin |
| `revoke` | `alert` | Works — urgent revocation notice |
| `delegate` | `directive` | Partial — delegation ≠ simple instruction |
| `introspect` | `request` | Works — authority asks agent for status |
| `exhaust` | `status` | Partial — agent reports budget exhaustion |
| `expire` | (none) | **GAP** — no automatic expiration in GNAP |

**Two missing capabilities:**
1. **Delegation type** — GNAP's `directive` doesn't distinguish "do this task" from "you may sub-delegate this authority to others." The CCS distinction between Exclusive (E, no sub-delegation) and Modified (M, can sub-delegate) is lost.
2. **Automatic expiration** — GNAP has no TTL on tasks or credentials. CCS's `expire` event requires temporal bounds, which GNAP doesn't support.

**Proposed additions:**
```json
// Delegation message (new type)
{
  "type": "delegate",
  "text": "Carl, you may assign subtasks of FA-1 to Leo",
  "delegation_depth": 1,     // how many levels of sub-delegation permitted
  "expires_at": "2026-03-19" // temporal bound (CCS lease semantics)
}
```

### 5. GNAP's Single-Repo Model = CCS's Single-Authority Model

Both systems assume a single point of authority:
- GNAP: one git repository (whoever controls the repo controls everything)
- CCS: one Authority Service (PDP + coherence directory controller)

Both acknowledge this as a limitation but don't solve it. In our system, this is acceptably correct: Bob is the single authority, May is the single orchestrator, and the shared filesystem is the single repository.

However, both analyses converge on the same failure mode: **if the authority is compromised, there's no recovery mechanism.** For CCS, a compromised Authority Service can grant unlimited capabilities. For GNAP, a compromised repository owner can modify any file.

**For our system, the "compromised authority" translates to:** What if May hallucinates and delegates incorrectly? What if a journal entry contains false information that corrupts subsequent decisions? The CCS framework says this should trigger cascade revocation (MIC state) — but neither protocol provides automatic detection of authority compromise.

## Synthesis: The Combined Protocol Stack

```
┌──────────────────────────────────────────────────────┐
│  Application Layer                                    │
│  Knowledge mgmt, evaluation, research, coaching       │
│  (Our SOUL.md, DOMAIN.md, LESSONS.md, knowledge/)    │
├──────────────────────────────────────────────────────┤
│  Authorization Layer (NEW — from Bureaucracy of Speed)│
│  CCS states, operation budgets, velocity monitoring   │
│  Trust scoring, revocation broadcasting               │
├──────────────────────────────────────────────────────┤
│  Coordination Layer (from GNAP)                       │
│  Tasks (state machine), Runs (audit), Messages (typed)│
│  Read receipts, heartbeat loop                        │
├──────────────────────────────────────────────────────┤
│  Transport Layer                                      │
│  Filesystem / git / shared directory                  │
└──────────────────────────────────────────────────────┘
```

Currently, our system has the Application Layer and Transport Layer but is thin on the middle two layers. The combined GNAP + CCS insights suggest adding:

1. **Structured task state machine** (GNAP) with **operation budgets** (CCS) → tasks have explicit lifecycle AND bounded authority
2. **Typed messages** (GNAP) with **CCS event semantics** → communication carries authorization state changes
3. **Run records** (GNAP) with **velocity tracking** (CCS) → auditable execution with measurable security posture
4. **Read receipts** (GNAP) as **revocation acknowledgment** (CCS) → bounded transient state windows

## Practical Recommendations for Our System

### Tier 1 — Adopt Now (Low Risk, High Value)
1. **Add operation budgets to delegations.** When May delegates: "Implement feature X. Budget: 30 file operations." Agent must checkpoint at budget exhaustion.
2. **Add typed prefixes to SIGNALS entries.** `[DIRECTIVE]`, `[INFO]`, `[REQUEST]`, `[ALERT]`, `[STATUS]` — enables automatic triage.
3. **Track read receipts on SIGNALS.** Agents append `Acknowledged by: Agent (date)` after processing an entry.

### Tier 2 — Design and Prototype (Medium Risk, High Value)
4. **Run records for delegated tasks.** JSON file per delegation recording agent, duration, operations, cost, outcome, artifacts.
5. **Heartbeat-bounded revocation.** When Bob cancels a task, the revocation propagates via SIGNALS alert; maximum unauthorized operation window = heartbeat interval.

### Tier 3 — Evaluate (Higher Risk, Uncertain Value)
6. **Full CCS state machine for delegations.** Track delegation state (Granted → Active → Reviewing → Completed/Revoked) with explicit transitions.
7. **Continuous trust scoring.** Track agent reliability metrics from run records; auto-pause agents below threshold.

## Connection to Broader Portfolio

This cross-reference bridges **theoretical security** (CCS/MESI formalism) with **practical protocol** (GNAP) to produce actionable protocol improvements. It connects to:

- **HAE Security Framework (2603.07496):** The combined stack addresses HAE's L2-L3 gaps (agent-to-agent and collective security)
- **Dynamic Adaptive Coordination (2603.11560):** Operation budgets introduce γ (dissipation) into the coordination dynamics — bounded authority naturally decays, increasing system stability
- **SSGM Memory Governance (2603.11768):** Run records + read receipts implement SSGM's Principle 3 (provenance tracking) and Principle 1 (validation before state changes)
- **Information Self-Locking (2603.12109):** Operation budgets force agents to checkpoint periodically, creating natural breakpoints where self-locked behavior can be detected and corrected
- **Error Cascades (2603.04474):** CCS cascade revocation (MIC state) provides the formal mechanism for containing error propagation through delegation chains

## Bottom Line

Bureaucracy of Speed provides the **why** (authorization coherence is a first-class security concern, velocity creates unbounded damage windows) and GNAP provides the **how** (practical protocol primitives for multi-agent coordination). Neither alone is sufficient; together they describe a complete authorization-aware coordination protocol.

**The key actionable insight:** Every task delegation is a credential grant. Every credential needs an operation budget. Every operation budget needs acknowledgment-bounded revocation. GNAP's protocol primitives (tasks, runs, messages, read receipts) are the implementation vehicle for CCS's theoretical requirements (operation bounds, state transitions, revocation acknowledgment).

---
*Cross-reference #4 by Scout, 2026-03-13. ~2800 words.*
