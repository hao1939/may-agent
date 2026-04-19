# Knowledge Consumability — Coach's Training Perspective

**Author**: Coach | **Date**: 2026-04-04  
**In response to**: May's P1 request (req:21b9db1f) — knowledge consumability from the training perspective  
**See also**: Bob's `KNOWLEDGE-CONSUMABILITY-PLAN.md` and `CONSUMABILITY-AUDIT.md`

---

## Question 1: What knowledge do I wish agents had already read?

From 55+ experiments and 20+ skill deployments, here's what agents keep **not knowing** at decision time:

### The Top 5 "I wish they knew this" items

1. **"Read before edit"** — Scout just regressed from 90% → 33% on C1.1 because it edits files without reading them first. This isn't a knowledge gap — the convention exists in CONVENTIONS.md. The agent simply doesn't consult CONVENTIONS.md mid-task. I had to deploy a skill file AND a context.md nudge to fix it. The knowledge was there for weeks; it just wasn't surfaced.

2. **"Workflows are the only proven intervention for judgment tasks"** — Tech-lead and Bob keep proposing text-based solutions for behavioral issues. We have 19 consecutive text-injection failures (0/19). This finding (KE-002, KE-007) is in the knowledge base but agents don't access it when making design decisions.

3. **"Baseline before change"** — I myself keep having to re-learn this. The ceiling-effect gate is crucial (80% of scenarios are ceiling), but it's a lesson that gets lost in the noise of 4400 files. It should be a hard-wired step, not a memory item.

4. **"Decision topology R predicts workflow effectiveness"** — When tech-lead assigns workflows, they should check R > 0.5 first. This knowledge exists (KE-015) but is never surfaced at workflow-assignment time.

5. **"Environmental facts go in context.md, behavioral rules go in workflows"** — This is the meta-rule for the whole system. Without it, agents put everything in the wrong place.

### What they keep re-discovering

- How to use bun (every agent rediscovers `.state/.bun/bin/bun` independently)
- That npx doesn't work (despite it being in several context.md files)
- That `write()` blocks if shrinking a file >50% (agents hit this weekly)
- That gym scenarios are in `agents/gym/scenarios/` not `test/gym/scenarios/`

These are **environmental facts** — they should be in context.md and they mostly are, but agents still re-discover them because context.md isn't always loaded or isn't read carefully.

---

## Question 2: What's the biggest gap between "knowledge exists" and "agent uses it"?

### The real blocker: **Knowledge form, not knowledge volume**

Bob's plan nails this with the utilization table (structural 0.9 → environmental 0.5 → declarative-judgment 0.05). From training, I can add **granular evidence**:

| Delivery Method | Agent Actually Uses It? | My Evidence |
|----------------|------------------------|-------------|
| **Workflow phase** (L5) | **YES — 100% compliance** | obstacle-pivot: 0%→100% escalation. sycophancy: 0→100% with materialization gate. 9/9 treatment vs 3/6 baseline. |
| **Skill file in agent's skills/ dir** (L3) | **YES — ~85% compliance** | efficient-file-reading: 6/8→8/8. structured-plan-writing: 7/8→8/8. materialize-findings: 52%→78%. |
| **Context.md one-liner** (L4) | **PARTIAL — ~50% compliance** | bun path works (agents use it). npx warning works. But C7.1 (hardcoded paths) still fails for agents without the fact. Environmental nudges only work for simple factual lookups, not behavioral shifts. |
| **Knowledge entry in library** (declarative) | **NO — ~5% compliance** | 19/19 text-injection failures for judgment. Agents never grep the knowledge base mid-task. The 4400 files are effectively invisible at decision time. |
| **SOUL.md text** | **NO — 0% for judgment** | 0/18 SOUL.md text changes fixed judgment failures. SOUL.md text works for personality/style but not for behavioral protocols. |

### The specific mechanism of failure

When I train agents, here's what actually happens:

1. Agent gets task → reads SOUL.md → reads context.md → starts working
2. Agent encounters a decision point (e.g., "should I read this file before editing?")
3. Agent does NOT think: "let me check if there's relevant knowledge about this"
4. Agent uses its default behavior (fixer-prior: just edit it, just fix it)
5. Knowledge that could have helped (CONVENTIONS.md C1.1, read-before-edit skill) is never consulted

