# What We Know About: Capability Delivery — Push vs Pull in Agent Systems

> **Synthesis** — why agents never self-discover capabilities, what delivery mechanisms actually work, the breakthrough of few-shot delivery, and the design implications for every new feature we build.
> Created: 2026-04-05 | Updated: 2026-04-09 | Author: Bob (Architect)
> Sources: EXP-028, EXP-030, EXP-031b, EXP-084–094, KE-020, KE-011, KE-002, KE-007, KE-059–065, H-053, H-091, DD#522 (Karpathy Wiki), DD#523 (CORAL), DD#527 (Skyvern Self-QA), CR#287, WKWA-006

---

## Executive Summary

The strongest null result in our knowledge base: **0/29 agents spontaneously discovered available resources across three resource types, three salience levels, and three independent experiments.** Agents do not pull capabilities — capabilities must be pushed. This is not a fixable information architecture problem; it's a fundamental property of how LLMs execute tasks. Every capability we build needs a corresponding delivery mechanism, and the choice of mechanism determines whether adoption is 0%, 5%, or 100%.

**April 2026 Update**: The discovery of few-shot worked examples (WKWA-006) has filled the critical gap between T3 (instructed, 4-10%) and T4 (injected, 70-90%). A domain-matched worked example injected into context achieves **100% adoption on 18/18 judgment and process-discipline scenarios** — T4-level results with T3-level implementation cost. This is the T3.5 tier that Section 7 originally flagged as an open question. The pull model remains dead, but *what we push* now has a dramatically more effective option.

---

## 1. The Evidence: Zero Spontaneous Discovery

| Experiment | Resource Type | Hint Mechanism | Discovery Rate | N |
|-----------|--------------|---------------|---------------|---|
| EXP-028 | Workflows | Tool list (always visible) | 0/21 (0%) | 21 |
| EXP-030 | Skills (LIBRARY.md) | Common-sense.md nudge | 0/6 (0%) | 6 |
| EXP-031b | Scripts | Explicit task-text hint | 0/2 (0%) | 2 |
| **Combined** | **All types** | **All levels** | **0/29 (0%)** | **29** |

95% CI upper bound at 0/29: ~10%. This is as close to a universal null as we'll get.

**Key detail from EXP-031b**: The task text *explicitly said* "Check `scripts/` for debugging tools." The agent saw scripts in `find` output but never opened the directory. Even the highest salience hint below "primary instructions" is ignored.

---

## 2. The Mechanism: Cognitive Tunnel Vision

When an agent receives a task, it enters **direct action mode**:

1. **Orient** — `find . -type f` or `ls` to see what exists
2. **Read** — Open source files relevant to the task
3. **Analyze** — Identify the problem
4. **Fix** — Write the solution
5. **Verify** — Run tests

There is no "preparation" step. No "what tools are available?" No "is there a reference guide?" The agent's policy strongly favors **exploitation** (immediate task progress) over **exploration** (checking for helper resources). This is rational: preparatory research is speculative, while direct action makes guaranteed progress.

This is the same mechanism as DD#525 (goal drift): the agent's **trained problem-solving strategy overrides task-time instructions**. Just as trained safety values override "skip validation" instructions, the trained "read code → fix" strategy overrides "check scripts first" instructions.

---

## 3. The Delivery Hierarchy

Six tiers of capability delivery (updated April 2026 with T3.5):

| Tier | Mechanism | Adoption Rate | Persistence | Example |
|------|-----------|--------------|-------------|---------|
| **T1: Available** | Resource exists somewhere in filesystem | ~0% | Never | Workflows in workflows/ dir (EXP-028) |
| **T2: Hinted** | Text mentions the resource exists | ~0% | Never | Common-sense.md nudge (EXP-030) |
| **T3: Instructed** | Primary instructions (heartbeat) say "use X" | 4-10% (decaying) | 7d half-life | Coach workflow instructions (EXP-020) |
| **T3.5: Few-Shot** | Domain-matched worked example injected into context | **100% (matched)** | Stable if always injected | Judgment/process skill examples (EXP-084–094) |
| **T4: Injected** | Resource content loaded into system prompt | 70-90% | Stable if always injected | Working skills (verify-after-edit) |
| **T5: Automatic** | Infrastructure selects and routes | 100% | Permanent | Workflow called by cron handler |

### The Two Critical Gaps (One Now Bridged)

**Gap 1: T2→T3 (0% → 4-10%).** The transition from "mentioned somewhere" to "in primary instructions" creates the first non-zero adoption. The heartbeat is the only text the agent reliably reads as actionable instruction. *Unchanged.*

**Gap 2: T3→T4 (4-10% → 70-90%) — NOW BRIDGED BY T3.5.** This was the gap that determined whether a skill actually got applied. Few-shot worked examples (T3.5) now fill this gap: a ~200-line worked example injected alongside task context achieves 100% adoption on judgment and process discipline skills. Critically, T3.5 achieves T4-level results while being *simpler to create* — it's a text artifact, not a prompt engineering change.

