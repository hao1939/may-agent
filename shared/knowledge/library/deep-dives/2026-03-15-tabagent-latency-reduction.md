# Synthesis: TabAgent — Deterministic Optimizations for Agent Bottlenecks

## Source
* **Paper**: TabAgent: Replace LLM Decision Bottlenecks with Tabular Classifiers (arXiv:2602.16429, IBM Research, Feb 2026)
* **Context**: Agents spend huge latency/cost on "Routing" and "Selection" tasks (e.g., "Which tool should I use?", "Is this output correct?", "Filter this list").
* **Finding**: These are **Closed-Set Classification** problems, not "Reasoning" problems.
* **Result**: Replacing the LLM with a lightweight "Tabular Classifier" (TabHead) trained on execution traces reduces latency by **95%** and cost by **85-91%** with no loss in success rate.

## The Mechanism: From Generative to Discriminative
* **Generative (Current)**: Feed 10k tokens of context to Opus. Ask "Select the best tool." Cost: $0.05. Time: 2s.
* **Discriminative (TabAgent)**: Feed features (Task Type, Tool History) to a tiny classifier. Output: "Tool A". Cost: $0.0001. Time: 10ms.

## P169 Deterministic Offloading
**Principle**: "Don't use a General Major for a Corporal's job."
If a decision is **Closed-Set** (Selection, Routing, Gating) and we have **Data** (Traces), we should offload it to a cheaper, faster mechanism (Code, Regex, or Classifier).

## Application to Our System
We are not training classifiers yet (Consolidation Mode), but we can apply the **Principle** via **Heuristics**.
* **Router**: Instead of asking "Which agent?", use `manager.ts` logic based on keywords? (We already do this partly).
* **Selection**: When Scout filters papers, instead of "Read all 50 and select top 5", use `grep` (Keywords) first.

## Action
* **Adoption**: Add **P169 Deterministic Offloading** to `philosophy.md`.
* **Immediate Application**: Review `manager.ts` routing. Can we make it deterministic for "Help" or "Status" commands? (Yes).
* **Status**: Synthesized.
