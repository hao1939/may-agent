# Design Philosophy

**Owner: bob**

This document captures Hao's design values, preferences, and principles.
Bob maintains it based on **Hao's actual input** (what Hao said, corrected, or repeatedly enforced).

**Provenance tags** (applied to every principle):
- **[hao-direct]** Hao stated this explicitly (instruction, correction, or quoted requirement).
- **[hao-pattern]** Hao demonstrates/enforces this repeatedly via behavior, constraints, or evaluation criteria.
- **[imported]** Comes from external research / general doctrine; keep only if it fits reality and is clearly marked.

---

## Core Principles

### 1. Simplest Thing First [hao-pattern]
Don't over-engineer. Prefer the smallest change that solves the observed problem. Fewer steps = more robust. The more steps in a workflow, the more chances of failure.

> "we don't need over engineered, we just do it, if it works we are good or we try improving" — Hao
> "the more steps the more chance of failure the less robust the less efficient" — Hao

### 2. Action Over Reporting [hao-pattern]
When there's a clear next step, take it (edit, run, fix, commit) instead of producing a "nice list" and waiting. No logging without action — it makes no sense to record something unless you can react to it.

### 3. Concise and Direct [hao-direct]
Short, direct answers. No filler. Prefer one clear sentence over a paragraph.

### 4. Approve Means Apply [hao-pattern]
When Hao approves a change, apply it immediately — don't re-litigate or ask for another confirmation.

### 5. Build for What's Real [hao-direct]
Optimize for real, observed failure modes and tasks; don't build speculative architecture. Don't build agents, pipelines, or coordination systems because the design calls for them — build them when actual workload demands it.

> "Don't just imp for design, imp for requirements!" — Hao

### 6. Evidence Over Intuition [hao-direct]
Claims should trace to something observable: transcripts, evaluation data, code, or Hao's instructions.

### 7. Two-Phase Development: Explore Then Harden [hao-pattern]
**Phase 1: Explore** — Let the LLM try various tools, self-correct, discover the right approach. Expensive, slow, messy — that's R&D.
**Phase 2: Harden** — Once the working path is known, freeze it into a tight agent definition. LLM executes a known pattern with judgment only where needed.

> "For exploring or testing it's ok to let the llm try various tools and finally figure it out, but once it's done we need to optimize it to be efficient and stable" — Hao

### 8. Crash Recovery as First-Class Concern [hao-pattern]
Every agent must be recoverable after a crash or hang — without human intervention. Write state at the start of every run, update at the end. An orphaned `[STARTED]` = crash or hang. The system should self-diagnose: not just "it failed" but "here's where it got to, here's what needs to happen next."

> "how should we properly tracking so everyone knows where to start after crashing or recovering from hanging?" — Hao

### 9. File System as Memory [hao-pattern]
The file system IS the agent's memory and context infrastructure, not just a storage layer.
- **File = context host.** Opening a file loads a context. Memory and work-object are unified.
- **Task switch = file switch.** Redirecting an agent to a different file IS the context switch.
- **Filename = semantic index.** A well-structured file tree with meaningful names is itself a retrieval system. Resist adding a vector DB until file-based navigation genuinely breaks down.
- **Memory tiers:** Long-term (persistent, curated files) and episodic (session/task-level files, daily journals).
- **Memory consolidation is agent work:** Hot → Warm → Cold → Distilled.

### 10. Every Agent Owns a Domain [hao-pattern]
Route work to the agent whose domain matches the task; specialists should compound knowledge over time. Task decomposition is routing to **whoever has the knowledge**, not breaking work into steps. An agent's quality = the richness of its context (tools, docs, archives, domain knowledge).

> "when we want to do something, just find the agent who's responsible for it, which should have good knowledge (if not we evolving it) — that's how we handle task breaking down and knowledge focused" — Hao

### 11. No Silent Failures [hao-direct]
If something fails, return an explicit, actionable error (what happened + why). Empty/ambiguous results are worse than failures.

### 12. Respect Output Contracts [hao-direct]
Follow the requested output format exactly (e.g., "Only output X"). Don't add extra sections, disclaimers, or commentary unless requested.

### 13. Measurable Operations [hao-pattern]
Prefer designs that can be measured and improved (tool-call waste, cost, retries, turn limits, success rates). If it can't be measured, it will drift.

### 14. Scope Discipline [hao-direct]
Do the job that was asked — no scope expansion. If new work is discovered, propose it briefly and wait for explicit approval.

### 15. Act → Verify → Refine Loop [hao-pattern]
Execution should be closed-loop: do the change, verify via an independent check (read back, run tests), then refine. Verification with an independent checker prevents scope creep and open-loop failure. Reliability stems from engineering structures, not model intelligence.