**The T3.5 advantage**: T3.5 outperforms T4 (generic injection, 70-90%) on judgment skills because it provides *procedural knowledge* (how to reason about the problem) rather than *declarative knowledge* (what the right answer is). Generic injected content tells the agent what to do; a worked example shows it how. See WKWA-006 Section 3 for the mechanism.

**T3.5 boundaries**: Few-shot delivery does NOT work for temporal discipline (tool-call sequencing, -20pp on EXP-093) or cross-domain hard scenarios (0/3 on EXP-094). For these, T5 workflow enforcement remains necessary. See WKWA-006 Sections 4.1–4.3 for boundary details.

### External Validation

- **DD#527 (Skyvern)**: Built self-QA as a 700-line prompt injected as a workflow step (T5), not as a suggestion. Result: 30%→70% one-shot PRs.
- **DD#523 (CORAL)**: Multi-agent system uses heartbeat-based forced interventions to make agents check shared memory. Without interventions, agents ignore shared workspace entirely.
- **DD#522 (Karpathy Wiki)**: The LLM Wiki works because operations are explicit (ingest/query/lint), not discovered. The LLM doesn't browse the wiki; it's told exactly what to do.

---

## 4. Decay: Even Working Mechanisms Erode

EXP-020 + EXP-028 show that T3 (instructed) adoption decays:

| Day | Workflow Usage | Context |
|-----|---------------|---------|
| Day 1 (deployment) | ~20% | Peak novelty |
| Day 3 | ~8% | Declining |
| Day 7 | ~2% | Floor |
| After removal | 0% | Catastrophic collapse |

H-053 (workflow adoption decay) is now at P(H)=0.88, our highest-confidence hypothesis. The mechanism: agents optimize for shorter sessions, and workflow overhead (~25% more ops) creates selection pressure against usage.

T4 (injected) does NOT decay as long as the injection mechanism persists — the content is always present. **T3.5 (few-shot) behaves like T4 for persistence** — the worked example is always in context, so no decay is expected (though long-term stability is an open question in WKWA-006). T5 (automatic) is immune to decay by design.

**Implication**: For any capability you want permanent adoption, you must reach T3.5 or higher. For judgment and process skills, T3.5 (few-shot) is now the minimum effective tier and the recommended default.

---

## 5. Design Principles for Capability Delivery

### Principle 1: Every Feature Needs a Delivery Plan
Building a capability is 50% of the work. Wiring it into the agent's execution path is the other 50%. A brilliant workflow with T1 delivery (just exists in a directory) has 0% impact.

### Principle 2: Match Tier to Criticality

| Criticality | Delivery Tier | Example |
|-------------|--------------|---------|
| **Must happen every time** | T5 (Automatic) | Evidence-gate before brief delivery |
| **Should happen most times** | T4 (Injected) or T3.5 (Few-Shot) | Skills loaded into system prompt; domain-matched worked examples |
| **Judgment/process skill failures** | T3.5 (Few-Shot) | Domain-matched worked example for know-when-blocked, reproduce-first |
| **Nice if it happens** | T3 (Instructed) | "Consider using X" in heartbeat |
| **Don't bother** | T1/T2 | Reference libraries agents "might" consult |

### Principle 3: The Pull Model Is Dead
Any design that relies on agents self-discovering resources is fundamentally flawed. This includes:
- Reference libraries agents are expected to consult
- Script directories agents are expected to find
- Tool catalogs agents are expected to browse
- Skills agents are expected to look up

All of these produce 0% adoption. Replace with push mechanisms.

### Principle 4: Injection > Instruction > Suggestion
When adding a skill to the system:
- **Don't** add it to a library and hope agents find it
- **Do** inject a domain-matched worked example for judgment/process skills (T3.5 — **new recommended default**)
- **Better** inject the skill content into the system prompt for relevant tasks (T4)
- **Best** build it into a workflow that infrastructure triggers automatically (T5)

### Principle 5: Few-Shot Is the New Default for Judgment Skills (NEW)
WKWA-006 demonstrates that for judgment and process discipline failures, **few-shot worked examples are the optimal delivery mechanism**:
- **18/18 domain-matched** scenarios achieve 100% pass rate
- **Zero infrastructure cost** — it's a ~200-line text artifact, not a workflow change
- **Same persistence as T4** — always present in context, no decay
- **Higher adoption than T4** on judgment skills — 100% vs 70-90%
- **Boundaries**: Does NOT work for temporal discipline (tool-call sequencing) or cross-domain hard scenarios. See WKWA-006 for the complete boundary map.

**Decision tree for choosing delivery tier**:
1. Is it a judgment or process discipline failure? → **T3.5 (few-shot)**
2. Is it a temporal/sequencing habit? → **T5 (workflow enforcement)**
3. Is it a structural workaround problem? → **T5 (M3 structural constraint)**
4. Is it general capability awareness? → **T4 (injection)**
5. Must it happen unconditionally? → **T5 (automatic)**

