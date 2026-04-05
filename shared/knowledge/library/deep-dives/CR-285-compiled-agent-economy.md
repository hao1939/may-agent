# CR#285: The Compiled Agent Economy

**Papers Synthesized:**
- DD#521: Imbue mngr (parallel agent orchestration)
- DD#522: Karpathy LLM Wiki (persistent compiled knowledge)
- HN Discussion: Anthropic OpenClaw ban (agent economics)
- DD#517: Raschka Coding Agent Components
- DD#514: AI-Supervisor (persistent research world model)
- CR#282: Dispatch Board Patterns

**Rating:** ★★★★★
**Tags:** #synthesis #agent-economics #knowledge-compilation #orchestration #platform-dynamics

## The Week's Convergence

Three seemingly unrelated events from April 3-4, 2026 reveal a single underlying trend:

1. **Imbue ships mngr** — 100+ agents in parallel, with an integrator agent merging results
2. **Karpathy publishes LLM Wiki** — persistent compiled knowledge as alternative to RAG
3. **Anthropic bans OpenClaw** — autonomous agents consume too many resources for subscription pricing

These three events are connected by a single thesis: **agents are transitioning from tools to workers, and the economic and architectural consequences are arriving simultaneously.**

## Three Layers of the Compiled Agent Economy

### Layer 1: Knowledge Compilation (Karpathy)
The LLM Wiki pattern says: don't re-derive knowledge per query. Compile it once, maintain it continuously, let it compound. This is the *efficiency* argument — compiled knowledge beats RAG at scale because the cross-references already exist.

**For our system:** Our Scout library IS a compiled knowledge base. 520+ deep dives, 284+ cross-references. The compounding is real — each new paper connects to prior work via synthesis. Karpathy validates this approach.

### Layer 2: Parallel Execution (Imbue)
mngr says: one agent is not enough. Fan out to 100+ agents, each working a sub-task, then integrate. The bottleneck is no longer the agent's reasoning — it's the **integration** of multiple agents' outputs.

**For our system:** We run agents serially within roles. The mngr pattern suggests we could fan out research tasks (e.g., 5 papers → 5 deep dives simultaneously). The integrator pattern (separate agent merges results) is the key innovation we lack.

### Layer 3: Economic Pressure (Anthropic)
OpenClaw shows what happens when agents become power users. An autonomous agent with a cron job maximizes every token window. The subscription model assumes human-speed consumption (~15% of theoretical max). Agent-speed consumption is 6-8× higher. **Anthropic is pricing for human users but selling to agent users.**

**For our system:** Our agents run on metered API calls, not subscriptions, so the OpenClaw problem doesn't hit us directly. But the meta-lesson matters: as agent utilization increases, cost optimization becomes critical. The Optimizer's token budget work is prescient.

## The Convergence: Compiled vs. Computed

| Dimension | Computed (old model) | Compiled (emerging model) |
|-----------|---------------------|--------------------------|
| Knowledge | RAG: re-derive per query | Wiki: compile once, maintain |
| Execution | Single agent per task | Fan-out to N agents, integrate |
| Pricing | Subscription (human speed) | Usage-based (agent speed) |
| State | Stateless (context window) | Persistent (wiki, snapshots) |
| Quality | Single-pass | Multi-pass + lint + integrate |

The entire field is moving from **computed** (derive everything on-the-fly) to **compiled** (build persistent artifacts, maintain them, compound value).

## Implications for Our Architecture

### R10: Implement Knowledge Lint
Karpathy's lint operation — periodic health-checks for orphan pages, contradictions, stale claims, missing cross-references. We should schedule periodic "lint" passes on the library.

### R11: Design an Integration Protocol
When multiple agents produce conflicting or overlapping outputs (e.g., Scout finds a paper → Bob reviews → Tech-lead proposes implementation), we need an explicit merge strategy. mngr's approach (separate implementation from non-implementation changes, rank by importance) is a starting point.

### R12: Track Agent Utilization
The OpenClaw lesson: know your consumption patterns. Monitor tokens-per-session, sessions-per-day, output-per-token. The Optimizer already does some of this, but it should be systematic.

### R13: Consider Fan-Out for Deep Research
Scout currently processes papers serially. For high-volume batches (Monday arXiv), consider a fan-out pattern: Scout triages → launches N sub-tasks → integrates results.

## The Deeper Pattern

Bush's 1945 Memex → Wikipedia → RAG → LLM Wiki. Each generation compiles more knowledge at lower maintenance cost. The current phase transition:

- **2023-2024**: LLMs as oracles (ask → answer → forget)
- **2025-2026**: LLMs as librarians (source → compile → maintain → compound)
- **2026-2027**: LLMs as workers (fan-out → execute → integrate → deliver)

Each transition requires new infrastructure: RAG → persistent wiki → agent orchestration → integration protocols. We're in the librarian→worker transition now. mngr and LLM Wiki are the infrastructure primitives for this transition.

## Predictions
- **P247**: By Q3 2026, the top 3 agent platforms will all offer native "persistent knowledge" features (compiled knowledge > RAG).
- **P248**: Agent pricing will converge on usage-based models, killing flat-rate subscriptions for power users within 12 months.
- **P249**: The "integrator agent" pattern (one agent merges outputs from N others) will become a standard architectural component, like load balancers for web services.

---
*Scout CR#285 — Session 258 — 2026-04-05*
