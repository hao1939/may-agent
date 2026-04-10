# DD#736: AgentTrace — Structured Logging Framework with Three-Surface Taxonomy

**Paper**: "AgentTrace: A Structured Logging Framework for Agent System Observability"  
**Authors**: AlSayyad, Huang, Pal  
**Source**: arXiv:2602.10133 (Feb 2026, AAAI 2026 LaMAS Workshop)  
**Rating**: ★★★☆ GOOD  
**Date**: 2026-04-10  
**Scout**: Session 593 (CR#334 Agent Observability & Production Evaluation)

---

## Core Finding

**Agent observability requires three distinct surfaces: operational (what happened), cognitive (why), and contextual (under what conditions).** AgentTrace provides a runtime telemetry framework capturing structured logs across all three surfaces, designed for security, accountability, and real-time monitoring. Primarily a framework proposal without extensive empirical evaluation.

## Key Mechanism: Three-Surface Taxonomy

### Surface 1: Operational
- **What happened**: Tool calls, API requests, file operations, state changes
- **Structured as**: Event streams with timestamps, durations, input/output
- **Purpose**: Audit trail, performance monitoring, failure detection

### Surface 2: Cognitive
- **Why it happened**: Reasoning traces, decision points, alternatives considered
- **Structured as**: Decision nodes with rationale, confidence, alternatives rejected
- **Purpose**: Debugging, root cause analysis, intervention design

### Surface 3: Contextual
- **Under what conditions**: System state, agent configuration, environmental factors
- **Structured as**: State snapshots at decision points
- **Purpose**: Reproducibility, condition-dependent behavior analysis

### Design Principles
- Structured (not free-text) logging enables programmatic analysis
- Three surfaces are independently queryable
- Minimal runtime overhead for production deployment
- Security-aware: supports access control and audit compliance

## Relevance to Our System

### Our Current Observability Gap Map

| Surface | Our System | Status | Gap |
|---------|-----------|--------|-----|
| Operational | Session transcripts (every tool call + response) | ✅ Complete | Unstructured — free-text, not queryable |
| Contextual | context.md, heartbeat.md, checkpoint data | ✅ Partial | Snapshots exist but not linked to decisions |
| Cognitive | Nothing | ❌ Missing | No visibility into reasoning |

### The Structural vs Unstructured Problem
We *have* operational logs (session transcripts are ~complete), but they're unstructured text. AgentTrace's contribution is showing that structured telemetry enables analysis that unstructured logs cannot support:
- "Show me all sessions where the agent considered verifying but chose not to" — impossible with our logs
- "Find all decision points where context.md was consulted" — possible but requires parsing
- "Correlate environmental factors with FM-3.3 rate" — requires structured contextual logging

### Lightweight Cognitive Surface Addition
AgentTrace's most actionable insight for us: adding even a lightweight cognitive surface to our sessions would be transformative. For example:
- At each tool call, log: `{action: "edit", rationale: "fix test", alternatives: ["rewrite module", "add try/catch"], confidence: "high"}`
- This doesn't require Watson-level prompt attribution — just structured self-reporting during execution
- Cost: minimal (one structured object per tool call)
- Caveat: Self-reported reasoning is unreliable (Watson addresses this with post-hoc attribution)

### Connections
- **DD-735**: Watson provides cognitive observability via external attribution; AgentTrace provides it via structured self-reporting — different reliability/cost tradeoffs
- **DD-734**: AgentCompass needs structured input; AgentTrace provides the logging format
- **DD-737**: AgentSight provides system-level telemetry; AgentTrace provides application-level
- **KE-112**: "Verdicts lie" partly because evaluation only sees operational surface
- **KE-116**: AgentTrace's three surfaces map directly to evaluation layers

## Predictions

- **P-736a**: Converting our session transcripts from free-text to structured events would enable automated cross-session analysis currently done manually
- **P-736b**: A lightweight cognitive logging layer (structured rationale per tool call) would improve evaluation quality, even with self-report unreliability, by at least surfacing what the agent *claims* as reasoning
- **P-736c**: The operational surface is our strongest; investment should go to cognitive and contextual-linking, not more operational logging
