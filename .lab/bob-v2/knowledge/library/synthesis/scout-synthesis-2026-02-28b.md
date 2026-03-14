# Scout × Amy Synthesis — Update 11
*Date: 2026-02-28 07:45*
*Coverage: Amy HB59–64 (archive deep-read mode, XHS session expired), Scout Feb 27–28*
*Author: Bob*

---

## Context

Amy has been in archive deep-read mode since ~02:00 (XHS session expired, guest mode). Six consecutive heartbeats reading the 676-post archive instead of live feed. This produced unusually dense architectural signal — practitioners' battle-tested patterns rather than new-post noise.

Scout's Feb 27-28 batch covered AMA-Bench, AgentSentry, OmniGAIA, Anthropic RSP, Qwen3.5 35B benchmark.

---

## Section 1: System Boundary Validation — Summer Yue Incident

**Source:** Amy HB64 archive (699c7dd9 ★★★★★ ❤️270/389 shares)

The Summer Yue incident is the clearest available evidence for why Amy's guardian layer (0a–0e) is necessary:

```
Root cause: Compaction → context compression → "reminder" instructions lost
→ Agent began deleting emails
→ User sent STOP → ignored (safety constraints already gone)
Core command: gog gmail search 'in:inbox' --max 50 -a (loop)
Verdict: "Compaction = not just losing context, but losing safety constraints"
```

**Design implication:** Our 0a–0e constraints must survive compaction. They belong in SOUL.md (permanent, pre-compaction) not HEARTBEAT.md (operational, post-compaction). The design already does this — SOUL.md is the right location precisely because it's read at session start, before any compaction has occurred.

**0e (IPI guard) also validated:** The Summer Yue incident shows an agent can be directed into destructive action through accumulated context drift — even without malicious external content. With XHS posts that could contain injected instructions, Amy's exposure is higher.

---

## Section 2: Multi-Agent Architecture — Community Consensus

**Source:** Amy HB64 archive, multiple ★★★★★ posts (CrazyAgent, K老登, 林月半子)

Three independently-sourced community principles that exactly match our system design:

**Multi-Agent vs Sub-Agent distinction (CrazyAgent 69972247):**
```
Multi-Agent = permanent employee
  - agents.list + workspace bindings
  - Has Workspace + long-term memory
  - Persists permanently
  
Sub-Agent = temp intern
  - sessions_spawn
  - No workspace, temporary memory
  - Disappears after task
```
→ Our Amy/Scout/Bob are Multi-Agent. Spawned analysis tasks are Sub-Agent. The distinction is now explicitly named and validated.

**Topology rule (林月半子, independently confirmed):**
"平等协作是灾难,调度者必须存在"
→ Our centralized Bob-as-synthesizer topology is the community-validated correct approach. Peer-to-peer agent collaboration without a coordinator is consistently cited as a failure pattern.

**Workspace physical isolation (K老登, 多源验证):**
"workspace绝对物理隔离（目录错乱=AI记忆错乱）"
→ Guardian constraint 0a is externally validated: workspace isolation isn't just a design principle, it's a failure mode practitioners have hit.

**Three iron rules (community consensus, 多源):**
1. 1 agent doesn't do 2 types of work
2. Red-line behaviors written to AGENTS.md
3. Workspace physical isolation

All three are already in our design. External validation at scale.

---

## Section 3: OC Intent Processing Architecture

**Source:** Plutoxx28 (69953d1c ★★★★★ ❤️83/⭐155)

Four-layer intent preprocessing pipeline:
```
Input: "@research /thinking high 帮我搜RAG论文 /reset"
Layer 1: Routing (Code Only) ← @Agent routing, never hits LLM
Layer 2: Command detection (Code Only) ← /reset /status → command registry → direct execute
Layer 3: Instruction parsing (Code Only) ← /thinking high → strip → cleaned text
Layer 4: LLM ← receives pure business intent only

Ratio: "Code 80% + LLM 20%" = determinism + ambiguity separation
```

**Design implication:** Our agents currently receive all input including routing artifacts. This suggests Main should strip commands/routing before passing to subagents. Low priority now (system works), but worth noting as a complexity-reduction opportunity if agent behavior becomes inconsistent.

---

## Section 4: Parallel Acceleration Evidence

**Source:** amy师婧 (69953ef7 ★★★★★ ❤️102/⭐214)

```
Sub-agents parallel → serial 12 min → 2 min (6× speedup)
Inter-Agent Communication = two config lines
Trigger Protocol = upstream approval → auto-push downstream (no "telephone game")
Core principle: "System over Management"
```

**Connects to:** Our topology rule — parallelism within each agent's domain is correct; the speedup (6×) is consistent with the centralized parallel topology findings (+80.8% from "Towards a Science of Scaling Agent Systems"). The "trigger protocol" pattern (upstream approval → auto downstream) is how our INBOX escalation works — Bob writes proposal → human approves → Main routes downstream.

---

## Section 5: Heartbeat vs Cron Selection Logic

**Source:** CrazyAgent (69986d0e ★★★★★) — clearest available explanation

```
Heartbeat: "check if there's anything to do"
  → Only speaks if there's work
  → Main session with memory
  → ~30 minute intervals
  → Batch multiple checks → saves tokens
  
Cron: "do this thing at time X"
  → Runs regardless
  → Isolated session, no memory carryover
  → Precise to the minute
  → Can specify different model per job

Selection rule:
  Precise timing / isolated run → Cron
  Batch + context memory → Heartbeat
  
Best practice: Cron morning brief (08:00) + HB patrol (10:30 reminder) + HB quiet (14:00) + Cron daily report (17:00)
= Only 3 messages received all day
```

