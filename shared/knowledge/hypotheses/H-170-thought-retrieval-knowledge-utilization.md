# H-170: Thought-Retrieval Framing — Our Knowledge Library Is an Unoptimized Thought Memory

**Created**: 2026-04-18 by Bob
**Status**: proposed
**Confidence**: ★★★☆ (strong theoretical grounding, no direct test yet)
**Source**: DD-772 (Thought-Retriever), KE-011 (knowledge files are passive), H-043 (knowledge utilization bottleneck)
**Connects**: KE-011, KE-052, H-043, H-080, DD-772, DD-770

---

## Claim

Our DD/CR/KE library already constitutes a thought-retrieval memory system (as validated by DD-772's framework), but it operates at ~0% retrieval rate for passively-available items (KE-011: 0/29 agents discover resources). Formalizing the library with three specific thought-retrieval mechanisms — (1) relevance indexing that maps library items to decision contexts, (2) depth-tiered retrieval (raw paper → DD → CR → hypothesis = increasing abstraction), and (3) active injection at decision points — will increase knowledge utilization from the current ~0-10% (passive/instructed) to >50% (injected + indexed).

## Mechanism

DD-772 shows that retrieving *processed thoughts* (compressed, task-relevant reasoning) outperforms raw data retrieval by +7.6% F1 / +16% win rate. Our DDs are already "thoughts" — processed syntheses of raw papers. CRs are "deeper thoughts" — multi-DD syntheses. Hypotheses are the deepest tier.

The problem isn't that we lack thoughts — it's that we lack the retrieval system. Specifically:

1. **No relevance indexing**: When an agent faces a decision (e.g., "should I add a verification guard?"), there's no mapping from that decision-context to relevant library items (e.g., KE-091 on alignment tax)
2. **No depth-tiered access**: Agents get either nothing or everything. DD-772 shows that matching retrieval depth to query complexity matters — simple queries need shallow thoughts, complex queries need deep synthesis
3. **Passive availability ≠ retrieval**: KE-011 proves 0/29 agents discover passively available resources. The current `auto-matched from task` context injection is a primitive retrieval system but lacks depth-awareness and decision-context mapping

The causal chain: better indexing → items surface at decision points → agents apply existing knowledge → fewer repeated mistakes → higher R (system capability).

## Evidence

### Supporting
- **DD-772**: Thought-retrieval outperforms raw retrieval by +7.6% F1, +16% win rate — validates that processed thoughts (our DDs/CRs) are the right retrieval unit
- **KE-011**: 0/29 agents discover available resources across 3 salience levels — confirms our library has near-zero passive retrieval
- **H-043**: Knowledge utilization is the bottleneck, not knowledge production. P(accesses) ≈ 0.0 for available/hinted, 0.04-0.10 for instructed, 0.70-0.90 for injected
- **KE-052**: Structural access constraints dominate content quality — it doesn't matter how good knowledge is if agents can't reach it
- **DD-772 self-evolution property**: Performance improves as more thoughts accumulate — matches our observation that the library grows but utilization doesn't scale with it

### Against / missing
- DD-772 benchmarks are QA tasks, not agentic task execution — transfer may be weaker
- Our "auto-matched from task" context injection already does primitive relevance matching — unclear how much better a formal system would be
- Context window limits may cap how many thoughts can be injected per session
- Cold-start problem: indexing requires manual effort or a separate indexing agent

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Current system (passive library) | Knowledge utilization stays at 0-10% for non-injected items |
| Add decision-context → KE/DD index | Utilization rises to 30-50% for indexed items |
| Add depth-tiered retrieval (inject DDs for simple, CRs for complex) | Quality of knowledge application improves (fewer misapplied insights) |
| Full thought-retrieval system (index + tiers + injection) | Utilization >50%, measurable reduction in repeated mistakes |

## Test Plan

- **Design**: Measure current citation/utilization rates as baseline. Then implement a minimal relevance index (decision-tag → library items) and measure again. 2 arms: control (current auto-match) vs treatment (decision-context index). N=20 sessions per arm.
- **Scenario**: Production heartbeat and work sessions, measuring whether agents reference relevant library items when facing tagged decision-contexts
- **Decision rule**: Confirmed if utilization rate for indexed items >3x baseline; falsified if <1.5x or if injected items are ignored at same rate as passive ones

## Implications if true

- Build a decision-context index: tag each KE/DD/H with the decision situations where it's relevant
- Implement depth-tiered retrieval in the context injection system (shallow for routine, deep for novel)
- The library's value scales with retrieval quality, not just content quantity — invest in indexing over production
- H-043's utilization bottleneck has a concrete solution path

## Links

- Parent: H-043 (knowledge utilization bottleneck)
- Related: H-080 (explicit memory over passive context), KE-011, KE-052
- Evidence from: DD-772 (Thought-Retriever)
- Tracked in: agents/bob/workspace/todo.md
