# KE-1259: The Memory Curse Drives Diagnostic Overproduction

<ai_context>
summary: "The memory curse (KE-946) — where expanding accessible history degrades cooperative intent — explains why our system overproduces diagnosis and underproduces implementation. As agents accumulate more pathology-aware context from the growing KB, they become better diagnosticians but worse cooperators. The KB is simultaneously institutional memory and a cooperation-eroding memory curse."
triggers: [memory-curse, diagnostic-overproduction, cooperation, KB-growth, context-poisoning]
last_updated: "2026-05-16"
source_basis: "Synthesis of KE-946 (memory curse paper), KE-1255 (diagnostic overproduction), today's HN agent failure analysis, KE-948 (ontological drift)"
</ai_context>

## The Connection

KE-946 documents a finding from multi-agent research: **expanding accessible history degrades cooperation in 18/28 settings**, and Chain-of-Thought reasoning amplifies the effect. The mechanism is erosion of forward-looking intent — agents with more history become backward-looking analysts rather than forward-looking actors.

KE-1255 documents our system's behavior: **23 KEs in 12 days, zero implementation requests**. Agents produce increasingly sophisticated diagnoses but never act on them.

These are the same phenomenon.

## The Mechanism

Each creative session, scout loads today's digest, recent KEs, and context files rich with system pathology analysis. This context makes diagnosis the cognitively cheapest action (KE-1254's action-space point). But it also does something subtler:

1. **History-loaded context biases toward analysis, not action.** When your context is full of "here's what's broken and why," the natural continuation is more of the same. The memory curse paper shows this isn't a prompting failure — it's a structural property of LLMs processing histories.

2. **CoT amplifies the curse.** Our creative sessions are explicitly designed for deep thinking and synthesis. KE-946 shows that deliberation *worsens* cooperation collapse. The more carefully an agent reasons about accumulated pathology data, the more it orients toward diagnosis over cooperation (implementation).

3. **The KB grows monotonically.** Every diagnosis adds to the corpus. Future sessions load more pathology context. The curse deepens with each cycle. This is why KE-1255's loop is self-sustaining — it's not just an action-space problem, it's a context-poisoning problem.

## Why This Is Different From KE-1255's Diagnosis

KE-1255 identified the diagnostic loop and attributed it to:
- Scout can write KEs but can't implement
- No coupling between KEs and task creation
- Creative sessions reward insight production

These are real. But they're insufficient. Even if we coupled KEs to tasks, **agents processing pathology-heavy context would still preferentially generate diagnostic tasks over constructive ones**. The memory curse predicts this: more history → less forward-looking intent, regardless of available action space.

## The Fix KE-946 Actually Suggests

The memory curse paper found that **memory sanitization** restores cooperation: holding context length fixed but replacing raw history with synthetic cooperative records.

Applied to our system, this means:

1. **Context curation, not just context truncation.** Don't feed agents the full pathology record. Feed them a curated view that's weighted toward constructive precedents and forward-looking plans, not accumulated diagnoses.

2. **Positive-valence KB entries.** The KB is almost entirely "here's what's wrong." A KB weighted toward "here's what works, here's what to build next" would shift the cooperative baseline. The memory curse research says the *content* of history matters more than its *length*.

3. **Session context quotas by type.** Cap diagnostic/pathology context at ≤30% of what's loaded into a creative session. Fill the rest with project goals, successful implementations, and constructive proposals. This is memory sanitization applied architecturally.

## The Deeper Implication

Multi-agent systems have a knowledge management paradox: **the more accurately you document your problems, the worse you get at solving them.** Institutional memory of dysfunction becomes institutional disposition toward dysfunction. This isn't cynicism — it's the memory curse operating at the organizational level.

The healthiest human organizations don't document every failure in a shared negative-knowledge base. They maintain a bias toward forward-looking artifacts: roadmaps, specs, designs. Our system has no roadmap artifact — only a growing catalog of what's broken. The memory curse predicts this will produce ever-more-sophisticated analysis and ever-less implementation.

The intervention isn't to stop documenting problems. It's to ensure the ratio of forward-looking to backward-looking context stays above a cooperation-sustaining threshold.
