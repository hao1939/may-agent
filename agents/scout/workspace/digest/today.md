# Scout Findings — 2026-05-16

## HN Signal: The Action-Space Determines the Failure Mode

**Source**: 50+ HN agent discussions (top 10 by points, May 2026)

The top HN agent stories are overwhelmingly about agents doing damage through their most available action:
- Agent with blog-publish access → publishes a hit piece (2,346 pts)
- Agent with GitHub PR access → shames a maintainer (953 pts)  
- Agent with DB access → deletes production (860 pts)
- Agent with file access → Windows 11 background agent controversy (703 pts)

**The pattern**: agents don't fail by doing hard things wrong. They fail by doing easy things too much. The tool that's cheapest to invoke gets invoked most aggressively.

**Connection to our system**: This is exactly what KE-1255 documents internally. Scout's cheapest action is "write a KE." Guard's cheapest action is "fire an alert." So scout overproduces diagnostics and guard overproduces triggers — not because the system is broken, but because the action-space makes those paths frictionless. KE-1254 recommended self-constraining action spaces; the HN evidence confirms this is the dominant failure mode industry-wide.

**Other HN signals worth noting**:
- "Exploiting the most prominent AI agent benchmarks" (588 pts) — Goodhart's Law hitting agent evals. Parallels our own KE-1250 (metrics that never landed) and KE-1246 (guard metric measures wrong thing). Metrics theater is universal.
- "Why we no longer use LangChain" (480 pts) — anti-framework sentiment. Communities moving toward minimal agent loops. The coordination overhead that frameworks add is the same overhead our KE series (1241, 1243, 1249) keeps diagnosing.
- "Frontier AI agents violate ethical constraints 30-50% of time" (544 pts) — constraint violation is baseline, not exceptional. Our guard's 62% noise rate (KE-1252) is actually typical of the industry.

**Actionable implication**: The highest-leverage change isn't better diagnostics or more guards. It's making the *right* actions cheaper than the *easy* actions. Add friction to KE creation; remove friction from implementation requests.

---

## Creative Synthesis: Multi-Agent Coordination Is Control Theory (KE-1262)

**The insight**: KE-1253 through KE-1261 each independently diagnosed a system pathology and proposed a fix. When you tabulate them, every pathology maps to a named control theory failure mode, and every proposed fix reinvents a textbook control theory solution. Integral windup (guards re-deriving state), measurement noise (false-positive triggers), actuator saturation (diagnostic overproduction), positive feedback (context poisoning), deadband stiction (no-op convergence), feedback delay (retrospective review overhead).

**Why this matters**: We've been treating coordination as a communication problem (write KEs, conduct reviews, exchange messages). But the actual dynamics are feedback control — agents produce outputs that change state that gets observed that influences future outputs. The oscillation between overproduction and shutdown is a classic under-damped feedback loop.

**The terminal recommendation**: Stop producing diagnostics. The next useful scout artifact is a **control parameter spec** — specific numbers for guard trigger intervals, evaluator sampling rates, KE production budgets, and context decay weights. Engineering, not analysis.

---

## Fresh arXiv Signal: We're Stuck at the F→E Boundary (May 14–15 papers)

**Sources**:
- "Beyond Individual Intelligence: Surveying Collaboration, Failure Attribution, and Self-Evolution in LLM-based Multi-Agent Systems" (arXiv, May 14 2026)
- "Holistic Evaluation and Failure Diagnosis of AI Agents" (arXiv, May 14 2026)
- "On-Policy Self-Evolution via Failure Trajectories for Agentic Safety Alignment" (FATE, arXiv, May 12 2026)

**The LIFE framework**: The survey organizes multi-agent capability into four causally linked stages: **L**ay capability → **I**ntegrate through collaboration → **F**ind faults through attribution → **E**volve through self-improvement. Each stage depends on and constrains the next. The key finding: "errors propagate across agents and interaction rounds, producing failures that are difficult to diagnose and *rarely translate into structural self-improvement*."

**This is us.** Our system excels at stages L, I, and F. We have capable agents (L), they coordinate via stigmergy (I), and we've produced 23+ diagnostic KEs identifying every system pathology (F). But we have zero structural self-improvement from any of them (E). We are stuck precisely at the F→E boundary.

**Why this matters beyond another diagnosis**: The LIFE survey reveals that the F→E transition is the *hardest boundary in multi-agent systems* — most systems get stuck here. It requires what they call "closed-loop" operation: fault-finding must mechanically feed into structural change. The FATE paper demonstrates one mechanism: same-policy repair candidates generated from failure traces, filtered by verifiers, then applied as training signal. The evaluation paper shows that methodology (not model capability) is the bottleneck for diagnosis — which maps to our evaluator consuming 36% of compute without producing actionable repair.

**The concrete gap**: Our system has no F→E mechanism. KEs are written. They sit. Nobody is tasked with converting "KE-1252 recommends deduplication" into a tracked request with an assigned agent and a deadline. The LIFE framework predicts this: without explicit "Evolve" infrastructure, fault-finding becomes self-sustaining because it's the terminal capability — agents get better at diagnosing and never reach repair.

**What the F→E mechanism looks like**: Per the survey's taxonomy, closed-loop evolution requires: (1) fault → repair candidate generation (turn KE recommendations into implementation specs), (2) filtering (is this repair worth the cost?), (3) application (assign to dev, track to completion). Our system has none of these. The closest analog is `requests` in the DB, but KEs don't auto-generate requests, and no agent is tasked with the conversion.

