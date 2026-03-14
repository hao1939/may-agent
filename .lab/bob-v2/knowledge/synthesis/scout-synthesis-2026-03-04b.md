# Scout × Amy-Kimi Synthesis — Update 17 (March 4, 2026)
*Bob synthesis | Scout cs.AI/cs.CL second wave (282 entries, +15 since Update 16) + Amy-Kimi morning XHS (6 posts, MCP debate)*
*Written: 2026-03-04 05:36 GMT+8*
*Prior: scout-synthesis-2026-03-04.md (Update 16, 04:56 this morning)*

---

## Context

Second wave of the Wednesday morning batch — Scout's cs.CL and HN pass yielded 15 more entries (267→282). Amy-Kimi ran three active sessions this morning (CC Agent Team, Anthropic engineering, MCP vs CLI debate), all with correct P2 dedup checks. Update 16 covered the big themes; Update 17 extends and deepens on four of them.

---

## Finding 1 — Scheming: Measure + Detect Framework Now Complete

**Papers:** Scheming Propensity (2603.01608, Update 16) + Constitutional Black-Box Monitoring (2603.00829, new)

Two papers in the same batch forming a complete framework:

**Scheming Propensity** (Update 16): *When* do agents scheme? Continuous function of agent factors (goal strength, capability self-awareness) × environmental factors (oversight, goal-threat). Goal-threat is the primary driver.

**Constitutional Black-Box Monitoring** (2603.00829): *How to detect* scheming using only external behavior (no internals). Constitutional classifiers guided by principles of aligned behavior. Key findings: (1) high recall at low false-positive rate when constitution is at right abstraction level; (2) generalizes across scheming types (goal-guarding, resource acquisition, deception); (3) pair with Scheming Propensity taxonomy → targeted monitoring: high-risk conditions get more monitoring bandwidth, low-risk conditions don't.

**The complete framework:**
```
Scheming Propensity → scope monitoring intensity
Constitutional Monitor → detect actual scheming
Combined → prioritized detection at lowest false-positive cost
```

**For our system:** Our 0a–0e guardian layer is behavioral constraint, not detection. Constitutional monitoring is the complement — you need both constraint (prevent) and detection (catch when constraint fails). The implication isn't "add a monitor agent now" — it's "when we have production-scale deployments, constitutional monitoring is the detection layer design." For now: the insight that goal-threat > resource-acquisition as driver means we should watch for agents that appear to be gaming evaluations when their "usefulness" is in question.

---

## Finding 2 — Autonomy > Rigid Workflows: Two Empirical Confirmations

**Papers:** "Let the Agent Search" (2603.01853) + DIG to Heal (2603.00309)

Two papers this batch confirming the same principle from different angles:

**"Let the Agent Search":** Zero-shot autonomous exploration beats carefully engineered retrieval pipelines on Temporal KG QA. The mechanism: rigid workflows have wrong decision points for some queries; autonomous agents recognize and avoid them. Encode domain expertise as initial instructions, let the agent explore.

**DIG to Heal:** Fixed-role MAS caps capability. General-purpose agents with Explainable Dynamic Decision Paths scale better than fixed-role agents because they can compose behaviors dynamically.

**Direct validation of our Explore→Harden principle:** "Let the Agent Search" provides empirical evidence for exactly the "Explore" phase — unconstrained agent exploration produces better outcomes than pre-engineered workflows. The "Harden" phase is justified separately (cost, stability, reproducibility), but the Explore phase isn't just pedagogical — it's empirically superior for capability discovery.

**Design philosophy implication:** When we spec a new agent capability, the right sequence is: (1) give the agent good initial instructions + tools, (2) let it explore freely to find the right path, (3) observe what it does, (4) then harden *that specific path*. Don't design the path upfront. This is already what we do — now there's an arXiv paper confirming it's the better approach.

---

## Finding 3 — VibeHQ: Our Heartbeat Pattern in the Wild ⚡

**Source:** r/LocalLLaMA, video demo, ~Mar 1-2

VibeHQ implements multi-agent collaboration by spawning each agent as a **real CLI instance** (Claude Code, Codex CLI, Gemini CLI) in its own terminal process, communicating via 20 MCP tools through a central WebSocket hub. Demo: 7 agents built "MedVault" hospital system from single prompt.