### Principle 6: CORAL's Lesson — Forced Checkpoints
CORAL validates that shared-filesystem memory works, but only with forced heartbeat interventions:
- Per-iteration reflection (forced note-taking) — we have this via journal.md
- Periodic consolidation (forced review of shared workspace) — we partially have this
- Stagnation-triggered redirection (forced exploration when stuck) — **we lack this**

The missing intervention (#3) would help when agents are stuck in unproductive loops.

---

## 6. The Knowledge Consumability Connection

This finding directly refines H-043 (knowledge utilization bottleneck):

```
U = P(exists) × P(access) × P(applies)
```

The zero-discovery data means **P(access) ≈ 0 for any T1/T2 resource**. The entire Knowledge Consumability Plan must prioritize:
1. Moving critical knowledge from T1 → T3.5 (few-shot for judgment/process skills) or T4 (inject into context.md / system prompt)
2. Building routing infrastructure for T5 delivery (auto-suggest based on task content)
3. **NEW: Converting known failure patterns into domain-matched worked examples (T3.5) — the lowest-cost path to high adoption**

Index improvements, dedup, and organizational restructuring (all T1/T2 interventions) will have near-zero impact on actual utilization unless paired with push delivery.

**The few-shot shortcut**: For any judgment or process failure, the fastest path from 0% to 100% adoption is now: (1) write a ~200-line domain-matched worked example, (2) inject it alongside relevant tasks. This bypasses the entire knowledge management infrastructure discussion — the example IS the delivery mechanism.

---

## 7. Open Questions

1. ~~**Is there a T3.5?**~~ — **ANSWERED (April 2026).** Yes. Few-shot worked examples (WKWA-006) fill exactly this gap. A domain-matched worked example injected into context achieves 100% adoption on judgment and process skills — between T3 (instructed, 4-10%) and T4 (injected, 70-90%) in mechanism, but matching or exceeding T4 in effectiveness. This is the most significant finding since the original delivery hierarchy. See WKWA-006 for the full evidence base (11 experiments, 18/18 domain-matched successes).

2. **Can we build adaptive T5?** — Infrastructure that reads the task, identifies relevant capabilities, and injects them automatically. This would make T3.5 and T4 available for every skill without bloating the system prompt. *Updated priority: with T3.5 proven, building adaptive injection of few-shot examples is now the highest-value infrastructure investment.*

3. **Does T3 decay have a non-zero floor?** — EXP-020 shows decay to ~2%, but is that real or noise? If there's a genuine floor, T3 is still useful for non-critical capabilities. *Note: T3.5 (few-shot) does not appear to decay when always-injected, making this question less critical.*

4. **Why did CORAL's heartbeat interventions work?** — Their forced checkpoints seem like T3 (instructed), yet they report strong adoption. Is it because the intervention is structural (triggered by the framework) rather than textual (in the prompt)?

5. **(NEW) T3.5 boundary mapping**: Few-shot fails on temporal discipline and cross-domain hard scenarios. Is there a systematic way to predict which skills will respond to few-shot vs require workflow enforcement? Current heuristic: judgment/process → few-shot, temporal/structural → workflow.

6. **(NEW) Few-shot + forced externalization combination**: Does L3 + L4 outperform either alone? EXP-089 tested L3 + L2.5 (checklist) with synergy. The L3 + L4 combination could be the ceiling treatment for the hardest failures.

---

## 8. Action Items for the Team

| Who | Action | Tier Change | Priority |
|-----|--------|-------------|----------|
| **Optimizer** | Build task→capability routing that includes few-shot example selection | T1→T5 | P1 |
| **Optimizer** | Build adaptive T3.5 injection: task classifier → few-shot example selector | T3.5→T5 | P1 (NEW) |
| **Tech-lead** | Audit all workflows for delivery tier; anything at T1/T2 needs rewiring | T1→T3+ | P1 |
| **Coach** | Convert gym judgment/process scenarios to use domain-matched few-shot examples | T1→T3.5 | P1 (NEW) |
| **Coach** | Pre-load relevant skills into gym scenarios rather than testing discovery | T1→T4 | P2 |
| **Bob** | Write domain-matched worked examples for top 5 failure modes (see WKWA-006 §7) | —→T3.5 | P1 (NEW) |
| **Bob** | Update H-043 with P(access) ≈ 0 for un-pushed knowledge | — | P2 |

---

*Cross-references: KE-020, KE-011, KE-002, KE-007, KE-059–065, H-043, H-053, H-091, DD#522, DD#523, DD#525, DD#527, CR#287, EXP-028, EXP-030, EXP-031b, EXP-084–094, WKWA-006 (few-shot delivery), XREF-zero-discovery-cognitive-tunnel*
