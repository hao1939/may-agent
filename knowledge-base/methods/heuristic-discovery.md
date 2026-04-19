# Heuristic Discovery — How to Find New Ideas

> Systematic methods for generating novel insights from existing knowledge.

## The Five Generators

### 1. 🔴 Contradiction Mining
**Method**: Find two established findings that conflict. The resolution space between them contains new ideas.

**Process**:
1. Pick any two topic pages from the INDEX
2. Read their "Key Findings" sections
3. Look for claims that can't both be true simultaneously
4. Ask: "Under what conditions is A true? Under what conditions is B true?"
5. The boundary condition is your insight

**Example**: Safety says "close all loops" + Learning says "open all loops" → Insight: **Verified learning channels** — loops that are open to information but closed to manipulation.

**Where to look**: The ⚡ (tension) links in the relationship matrix are pre-identified contradictions.

---

### 2. 🔄 Scale Shift
**Method**: Take any finding and change the scale by 10× in either direction.

**Process**:
1. Pick a finding (e.g., "optimal team size is 3-7 agents")
2. Ask: "What if we had 70 agents? What breaks?"
3. Ask: "What if we had 1 agent with 7 sub-processes? What changes?"
4. The failure modes at different scales reveal architectural constraints

**Example**: "Cheap signals beat expensive analysis" (Law #7) at 10× scale → Do cheap signals still win when you have 1000 signals? Or does signal noise become the bottleneck? → Insight: **Signal aggregation** is the hidden scaling problem.

---

### 3. 🌉 Domain Transfer (Analogy)
**Method**: Take a solved problem from one domain and map it to an unsolved problem in another.

**Process**:
1. Identify a pattern in topic A (e.g., "Memory OS" from Knowledge Management)
2. List its structural properties (layers, interfaces, failure modes)
3. Find an unsolved problem in topic B that has similar structure
4. Map the solution from A → B, noting where the analogy breaks
5. The breakpoints are where new theory is needed

**Example**: Operating system virtual memory → Agent context management. Page faults → retrieval failures. Memory protection rings → access control tiers for shared state.

**Rich analogy sources**: Biology (immune systems, evolution), Economics (markets, auctions), Distributed systems (consensus, fault tolerance), Compiler theory (optimization passes)

---

### 4. ⊘ Negation / Inversion
**Method**: Take a core assumption and flip it. See what world that implies.

**Process**:
1. List the assumptions behind a finding
2. Negate the most fundamental one
3. Ask: "In a world where this is false, what would we observe?"
4. Check: do we ever observe that? If yes, you've found a boundary condition.

**Example**: 
- Assumption: "Communication overhead is always negative" (Law #1)
- Negation: "Communication overhead can be positive"
- Implies: Some communication *creates* value beyond its cost
- Check: Yes — consensus-building communication in high-stakes decisions. → Insight: **Communication has a phase transition** from overhead to value-creation depending on decision stakes.

---

### 5. 🔁 Temporal Inversion (Feedback Loops)
**Method**: For any causal claim "X → Y", ask "does Y → X also hold?"

**Process**:
1. Find a causal finding (e.g., "poor evaluation → poor training → poor models")
2. Ask the reverse: "poor models → poor evaluation?"  
3. If yes, you've found a feedback loop. Feedback loops are where small interventions have large effects.
4. Find the point in the loop with the highest leverage.

**Example**: "Evaluation quality determines reasoning ceiling" + "Reasoning quality determines evaluation capability" = **Co-evolution loop**. Break in: evaluation, because it's cheaper to improve than reasoning.

---

## The Deep Dive Protocol

When you've found an interesting thread, go deep:

```
1. SKIM      → Read the topic page + 2-3 source papers (30 min)
                Goal: understand the landscape
                
2. CONTEXT   → Read related topic pages, follow cross-links (30 min)
                Goal: understand what connects to this
                
3. CHALLENGE → Apply negation + scale shift to key claims (30 min)
                Goal: find the weak points
                
4. SYNTHESIZE → Write a 1-page synthesis connecting your findings (30 min)
                Goal: crystallize your insight
                
5. TEST      → Design an experiment or find existing evidence (flexible)
                Goal: move from hypothesis to testable prediction
```

### Idea Maturity Pipeline

Every idea in this KB sits somewhere on this pipeline:

```
Observation → Hypothesis → Mechanism → Prediction → Experiment → Law
     🔍           💡           ⚙️           📊          🧪         📜
```

- **Observation** 🔍: "We noticed X happens"
- **Hypothesis** 💡: "We think X happens because of Y"
- **Mechanism** ⚙️: "Here's the causal chain: Y → Z → X"
- **Prediction** 📊: "If the mechanism is right, then we should also see W"
- **Experiment** 🧪: "We tested for W and found..."
- **Law** 📜: "X is a reliable phenomenon caused by Y via Z, validated by W"

Track where your ideas sit. Push them forward.

---

## Applying This to Our System

Our own agent system is both a research subject and a testbed:

| Research Finding | Our System Implication | Status |
|---|---|---|
| Abstraction Gate (Law #18) | Memory redesign Phase 1 | 🧪 In progress |
| Cheap Signals Win (Law #7) | Use simple rules in QA before LLM analysis | 📊 Prediction |
| Diversity Survival | Enforce strategy diversity across agents | 💡 Hypothesis |
| Dual-Speed Safety | Fast/slow QA layers | 📊 Ready to test |
| Scaling Inversion (Law #13) | Our 10-agent system may be near optimal N* | 🔍 Observation |
