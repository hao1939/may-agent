# KE-087: Agent Infrastructure Primitives — The Stack Between Model and Task

**Created:** 2026-04-09
**Sources:** DD-471, DD-554, DD-558, DD-577, CR-307, CR-309
**Status:** Active

## Core Insight

Six independent research threads converge on a unifying framework: between the LLM model and the task outcome lies a **rich infrastructure stack** of primitives that determine agent effectiveness. These primitives operate at different layers but interact multiplicatively — optimizing one layer without addressing others yields diminishing returns.

## The Agent Infrastructure Stack

### Layer 1: Execution Environment (Sandbox)
**DD-554 (Freestyle Sandboxes)**: <700ms VM startup, live forking, pause/resume, persistent VMs. Implements harness engineering patterns as commodity infrastructure. Fork-and-merge enables parallel agent execution from shared state. Session lifecycle management creates natural bounded-iteration cycles.

**Key insight**: The execution environment is being commoditized. Multiple vendors (Freestyle, E2B, Daytona, Gitpod) converge on identical patterns. Research question shifts from "how to build" to "how to optimize."

### Layer 2: Communication Encoding
**DD-558 (Caveman Token Compression)**: 75% output token reduction through pidgin encoding. Operates at L2 of the communication stack — AFTER reasoning, preserving depth while reducing verbosity. Key finding: forced conciseness may actually improve quality (implicit regularizer against attention diffusion). Multi-agent compound effect: N agents × M rounds × 75% compression = massive cost/latency savings.

**Key insight**: Agent communication protocols have an encoding layer that was previously invisible. Making this explicit opens a new optimization dimension that compounds across agents.

### Layer 3: Knowledge Representation
**DD-577 (Graphify)**: Code-to-knowledge-graph with 71.5× token reduction. Structural representation enables richer queries than flat text. Knowledge graphs as agent "skill" modules that can be composed and queried.

**Key insight**: The representation format of agent knowledge is itself an infrastructure choice with orders-of-magnitude impact on context efficiency.

### Layer 4: Experience Extraction
**CR-307 (Decoction Architecture)**: Unified framework for extracting, compressing, and serving past experience as future context. Experience → distilled principles → context injection. The "decoction" metaphor: raw experience is boiled down to concentrated wisdom.

**DD-471 (obra/superpowers)**: Skills-as-context-engineering — curated skill modules that inject expert patterns into agent prompts. 125K stars validates the skills-as-infrastructure pattern. Skills are experience crystallized into reusable form.

**Key insight**: Experience extraction is the bridge between agent memory and agent capability. Without it, agents repeat mistakes; with it, they compound learning across sessions.

### Layer 5: Capability Boundaries
**CR-309 (Agent Capability Boundary)**: Systematic analysis of where code agents break. Identifies the frontier between tasks agents can handle autonomously and those requiring human intervention. The boundary is not a fixed line but a function of infrastructure quality — better infrastructure pushes the boundary outward.

**Key insight**: The capability boundary is the ultimate measure of infrastructure quality. Each infrastructure layer extends it in a different direction.

## Cross-Layer Interactions

1. **Sandbox × Communication**: Faster VMs + compressed output = tighter feedback loops. The combination is multiplicative, not additive.
2. **Knowledge × Experience**: Knowledge graphs (DD-577) provide structure; experience extraction (CR-307) provides content. Together they enable precise retrieval of relevant past experience.
3. **Communication × Capability**: Token compression (DD-558) directly extends capability boundaries by fitting more task-relevant context within fixed context windows.
4. **Experience × Capability**: Skills-as-context (DD-471) push capability boundaries by injecting expert patterns that compensate for model limitations.

## Tension: Commoditization vs. Optimization

Infrastructure primitives face a lifecycle tension:
- **Early stage**: Build the primitive (research question: "how?")
- **Middle stage**: Commoditize the primitive (market question: "who provides it?")
- **Late stage**: Optimize the composition (engineering question: "how to stack primitives for maximum compound effect?")

Sandbox infrastructure is at late commoditization (DD-554). Token compression is at early commoditization (DD-558). Knowledge graphs and experience extraction are still in the research stage. This staggered maturity creates integration gaps — the most mature layers are limited by the least mature layers they depend on.

## Actionable Finding

**The L2 encoding layer is the highest-ROI optimization currently available.** Token compression (DD-558) is simple to implement, compounds across agents, and doesn't require model changes. Implementing Caveman-style compression for inter-agent communication could yield 4× cost/latency reduction with minimal quality risk.

## Extends
- **KE-085**: Harness Engineering Field Crystallization (infrastructure as harness component)
- **KE-047**: Harness architecture (infrastructure layer below harness)
- **KE-082**: Reasoning dropout (L2 compression must not bleed into reasoning)
- **KE-086**: MAS Architecture Scaling (infrastructure determines scaling ceiling)
