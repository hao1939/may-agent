# KE-205: MCP Production Gaps — What We Already Do and What's Missing

**Source**: DD-773 (Srinivasan 2026, arXiv 2603.13417)
**Created**: 2026-04-16
**Connections**: KE-060 (intervention taxonomy), FM taxonomy, opCount/session management

## Three Production Primitives vs. Our System

### 1. SERF (Structured Error Semantics) ↔ FM Taxonomy

**Overlap**: SERF prescribes machine-readable failure types for deterministic self-correction. Our FM taxonomy (FM-1.x path errors, FM-2.x reasoning mismatches, FM-3.x verification gaps) is exactly this — categorized failure modes that drive specific interventions.

**What we do better**: Our FMs are empirically grounded from production failures, not theoretical categories. We track recurrence and have active_recall injection.

**What's missing**: SERF emphasizes *deterministic* correction — given error type X, always apply fix Y. Our FM → intervention mapping is still human-mediated (coach reviews, manual guard design). We don't have automated "if FM-3.3, then inject verification step" at runtime.

**Actionable gap**: A runtime FM-to-intervention dispatcher would close this. KE-060's three mechanisms (structural gates, few-shot, environmental nudges) could be the action space.

### 2. ATBA (Adaptive Tool Budgeting) ↔ Our Session/Cost Management

**Key insight from ATBA**: Budget allocation should adapt to *heterogeneous latency distributions* — some tools are cheap/fast, others expensive/slow. Flat budgets waste capacity.

**Our situation**: We removed opBudget entirely (Hao directive). opCount is observational only. Cost control is at model/session level. This is actually more aligned with ATBA's spirit than a flat per-session tool limit — we let sessions use what they need.

**What ATBA adds**: The idea of *pre-allocating* budget across expected tool types. E.g., gym runs are expensive (KE-053 notes $0.05-0.15 each), file reads are cheap. A budget-aware planner could say "I have room for 3 gym runs, plan accordingly" rather than discovering mid-session that you're out of budget.

**Assessment**: Low priority for us. Session-level cost control is working. ATBA's value is mainly for latency-sensitive production APIs, not research agents.

### 3. CABP (Identity Propagation) ↔ Multi-Agent Routing

**What CABP solves**: In MCP's client-server model, identity must propagate through 6 stages so servers know *who* is requesting. This enables per-agent permissions, audit trails, scoped tool access.

**Our analog**: We have named agents (bob, coder, coach) with separate contexts and file spaces, but no formal identity-scoped routing. Any agent can call any tool. The `agents/` directory structure is the closest thing to identity scoping.

**Relevance**: Low for current scale (3-5 agents). Would matter if we scaled to many specialized agents needing different tool permissions.

## Summary Judgment

DD-773's three primitives map to:
- **SERF → FM taxonomy**: We're ahead on classification, behind on automated dispatch. Most actionable gap.
- **ATBA → session budgets**: We're roughly aligned. No urgent gap.
- **CABP → agent routing**: Not relevant at current scale.

The one actionable insight: **our FM taxonomy could become a SERF-style runtime system** — automatically injecting the right intervention when a known failure pattern is detected, rather than relying on active_recall text warnings that agents may ignore (per KE-011: knowledge files are passive).