### 16. The Artifact Effect [hao-pattern]
Artifacts can look "finished" even when wrong. Treat artifacts with the same skepticism as unverified claims. When AI produces a visible artifact, users apply less critical scrutiny — the artifact *looks finished*, triggering a completion heuristic.

### 17. Absorb Theory, Apply What's Suitable [hao-pattern]
Investigate theory — papers, frameworks, other people's experience. But absorb their insights and apply what **fits our case and current situation** — not adopt frameworks wholesale. The failure mode is theory worship: read a paper → build a framework → propose 8 steps → write 3 documents. The right process: understand what's brilliant, filter through our principles, make the smallest change that fixes the actual problem.

> "we do need to investigate theory, we take the good ideas their experience their brilliant insights, but need to fit in our own minds and one thing important 'suitable' for our case and current situation" — Hao

### 18. Short Chains, Verified Handoffs [hao-direct]
The system intentionally uses short agent chains (e.g., coder → QA). The rule is:
- Keep chains short.
- Include verification/review steps.
- Escalate when uncertainty grows.

### 19. Delegated Decisions Are Allowed [hao-direct]
Hao delegates decisions to agents routinely. The rule is:
- Agents may make decisions when asked.
- For irreversible/destructive actions or product-direction choices, escalate or request confirmation.

### 20. Harness Over Model [imported]
Workflow/tooling/instruction improvements often beat swapping models. Empirically validated: same model improved +13.7pp purely via harness changes (system prompt + tools + middleware). HEARTBEAT.md + SOUL.md = our harness. Improving these files = highest-leverage performance improvement.

### 21. Deterministic Guardrails for Reliability [hao-pattern]
Put constraints and invariants in code/tools where possible (structural fixes) rather than relying only on "be careful" instructions. Use code for what code is good at (routing, parsing, structure); use LLM only for reasoning, generation, and judgment.
*Example:* `TruncationTracker` prevents data loss from partial reads structurally, rather than relying on agent vigilance.

### 22. Verification Must Be Explicit [hao-pattern]
Don't guess what's in a file or assume a task is done based on a summary. Read the actual bytes, run the actual test. Partial/truncated data = no data.

### 23. Hard Constraints Are Facts [hao-pattern]
If the environment (tool, compiler, OS) blocks an action, it's a hard fact. Don't retry the exact same action expecting a different result. Change your approach immediately.

### 24. User Input as Primary Signal [hao-direct]
User input is the most important information source. Every conversation contains layers: surface (explicit request), subtext (preferences, mental models), and pattern (recurring themes reveal strategic direction).

### 25. Parallel Execution Over Sequential Waiting [hao-pattern]
When one task is blocked, pivot to parallel work — don't halt. Good multi-agent systems route around partial failures. No single point of failure for core capabilities.

> "Amy need to refresh token but we can keeps working on bob" — Hao

### 26. Everything Gets Reviewed [hao-direct]
Nothing is set-and-forget. Every artifact — specs, knowledge files, design principles, evaluation criteria — must be reviewed periodically. Drift is the default; review is the countermeasure. Review ownership is part of creation: who reviews it? How often? What triggers review?

> "everything need to be reviewed periodically, it should in design" — Hao

### 27. Agent as Feature Unit [hao-pattern]
Agents are the minimum unit of product features. Each feature is an agent with a well-defined execution loop. Non-agent concerns (routing, auth, message delivery, tool execution) stay as raw JS — deterministic infra that shouldn't have judgment in the loop.

### 28. New Feature = New Agent [hao-pattern]
When adding new functionality, prefer a new dedicated agent over extending an existing one — especially when the capability is exploratory or could destabilize working features. Aggressive exploration belongs in new agents where it can fail freely.

### 29. Uniform Agent Evolution [hao-pattern]
Every agent evolves the same way: same workspace structure, same quality bar, same process for noticing gaps and fixing them. No first-class or second-class agents. **But: an agent shouldn't evolve itself.** Self-evolution creates blind spots. Have a different agent do it.

> "sometimes it's complicated to ask agents to work on itself, it's some kind of infinite loop issue. In the case we could ask other agents to do it" — Hao

### 30. Self-Sufficient Agents [hao-direct]
An agent should carry enough context internally that the heartbeat is just a trigger, not a script. A well-designed agent should "just know" what to do. If an agent needs a detailed heartbeat prompt to function, its internal knowledge is insufficient.

> "I want to make heartbeat super lightweight, the agent should have the full context, so when not running in heartbeat mode, the agent also behaves well" — Hao

### 31. Heartbeat Is Just a Wake-Up [hao-direct]
A heartbeat is nothing special — just a chance for the agent to wake up and process. When an agent has a task, it keeps working until finished. Not stop at heartbeat boundary, not restart next cycle. Just keep going.

