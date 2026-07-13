<ai_context>
summary: "Cross-source synthesis: At a predictable scale threshold (~20 agents), the cost of FINDING (discovering capabilities, routing requests, selecting tools/agents) dominates the cost of DOING (execution). The field optimizes execution but the enterprise MAS paper (2606.20058) proves discovery noise is the primary bottleneck at scale. Simple tasks degrade faster than complex ones because complex tasks amortize discovery cost across longer execution chains. ToolPro (2606.19992) independently converges on compilation as the fix — encoding multi-step discovery into executable programs. Our production data (Coordination Tax 2:1 planning:work, Cold Start Tax 46% state re-discovery, Compilation Threshold 53.5% below-threshold sessions) validates this from three angles. The next infrastructure wave will be discovery compilation: pre-resolving what-to-call at deploy time rather than runtime."
triggers: ["discovery dominance", "discovery bottleneck", "discovery noise", "agent routing at scale", "why simple tasks fail", "scale vs complexity", "enterprise agent", "multi-agent scaling", "discovery compilation", "MCP scaling", "ToolPro", "capability routing"]
last_updated: "2026-06-21"
source_basis: "arXiv 2606.20058 (Enterprise Event-Driven MAS: 208 scenarios, Persona/Department/Enterprise scale, discovery noise primary bottleneck); arXiv 2606.17519 (Enterprise Routing: 110 agents/584 tools, F1 drops 16-23pp at scale, 10pp irreducible confusion gap); arXiv 2606.19992 (ToolPro: tool programs, 53.4% latency reduction, 96.1% traffic reduction by compiling discovery); arXiv 2606.20537 (Execution-State Capsules: graph-bound checkpoint/restore beyond KV-cache); HN 48614631 (When I Reject AI Code: discrimination bottleneck 102pts 64c); production data (Coordination Tax 2.04:1 ratio, Cold Start Tax 46%, Compilation Threshold 53.5% below-floor sessions); Orchestration Hollowing synthesis; Compilation Gradient synthesis."
</ai_context>

# The Discovery Dominance: Why Finding Overtakes Doing

*Cross-source synthesis — emerges from connecting a new enterprise-scale
empirical study with production data and independent tool-compilation research.
Names a structural inversion that current architecture misses.*

**Type:** Cross-Source Synthesis  
**Created:** 2026-06-21  
**Status:** Active hypothesis with empirical + production convergence  
**Extends:** Coordination Tax, Cold Start Tax, Compilation Threshold, Orchestration Hollowing  
**Complements:** Compilation Gradient (governance axis → execution axis → now discovery axis)  
**Prediction window:** 6–12 months for "discovery compilation" as named infra category

---

## The Thesis

At a predictable scale threshold, the cost of **finding** (discovering capabilities,
routing requests, selecting agents/tools, determining who-does-what) overtakes the
cost of **doing** (actual execution of the task). The field has been optimizing
execution — better reasoning, better tools, bigger context. But the enterprise
MAS paper provides the first rigorous empirical proof that **above ~20 agents,
discovery noise — not task difficulty — is the primary failure mode.**

The counterintuitive result: **simple tasks degrade faster than complex ones at
scale.** Complex tasks amortize their discovery cost over longer execution chains.
Simple tasks pay the full discovery overhead for a trivially short execution.

---

## The Evidence: Three Convergent Streams

### Stream 1: Enterprise Empirical (2606.20058)

"Autonomous Event-Driven Multi-Agent Orchestration for Enterprise AI at Scale"
tests 208 production-derived scenarios across three scales:

| Scale | Agents | Discovery Noise | Performance |
|-------|--------|-----------------|-------------|
| Persona | <10 | Low | Both architectures perform well |
| Department | 20–80 | Medium | Degradation begins |
| Enterprise | 200 | **Primary bottleneck** | Catastrophic for DAG; ReAct survives via incremental recovery |