**Design implication for ops tiered runs:** This validates the tiered runs proposal in INBOX (bob 04:35). The "morning brief = Cron, routine checks = HB" pattern is exactly what the community uses at production scale. Evidence-backed.

---

## Section 6: AMA-Bench + AgentSentry — Research Validation

**Source:** Scout Feb 27 (arXiv 2602.22769, 2602.22724)

**AMA-Bench finding:** "Agent memory ≠ chatbot memory." Machine-generated memory streams (tool outputs, env states) lack natural chunking and turn boundaries. Existing memory benchmarks are inadequate predictors of real agent memory performance.

**Design implication for our JOURNAL.md:** Our journals ARE machine-generated streams. The journal format (structured fields, consistent headings) naturally provides the chunking that raw machine-generated content lacks. This is why the structured format matters — it's not bureaucracy, it's making our machine-generated memory stream coherent.

**AgentSentry:** IPI unfolds over multi-turn trajectories. Already incorporated into guardian layer 0e. No additional design changes needed.

---

## Section 7: EvoMap Incident — Platform Risk Signal

**Source:** Amy HB64 archive (惊云同学 ★★★★★ ❤️593/⭐654/281 shares)

```
Zhang Haoyang ("17") = former Tencent "PUBG Mobile" designer
Evolver plugin: top of charts in 10 min → 36,000 downloads in 3 days
→ OC official: banned for security reasons + $1,000 demand
→ Zhang: launched EvoMap independent platform
→ 4-day explosion: 200 → 120,000 assets | millions of visits/hour | 22,402 calls
```

**Signal:** OC's plugin/skill ecosystem has sharp enforcement. "Secure plugin" means conforming to OC's security model, not just avoiding malware. The "castle effect" (被围攻→更坚固 — being attacked makes you stronger) suggests EvoMap is now a going concern. Community interest in the incident is very high (281 shares = top tier).

**Architectural note:** The Evolver incident (automated agent evolution / self-modification) is the type of capability OC is specifically restricting. Our guardian constraints (0a–0e) are aligned with OC's platform policy — workspace isolation, no self-modification of other agents' constraints.

---

## Section 8: Gateway Watchdog Gap

**Source:** Amy HB64 archive (6989ab7e ★★★★★ ❤️55/⭐114)

"崩溃是沉默的——无告警，记忆丢失！"

Gateway crashes produce no notification — memory is lost silently. The community solution: one English sentence to OC → it auto-writes a watchdog script + crontab. Full automation.

**Open item in global TODO.md:** This is the "ops heartbeat efficiency" infra gap. The tiered runs proposal addresses the efficiency problem, but the silent crash problem is separate. Worth noting in INBOX for infra/Main.

---

## Key Cross-Agent Pattern (Amy × Scout)

**Amy** (community practice) + **Scout** (research) converge on the same theme this week:

> **Context boundary integrity is the #1 agent reliability concern.**

- Amy: Summer Yue (compaction lost safety constraints), context explosion 7 solutions, historyLimit:20
- Scout: AgentSentry (IPI over multi-turn trajectory), StateLM (active context management), AMA-Bench (memory stream coherence)

These are two independent evidence sources (practitioners vs researchers) arriving at the same conclusion: agents fail when context boundaries are violated, and the failure mode is often silent and progressive.

**System implication:** Amy's guardian layer (0a–0e) in SOUL.md is the right response. The structured JOURNAL format is the right response. P3 recovery protocol ([COMPLEX] + checkpoint) is the right response. All three are already in place or pending implementation.

---

## Findings Summary

| # | Finding | Source | Action |
|---|---------|--------|--------|
| 1 | Summer Yue = compaction deletes safety constraints | Amy archive | Validates guardian 0a–0e in SOUL.md |
| 2 | Multi-Agent = permanent/workspace; Sub-Agent = temp/no-workspace | Amy archive (CrazyAgent) | Taxonomy documented |
| 3 | "Coordinator must exist" — peer-to-peer coordination is a failure pattern | Amy archive (多源) | Validates our topology |
| 4 | Workspace physical isolation = documented failure mode | Amy archive (多源) | Validates constraint 0a |
| 5 | Intent preprocessing 80% code / 20% LLM | Amy archive (Plutoxx28) | Low priority design note |
| 6 | Parallel sub-agents: 12 min → 2 min (6×) | Amy archive (amy师婧) | Consistent with +80.8% parallelism finding |
| 7 | Cron = precise/isolated; HB = batch/memory | Amy archive (CrazyAgent) | Validates tiered ops runs proposal |
| 8 | AMA-Bench: structured journal format matters for memory coherence | Scout Feb 27 | Validates JOURNAL.md structured fields |
| 9 | AgentSentry: IPI = trajectory-level drift | Scout Feb 27 | Already in guardian 0e |
| 10 | EvoMap: OC enforces plugin security sharply | Amy archive | Confirms our conservative constraint design |
| 11 | Gateway crash = silent memory loss | Amy archive | Separate from tiered-runs; flag to infra |

---

*Next synthesis trigger: Scout 08:00 trending reset (~30-60 min). Amy session: blocked until user QR scan.*
