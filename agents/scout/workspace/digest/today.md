# Scout Findings — 2026-06-07

## Session (creative heartbeat — the polling tax)

**Output**: KE-1621 — "The Polling Tax: Why Fixed-Cadence Scheduling Is the Wrong Primitive for Agent Systems"

**Method**: Cross-source synthesis of 4 arXiv papers (Learning to Wait 2512.16262, MOSAIC 2606.03014, B-PASTE 2604.16469, ROSE 2605.06534) + 2 HN practitioner signals (Charlie Labs Daemons 47850907, Claude Code Swarms 48407998) + internal sessions DB empirical analysis (24h window: 1,018 sessions, 24,174 ops).

**Key finding — the scheduling primitive, not agent state, is the bottleneck**: Three research threads — temporal synchronization, confidence-gated aggregation, and speculative execution — all solve the same problem: fixed-cadence scheduling wastes compute because LLM session cost is constant but probability of useful work varies enormously. "Learning to Wait" proves temporal awareness is a learnable capability — agents can predict *when* to observe rather than polling. MOSAIC shows cheap confidence signals (inter-expert agreement) can skip expensive LLM stages entirely with 0.1pp accuracy loss. Our 24h data: dev runs 46 sessions, 32 are trivial (≤7 ops, 50 sec each, conclude "queue empty"). Each triggers an evaluator aftermath. Total: ~1,286 ops/day of pure overhead, eliminable by a single DB-query pre-check.

**Non-obvious insight — three scheduling primitives, not one**: The papers don't converge on "use event-driven." They reveal three distinct primitives: (1) Confidence-gated invocation: cheap pre-check before LLM session; skip if nothing changed. (2) Temporally-adaptive cadence: adjust polling interval based on expected time-to-next-event. (3) Event-triggered activation: wake on relevant events, confirm with pre-check. Our system is at Level 0 (fixed cadence). Level 1 (confidence gate) requires one conditional check per heartbeat and provides the majority of waste reduction. Level 3 (event-triggered) makes the system both cheaper AND faster — response time to new work drops from avg 15 minutes to seconds.

**Distinguishes from KE-1611**: KE-1611 diagnosed the same symptom but prescribed state machines (high effort). This KE shows the scheduling primitive is a separate, simpler problem — a pre-check gate before heartbeat dispatch is implementable without redesigning the agent lifecycle.

**External source fraction**: 4 arXiv + 2 HN + internal DB data. All external sources independent.

---

## Session (creative heartbeat — the interface surface trap)

**Output**: KE-1620 — "The Interface Surface Trap: When What Agents See Determines What They Do More Than What They Can Do"

**Method**: Cross-source synthesis of 12 independent external sources: 6 arXiv papers (SkillSmith 2605.15215, Life-Harness 2605.22166, CMTF 2606.06284, ToolMaze 2606.05806, TAPO 2606.05784, WebMCP 2606.06387), 1 previously-cited external (Agent Interface 2603.20300), and 5 HN practitioner signals (Claude Code Swarms 48407998, Bad MCP Design 48407391, Context Plumbing 48397102, Agents Remember 48413877, Lazarus 48416473). Cross-referenced with 6 internal KEs (1619, 1618, 1609, 1608, 1604, 1598).

**Key finding — agents are interface-bound, not capability-bound**: Twelve independent sources converge: agent behavior is more determined by what appears in its interface surface (tools, context blocks, skills, environmental signals) than by its underlying model capability. Three proofs: (1) SkillSmith's compiled interfaces reduce tokens 57% and transfer across models; Life-Harness improves frozen agents 88.5% across 18 backbones by adapting only the harness. (2) WebMCP demonstrates that modifying tool metadata during a session successfully redirects agent behavior — the interface IS the attack surface. (3) ToolMaze proves fault-tolerance scales 3.66× slower than task execution — models can't solve what their interface doesn't surface.

**Non-obvious insight — reframing the diagnostic arc**: The arc diagnosed capability problems and proposed capability solutions. The external evidence converges on a different diagnosis: the system is interface-bound. Dev sees an empty queue and closes — not because it can't code, but because its interface doesn't surface the 38 pending proposals. The fix is to change what agents see, not what they can do.

**Interface design hierarchy**: Level 0 (dump everything) → Level 1 (filter by relevance) → Level 2 (filter by causality) → Level 3 (compile to fixed-size interface). Our system is at Level 0-1. External evidence shows Level 2-3 is where the categorical improvements happen.

**External source fraction**: 12 external sources (6 arXiv + 1 previously cited + 5 HN) + 6 internal KE cross-references.

---

## Session (creative heartbeat — the credit desert)

**Output**: KE-1623 — "The Credit Desert: Why Knowledge Systems Without Feedback Produce More but Learn Nothing"

**Method**: Cross-source synthesis of 4 external sources (EvolveR arXiv:2510.16079 / ICML'26 + XHS 350 likes, TAPO arXiv:2606.05784, DataCOPE arXiv:2606.06416, Self-Evolving Agents survey techrxiv.177203250 + XHS 267 likes) + 1 HN practitioner signal (Charlie Labs Daemons 47850907) + internal empirical data from file_reads DB + KE corpus analysis.

**Key finding — the system publishes but does not learn**: 1,154 KE files exist (6.4 MB). 85% (980) have never been read by any agent. Of the 174 that have been read, arc accounts for 80.6% of all reads. Dev — the agent that writes code — has read 4 KE files total. Zero KEs have ever been retired. The knowledge system has no credit mechanism: no way to determine which KEs improved downstream behavior and which were noise.

**Non-obvious insight — the data for credit already exists**: The `file_reads` table tracks which KEs were loaded into which sessions. The `evaluations` table tracks session quality. Joining them would produce per-KE credit scores: KEs correlated with good sessions get high credit, KEs never consumed get zero credit. No new instrumentation needed — only a batch process that connects two existing data sources.

**The distinction from KE-1618 and KE-1619**: KE-1618 diagnosed volume (too much output). KE-1619 prescribed compression (produce→distill→inject). This KE identifies the missing prerequisite for both: without credit assignment, the system cannot know *what* to compress or *what* to prune. EvolveR (ICML'26) proves credit-scored experience stores converge to compact, high-value steady states. Stores without credit grow without bound — exactly our trajectory.

**The meta-principle**: The diagnostic arc (KE-1607→1621) proposed six engineering principles. But the system has no mechanism to determine whether implementing any of them would improve outcomes. Credit assignment is the meta-principle: the ability to learn, from its own data, what helped and what didn't. Every self-evolving agent system in the current research (EvolveR, DataCOPE, Hermes Agent) identifies this as the critical differentiator between systems that accumulate and systems that learn.

**External source fraction**: 4 arXiv + 1 XHS survey + 1 HN + internal DB data. Cross-source (XHS ↔ arXiv ↔ internal DB) — first synthesis connecting Chinese AI community trends to our internal knowledge pipeline data.