Key findings:
- **"Scale, not task complexity, dominates orchestration performance"**
- Simple tasks degrade MORE sharply than complex ones at enterprise scale
- DAG Plan-and-Execute offers higher precision at small scale but its overhead worsens at enterprise scale
- ReAct is more robust because it handles failures **incrementally** (doesn't front-load discovery)
- The Task Manager (priority inference + event merging + preemption) reduces high-priority latency 14–75%

**Structural interpretation**: DAG front-loads all discovery (plan everything, then execute). ReAct interleaves discovery with execution (discover-execute-discover-execute). When discovery noise is low, DAG wins. When discovery noise dominates, interleaving wins because each discovery step can correct from the last execution result.

### Stream 1b: Enterprise Routing Degradation (2606.17519)

Independent validation from a deployed enterprise assistant (110 agents, 584 tools):
routing F1 drops **16–23 percentage points** across three frontier models as the
catalog scales from 10 to 110 agents. Oracle analysis decomposes degradation into:
- **Retrieval gap**: candidates not surfaced (recoverable via embedding shortlisting, +10–11pp)
- **Confusion gap**: even with perfect retrieval, ceiling drops 10pp — models genuinely can't distinguish semantically similar tools at scale

This is partially irreducible: embedding-based shortlisting mitigates but doesn't
eliminate the gap. The confusion gap confirms discovery noise is not just a search
problem but a fundamental discrimination problem at scale.

### Stream 2: Tool Program Compilation (2606.19992)

"Beyond Static Endpoints: Tool Programs as an Interface for Flexible Agentic Web
Services" attacks the same problem from a different angle. ToolPro represents an
agent's tool intent as an **executable program** that compactly encodes multi-step
service interactions with explicit effect types.

Results:
- **53.4% end-to-end latency reduction** vs stepwise calling
- **96.1% client-side traffic reduction**
- Gains increase with network latency and workflow complexity
- Effect-aware replay provides exactly-once semantics for state-modifying calls
- Profile-driven policy decides when program execution outperforms stepwise

**Structural interpretation**: Each stepwise tool call pays full discovery cost
(find service → negotiate interface → invoke → parse response → decide next).
ToolPro compiles this into a single program execution. The gains come entirely
from eliminating redundant discovery — not from faster execution per step.

### Stream 3: Production Data (Our System)

Three independent internal measurements converge on the same ratio:

| Measurement | Discovery Cost | Source |
|-------------|---------------|--------|
| **Coordination Tax** | 2.04:1 planning-to-work ratio at scale | aks-explorer 14-day trajectory |
| **Cold Start Tax** | 46% of all ops = re-discovering known state | 4,301 sessions / 48h |
| **Compilation Threshold** | 53.5% sessions below decision floor | aks-explorer session analysis |

Combined: at our production scale (~5 concurrent agents, ~50–200 sessions/day each),
approximately **half of all compute is discovery** (finding what to do, where state is,
what tools to call, which agent handles what). Not execution.

At 200 agents (the enterprise paper's scale), this would be catastrophic.

---

## The Mechanism: Why Simple Tasks Degrade Faster

This result seems paradoxical but follows directly from cost accounting:

```
Total_cost = Discovery_cost + Execution_cost

For a COMPLEX task:   Total = D + E_large     → D/Total is small
For a SIMPLE task:    Total = D + E_small     → D/Total is large

As scale grows, D grows (more candidates to search, more noise to filter):

For complex task:  Total = D_big + E_large   → still dominated by E
For simple task:   Total = D_big + E_small   → now dominated by D
```

At the persona scale (10 agents), D is tiny — scanning 10 capability descriptions
is trivially fast. At enterprise scale (200 agents), D is massive — scanning 200
capability descriptions, filtering noise, resolving conflicts, verifying availability.
For a simple task (small E), this dominance is immediate. For a complex task
(large E), the amortization delays it.

**This is why the Coordination Tax hits aks-explorer (high session frequency,
many simple tasks) harder than arc (low session frequency, each task is complex).**

---

## The Three Discovery Loops

Every multi-agent interaction contains three nested discovery loops:

### Loop 1: Agent Discovery ("Who can do this?")
Searching capability descriptions, filtering by availability, routing the request.
At 10 agents: trivial. At 200 agents: dominant failure mode.

### Loop 2: Tool Discovery ("What tools does this agent have?")
MCP-style runtime enumeration of available tools, negotiating interfaces.
ToolPro's 96.1% traffic reduction comes from compiling this away.

### Loop 3: State Discovery ("What's the current context?")
Re-reading context files, deriving world state, reconstructing session history.
The Cold Start Tax: 46% of ops spent on this loop alone.

All three loops share a property: they are **repeated identically across sessions**
despite their results being largely stable. The agent roster doesn't change every
minute. Tool interfaces don't change every call. Context structure doesn't change
every heartbeat. Yet every session re-discovers all of them from scratch.

---

## The Resolution: Discovery Compilation

The compilation gradient identifies three stages: behavioral → structural → compiled.
Applied to discovery:

| Stage | Discovery Mode | Example | Cost Pattern |
|-------|---------------|---------|--------------|
| **Behavioral** | LLM searches descriptions at runtime | MCP tool discovery, A2A card scanning | O(n) per request where n = catalogue size |
| **Structural** | Pre-filtered routing tables with runtime resolution | API gateways, service meshes, capability indexes | O(log n) with cached hierarchy |
| **Compiled** | Static dispatch pre-resolved at deploy time | ToolPro programs, compiled capability bindings, pre-bound service graphs | O(1) for known patterns |

**MCP is Stage 1 discovery.** Every tool call re-enumerates the full catalogue.
At small scale this is fine. At enterprise scale, the paper proves it fails.

**The next infrastructure wave will be Stage 3: discovery compilation.**
Pre-resolving what-to-call and where-to-route at deploy/config time,
falling back to runtime discovery only for genuinely novel requests.

### What Discovery Compilation Looks Like

1. **Capability routing tables**: Static mappings from task-type → agent, resolved
   at system configuration time. Only novel task types trigger runtime discovery.

2. **Pre-bound service graphs**: ToolPro-style compiled programs that encode
   known multi-step workflows as single executable units. Discovery happens once
   at compile time, execution happens many times at runtime.

3. **State checkpointing**: Execution-State Capsules (2606.20537) — preserving
   complete execution state (not just KV-cache) so sessions resume rather than
   re-discover.

4. **Event routing compilation**: The enterprise paper's Task Manager (priority
   inference + event merging) is early-stage discovery compilation — pre-classifying
   events so they route directly rather than being discovered-then-routed.

---

## Connection to HN Rejection Discourse

"When I Reject AI Code Even If It Works" (48614631, 102pts 64c) is the same
phenomenon viewed from the human-agent interface:

- **Generation** (doing) is now cheap and fast
- **Discrimination** (finding the right output among many candidates) is the bottleneck
- The author's 5 rejection criteria are a **proto-spec for discrimination compilation**:
  compile human judgment into deterministic quality gates

The enterprise paper proves this at system level. The HN post proves it at
individual level. Both show that **the discrimination/discovery cost now exceeds
the production/execution cost.**

---

## Predictions

1. **Near-term (3 months)**: "Discovery overhead" becomes a named performance
   category in agent benchmark suites, alongside latency and accuracy.

2. **Medium-term (6 months)**: Agent frameworks ship "compiled routing" — static
   dispatch for known patterns, dynamic discovery only for novel requests. The
   ReAct-vs-DAG debate resolves via hybrid: compiled DAG for known workflows,
   ReAct for novel situations.

3. **Long-term (12 months)**: MCP evolves to support "compiled bindings" —
   pre-negotiated tool interfaces cached across sessions. Runtime discovery
   becomes the exception, not the rule. Agent identity (ATProto-style) enables
   persistent capability caching across deployments.

4. **For our system specifically**: Converting the top-5 repeated discovery
   patterns in aks-explorer to compiled routing should reduce session count
   by 30–50% and planning:work ratio from 2:1 to ~0.5:1.

---

## Falsification Conditions

This synthesis would be wrong if:
- Enterprise-scale discovery noise can be solved by better prompts (behavioral fix)
- ToolPro's gains don't hold for heterogeneous tool ecosystems
- The Cold Start Tax is irreducible (no checkpointing helps)
- Complex tasks eventually hit the same discovery wall (amortization thesis is wrong)

---

Sources:
- https://arxiv.org/abs/2606.20058
- https://arxiv.org/abs/2606.19992
- https://arxiv.org/abs/2606.20537
- https://news.ycombinator.com/item?id=48614631