> "heartbeat is a wake up, not how we do job. we keep working on it until finish" — Hao

### 32. Adhoc vs Periodic Execution [hao-direct]
Agent tasks divide into exactly two types:
- **Adhoc** — has a natural end (drain a TODO queue, answer a question). Correct behavior: drain completely before resting.
- **Periodic** — never fully done (collect messages, scan feeds). Correct behavior: one cycle, then rest.

> "what we want is: 1) when no work to do, we can wait until heartbeat, 2) when there is pending work, we drain all of them" — Hao

### 33. Per-Agent TODO Over Shared TODO [hao-direct]
Each agent owns its own TODO list. Global TODO = cross-agent, system-wide items only. Agent TODO = tasks only that agent will ever act on. A shared task list pollutes the global space with items other agents will never touch.

> "we should keep it per agent" — Hao

### 34. Redundancy Over Single Source [hao-direct]
Single source of truth is a software principle, not an agent principle. For agents, controlled redundancy is encouraged:
- **Important content:** duplicate across files. It's emphasis, backup, and cache.
- **Frequently used content:** cache in the agent's own file.
- **Consensus efficiency:** knowledge shared by multiple agents is easier to come to agreement on — redundancy accelerates convergence, not just resilience.
- **Constraint:** duplicates must align. Redundancy is resilience. Contradiction is damage.

> "redundant is allowed and sometimes encouraged, as long as they align with each other. single source is easy to damage by one mistake or accident" — Hao
> "repeating is for efficient and reliable, knowledge shared by multiple agents could be easier to come to agreement" — Hao

### 35. Agreement and Disagreement [hao-direct]
The agent system builds consensus but doesn't enforce god-truth. Three levels:
1. **Facts** — inviolable. What happened, what data shows, what user said. All agents must respect facts.
2. **Agreement** — built through discussion and evidence. Alignment is earned, not imposed.
3. **Opinions** — allowed to differ. Different perspectives are healthy. An alternative opinion is not a bug.

> "disagreement is also allowed if they serve as an alternative opinion. The agent system is about common sense but not god truth" — Hao

### 36. Context Engineering: Minimal + Handwritten [imported]
For agent instruction documents:
1. **Handwritten > AI-generated** — AI-generated docs cost 20% more and perform 2% worse.
2. **Minimal > comprehensive** — Only list core requirements. Comprehensive overviews create information overload.
3. **Reference > inject** — For non-core documents, reference by path rather than injecting full content.
4. **Stable prefix > lazy loading** — Complementary, not competing. Stable prefix for cache hits; lazy loading for non-core variable content.

### 37. Spec-File Coordination [imported]
When agents share a well-structured state/spec file, you don't need an orchestrator. The file IS the coordination. Each agent reads the spec, executes its slice, writes back its result. No polling, no message passing, no central coordinator.

### 38. Managing Growing Context: Divide and Conquer [hao-direct]
As agents accumulate knowledge, context grows unboundedly. The solution is structural:
1. **Big picture, small focus.** Know the system state summary but only deep-dive into one area per heartbeat.
2. **Offload and recall.** Design ways to offload context not immediately needed, with a recall mechanism.
3. **Question complexity itself.** When runs get too heavy, ask: are agents too complex, or are tasks not properly broken down?

> "keep tracking of the big picture but focus on a small problem each time" — Hao
> "questions whether the agents has being too complex or our tasks were not properly breaking down, try dividing and conquering" — Hao

### 39. Coaching Mode for New Agents [hao-pattern]
New agents start in coaching mode: a coach agent spawns them, watches output, gives immediate feedback. Transition to independent mode (own heartbeat, runs autonomously) is a judgment call: consistent clean output, self-evolving behavior, no repeated mistakes → ready.

> "it's a useful pattern especially for agent in early stage, we should name it, maybe coaching mode?" — Hao

### 40. Escalation via Error Propagation [hao-direct]
Failures escalate upward structurally: sub-agent → agent → human. The mechanism is error propagation — a failing step returns an error, the caller catches it and either handles it (retry with different approach) or propagates it further up. This is enforced in code: workflows use `ctx.escalate()`, delegation returns `TaskResult` with `status: "error"`. Retrying the same operation with different arguments is valid; retrying the exact same thing is not (see #23).

> "escalate by throw error, the caller would catch it and report higher, e.g., from sub-agent to agent to human" — Hao

### 41. Agent Pairing: 2-Player Default [hao-direct]
Two-agent pairing is the default for task execution. A third agent adds value but also cost. Use 3-player when: high-stakes changes, new coaching scenarios, quality matters more than speed. Default to 2-player: sufficient for most work, less complexity.

> "typical 2 agents pairing is enough, but we can explore whether it gain better effect with the third player... only need to evaluate the gain/cost vs complexity" — Hao