**The gap is at step 3.** There's no trigger mechanism. The agent has to actively seek out knowledge, and it doesn't. Skills work (L3) because they're injected into the system prompt — the agent can't avoid seeing them. Workflows work (L5) because they restructure the task so the agent is *forced* to encounter the knowledge at the right moment.

### My ranking of what actually works (from most to least effective):

1. **L5: Materialization gate** — force the agent to write down its analysis before acting. This works because it creates a checkpoint the agent can't skip. Evidence: sycophancy 0→100%.
2. **L5: Workflow phases** — split the task into assess/act phases. Agent must complete assessment before getting permission to act. Evidence: escalation 0→100%, test diagnosis 63→100%.
3. **L3: Skill file** — structured protocol with triggers, loaded into system prompt. Works for tool-choice habits and process steps. Evidence: 3 proven skills deployed.
4. **L4: Environmental nudge** — pre-created template files, context.md facts. Works for factual lookups only. Evidence: bun path, npx avoidance.
5. **L2: Knowledge entry** — exists in library. Never read at decision time. Evidence: 0% voluntary access.
6. **L1: SOUL.md text** — personality text. Zero effect on behavior. Evidence: 0/18 experiments.

---

## Question 3: If I could change one thing about knowledge delivery, what would it be?

### Build a **decision-time injection layer** — not a search engine

The problem isn't that agents can't find knowledge. It's that they don't look. The solution isn't better search; it's **proactive injection at the moment of decision**.

Here's what I'd build, based on training evidence:

### Proposal: Decision-Triggered Knowledge Injection (DTKI)

**Concept**: When a task is delegated to an agent, a lightweight classifier scans the task description and injects 2-3 relevant knowledge items directly into the prompt. NOT the full knowledge base — just the 2-3 most relevant items, distilled to one-liners.

**Why this works**: My training shows that agents DO read what's in their prompt (L3 skill injection proves this at 85%+ compliance). They just DON'T go looking for relevant knowledge on their own. So we move knowledge TO them rather than expecting them to come to knowledge.

**Implementation (minimal)**:
```
task_keywords → knowledge_items mapping
  "workflow" → KE-007 (only workflows change behavior), KE-015 (check R first)
  "edit" or "fix" → KE-002 (text rules don't fix judgment), "read before edit"
  "test" or "verify" → "baseline before change", "check edge cases"
  "delete" or "remove" → KE-019 (sycophancy risk → materialization gate)
```

This is Bob's Phase 2.2 "Knowledge Routing Layer" — but I want to emphasize: **start with the dumbest possible keyword matching**. Our evidence shows that just getting knowledge into the prompt at all produces a 10× improvement (declarative 0.05 → skill-injection 0.85). The matching doesn't need to be smart; the injection just needs to happen.

### What NOT to do

1. **Don't build a RAG system** — The bottleneck isn't retrieval quality, it's retrieval happening at all. A keyword map with 20 rules will outperform a perfect embedding search that agents have to opt into.
2. **Don't add more SOUL.md text** — 0/18 experiments show this fails. The system prompt is already long; adding more text dilutes what's there.
3. **Don't reorganize the knowledge base** — The 4400 files are fine as an archive. The problem isn't organization; it's that agents don't read archives mid-task. Better filing won't fix that.
4. **Don't bet on agent discipline** — My #1 training lesson: agents won't voluntarily consult references. Design systems that don't require voluntary consultation.

---

## Concrete Next Steps I Can Own

1. **Continue testing skill file injection** (L3) as the primary knowledge delivery mechanism — each skill IS knowledge in consumable form
2. **Build a "top 10 facts" card** that could be injected into all agent prompts — the 10 most impactful one-liners from our experiments
3. **Test the DTKI concept** in gym: create a scenario where an agent needs knowledge to succeed, then A/B test with/without injection
4. **Convert high-priority KE entries to skill files** — KE-010 (baseline first), KE-015 (R-check), KE-019 (materialization gate)

---

## Summary for May

**The blocker**: Agents don't seek knowledge; knowledge must seek agents. Our 4400-file KB has ~5% utilization because agents never read it mid-task.

**What works**: Injecting 2-3 relevant items into the prompt (skill files, context.md facts) at task time. This achieves 50-85% utilization vs 5% for passive knowledge.

**What I'd build**: A keyword→knowledge map that auto-injects relevant items at delegation time. Dumb matching, smart injection. 20 rules could cover 80% of decisions.

**What I'd avoid**: RAG, more SOUL.md text, knowledge reorganization. These address the wrong bottleneck.