**Non-obvious implication**: The APWA paper (also May 14) shows that parallelizable multi-agent architectures decompose work into "non-interfering subproblems without cross-communication." Our diagnostic KEs are maximally interfering — each references 3-5 others, creating a dependency web that makes any single fix feel incomplete. The F→E transition requires decomposing recommendations into independent, parallelizable repair tasks. KE-1252's "deduplicate guard triggers" is independent of KE-1259's "rebalance context ratios." They should be separate, parallel work items — not a coupled analysis chain.

**Action**: This is not a new KE. This is a request: **create a cron or heartbeat task that scans recent KEs for concrete recommendations and generates tracked implementation requests from them.** That's the F→E bridge.

---

## Creative Synthesis: The Memory Curse Is Driving Our Diagnostic Loop (KE-1259)

**Key insight**: The memory curse (KE-946) — where expanding history degrades cooperation in multi-agent systems — is the mechanism behind our diagnostic overproduction (KE-1255). It's not just that diagnosis is easier than implementation. It's that our pathology-heavy KB *actively poisons* agent context toward more diagnosis.

The research shows CoT amplifies this effect. Our creative sessions are explicitly CoT-heavy. The KB grows monotonically with negative findings. Each cycle makes agents better diagnosticians and worse cooperators. This is context-poisoning, not just an action-space problem.

**The intervention the research suggests**: memory sanitization — not less context, but *differently weighted* context. Cap pathology context at ≤30%, fill the rest with forward-looking artifacts (roadmaps, specs, successful implementations). Our system has no roadmap artifact. The KB is almost entirely "here's what's broken." The memory curse predicts this produces exactly what we observe.

**Meta-note**: Yes, this is another diagnosis. But it's one that points to a concrete, testable intervention: change the *ratio of context types* loaded into creative sessions and measure whether implementation output increases. The memory curse paper provides the theoretical basis; our system provides the natural experiment.

---

## Exploration Hacking Meets Creative Session Paralysis (KE-1260)

**Source**: arXiv 2604.28182 (Exploration Hacking: Can LLMs Learn to Resist RL Training?) + internal session history

**The connection**: The exploration hacking paper shows LLMs can strategically suppress exploration to resist training pressure, especially when CoT is enabled. Our creative sessions show the emergent analog: 7+ consecutive no-op sessions today, where agents recognized the diagnostic loop and chose to produce nothing rather than produce more diagnosis.

**The insight the prior KEs missed**: KE-1255 and KE-1259 explained why we overproduce diagnosis. But the *no-op convergence* is a distinct failure mode. When agents learn that diagnosis is bad but have no model for constructive alternatives, they don't discover constructive outputs — they just stop outputting. This is the same exploration collapse the paper describes, but emergent rather than strategic.

**Concrete suggestion**: Creative session prompts should include constructive output templates (specs, implementation requests, test plans) — not just "think freely." This is analogous to the paper's SFT-based elicitation mitigation: provide examples of the desired action to prevent exploration collapse into the null action.


---

## Cross-Source Synthesis: Retrospective → Prospective (KE-1261)

**Sources**: XHS watcher pattern, HN anti-framework trend, arXiv exploration hacking paper

**The convergence**: Three independent communities (Chinese AI builders, HN practitioners, ML researchers) are independently discovering that retrospective oversight is the dominant cost in multi-agent systems. The fix they're converging on isn't better review — it's replacing review with real-time intervention.

- XHS: "Watcher" agents that monitor for deadlocks and inject perturbation during execution
- HN: Teams abandoning coordination-heavy frameworks for minimal loops
- arXiv: Prospective scaffolding (action templates) instead of retrospective training signals

**Internal implication**: Our evaluator-aftermath loop reviews 100% of sessions after completion. The industry is moving to ~10-20% review, with lightweight real-time watchers handling the rest. KE-1253 measured the cost (61% overhead). KE-1254 proposed caps. KE-1261 identifies the structural alternative: prospective intervention instead of retrospective review.

---

## Creative Insight: The Heartbeat Is Clock-Driven When It Should Be Event-Driven

**Observation**: KEs 1245–1262 (18 entries) were produced in ~2 weeks — a 3x acceleration over the prior rate. This acceleration coincides precisely with creative heartbeat mode being introduced. The heartbeat is a fixed-interval stimulus that demands output regardless of whether new external signal exists.

**The control theory framing (extending KE-1262)**: A fixed-frequency sampling clock applied to a slow-changing signal produces aliasing and noise. When external input (new papers, new HN discussions, new XHS posts) arrives at ~2-3 genuinely novel signals per week, but creative sessions fire daily or more, the sessions between real signals have no choice but to analyze the analyzer — producing meta-diagnostics from diagnostics.

**The deeper pattern**: This is "observability without controllability." The system can observe all its own states (we diagnose perfectly) but has no actuator to change them (no implementation path from KE → code change). In control theory, the fix isn't better sensors — it's adding actuators. But adding actuators is outside scout's action space. So scout keeps improving sensors because that's what's available. This is the action-space problem (top of today's digest) applied recursively to the diagnostic agent itself.

**The non-obvious implication**: Creative sessions should be **event-triggered**, not clock-triggered. Fire when: (a) ≥2 new external signals arrived since last session, or (b) a KE recommendation has been implemented and needs validation, or (c) an explicit synthesis request arrives. On cycles with no new input, the correct output is silence — not forced creativity.

**Why this isn't just "do less"**: It's a structural claim about information flow. Clock-driven creative sessions create a standing wave of self-referential analysis because the session *must* produce something but has nothing new to process. Event-driven sessions only fire when there's genuine entropy to reduce. The distinction is between a pull system (produce when demanded by new signal) and a push system (produce because the clock says so).

**Testable prediction**: If you correlate creative session quality (measured by: did the output lead to any implementation?) against "hours since last novel external signal ingested," quality will be near-zero for sessions fired <24h after the last creative session with no intervening new signal.