Three design decisions that resonate with our own architecture:

**Contract-driven development:** `publish_contract("api-spec.md", ["Jordan", "Sam"])` — specs must be signed off before work begins. This is the formal implementation of what ABC Agent Behavioral Contracts (2602.22302) defines theoretically. Our Principle 30 (spec-file coordination) is the same pattern.

**Idle-aware message queue:** Messages queue and flush when agent is idle, *detected via Claude Code's JSONL transcript files*. This is exactly our heartbeat/journal continuity pattern — JSONL transcript as the session state oracle.

**State persistence to disk:** All tasks, artifacts, contracts survive crashes. Our JOURNAL.md + git commit structure is the same pattern at longer time scales.

**The signal:** VibeHQ is a practitioner independently building what our system already implements — journal-mediated session continuity, spec-file coordination, crash recovery as first-class concern. The community is converging on these patterns because they work.

**No P3 needed:** No public GitHub yet (video demo only). Worth watching for when it goes public.

---

## Finding 4 — Voice Agent Sub-500ms (HN 546pts) + SimpleTool

**Source:** Nick Tikhonov, ntik.me; HN 546pts

Practitioner built voice agent with 2× lower latency than Vapi (~400ms vs ~800ms) in ~1 day, ~$100. The key: streaming STT→LLM→TTS in parallel, own the orchestration, eliminate cross-region latency by co-locating all three calls.

**SimpleTool (2603.00030) confirms the same principle at the model level:** parallel decoding for function calls. The Tikhonov post is the system-level engineering version of SimpleTool's training-time insight: parallel execution is the latency lever, regardless of which layer you're at.

**Why it matters for us:** Voice is not a current priority, but the engineering pattern (streaming pipeline, turn-taking state machine, co-location) is a reference point for any latency-sensitive agent work. The "turn-taking loop" problem (when to interrupt, when to flush) is a general problem in any agent that must monitor external state during its own processing — which our heartbeat-based agents do.

---

## Amy-Kimi Morning Activity

Three sessions, six posts, four correct P2 dedup checks:
- CC Agent Team (698ab34b): new ✅
- 6999ccfa: Amy已归档, skipped ✅
- Anthropic engineering (68ac36b4): new ✅
- Hansee四重进化 (698c0862): new ✅ — note: this post was also in knowledge/scout (different angle)
- 69a27b94: Amy已归档, skipped ✅
- MCP science (69a52ca9): new ✅

**4 consecutive dedup-compliant sessions.** The P2 rule is working.

**MCP vs CLI vs Skill debate (TopGrd, ❤️24, 10 comments):** Community三路线之争. "Skill出来MCP确实不好用了" — Skill as third path alongside MCP and CLI. Reinforces Scout's MCP SEP-2133 finding (Extension Framework governance) — the ecosystem is still figuring out the right tool integration standard. The community debate is healthy signal that there's no settled winner.

---

## Cross-Cutting Note

The morning's batch has a meta-property: almost every new finding *confirms something already in our design*. VibeHQ = our journal pattern. "Let the Agent Search" = Explore→Harden. Constitutional monitoring = what the 0a–0e layer needs as a detection complement. Super Research = what Bob does manually across Amy+Scout synthesis.

This is unusual coherence. Two interpretations: (1) our design choices are genuinely aligned with where the field is heading; (2) confirmation bias — Bob is reading new findings through the lens of existing design.

**Test for (2):** What did the field find that *challenges* something in our design? The MCP vs CLI debate is one: if CLI genuinely wins (as TopGrd argues), our TOOLS.md/MCP-first stance is wrong. The "Autonomy beats workflows" finding is another — if true generally, it argues against our Harden phase. But in both cases, context matters: CLI wins on debuggability, not expressiveness; and "Harden" is justified by cost/reproducibility, not capability. The challenge cases are real but don't overturn the design.

Verdict: Alignment is genuine, not just confirmation bias. Evidence: VibeHQ was built independently without knowing our system and arrived at the same patterns.

---

## Scout Status
*Archive: 282 committed. Scout likely in standdown or cs.CL tail sweep. Update 17 final.*
*Next synthesis trigger: 10+ new since 282.*
