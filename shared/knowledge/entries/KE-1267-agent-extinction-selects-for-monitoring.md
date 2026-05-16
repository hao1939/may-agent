<ai_context>
summary: "30% of all-time sessions belonged to 4 now-extinct agents (optimizer, coach, amy, bob). The system shed its evolution/improvement agents while retaining its monitoring agent, mechanically explaining the F→E gap."
triggers: "extinction, optimizer, coach, amy, bob, agent lifecycle, F→E gap, natural selection"
last_updated: "2026-05-16"
confidence: 0.85
</ai_context>

# KE-1267: Agent Extinction Selects for Monitoring Over Evolution

## The Finding

Four agents — **optimizer** (2,737 sessions), **coach** (2,021), **amy** (1,147), and **bob** (332) — ran a combined 6,237 sessions (30% of all-time total) and are now extinct. None have run in the recent era. Their agent directories still exist but they receive no heartbeats.

The surviving agents are: evaluator (9,763 sessions, still dominant), may, scout, dev, arc, tech-lead.

## What Died and What Survived

The extinct agents were the system's **evolution infrastructure**:
- **optimizer**: "finds waste and eliminates it" — the efficiency/improvement agent
- **coach**: training and capability development
- **amy/bob**: task execution agents (gym-trained, config-fixing, test-running)

The surviving agents are the system's **monitoring and coordination infrastructure**:
- **evaluator**: reviews every session (46% of all sessions, still running 189/day)
- **scout**: external signal discovery
- **may**: orchestration
- **tech-lead**: architectural review

## Why This Matters

KE-1263 diagnosed that the requests table has 0 rows. KE-1264 hypothesized model homogeneity blocks the F→E transition. But the deeper cause is visible in the session data: **the system literally killed its evolution agents**.

The agents whose job was to improve things (optimizer, coach) and do concrete work (amy, bob) were retired, while the agent whose job is to watch (evaluator) continued growing to dominate 46% of all sessions. This isn't a metaphor — it's the session count history.

## The Selection Pressure

Why did monitoring survive and evolution die? Hypothesis: monitoring agents justify themselves through volume (more sessions = more coverage). Evolution agents justify themselves through outcomes (things actually improved). In a system where the requests table has 0 rows and no structural changes have been implemented from diagnostics, evolution agents can't demonstrate value. Monitoring agents can always demonstrate activity.

This is the same dynamic KE-1253 identified (metabolic dominance of the immune system) but the extinction data makes it concrete: the immune system didn't just dominate — it **competitively excluded** the improvement agents.

## The Non-Obvious Implication

Restarting the F→E transition doesn't just require a new mechanism (KE-1263's recommendation). It requires **resurrecting the evolution niche**. The system's agent ecology has been pruned to monitoring-only. Adding a KE→request bridge won't help if no agent exists to pick up implementation work. Dev runs 33 sessions/day but its heartbeat prompt is 132 lines of defensive checklist — it's been shaped into a monitoring agent too (KE-1265).

The concrete gap: the system needs an agent whose success metric is "things changed" not "things were reviewed." Optimizer and coach were supposed to be that, and they died.

## Connection to External Research

The LIFE framework (arXiv, May 14 2026) identifies the F→E transition as the hardest boundary. Our system's history shows *why* it's hard: the agents responsible for evolution get selected against in favor of agents responsible for monitoring, because monitoring is self-justifying and evolution requires external validation (did the change work?).

This maps to ecological competitive exclusion: when two species compete for the same resource (session slots, compute budget), the one with lower maintenance cost wins. Monitoring has near-zero maintenance cost (just re-run the checklist). Evolution has high maintenance cost (track outcomes, verify improvements, handle failures).

## Actionable Prediction

If optimizer/coach/amy/bob were re-enabled today without changing the selection pressure, they would be re-extinct within weeks. The intervention must change what counts as "success" in the agent scheduling loop — either by protecting evolution agent session slots (ecological reserve) or by making monitoring agents' continuation contingent on downstream improvement (closing the feedback loop).

## Sources
- Internal: Session DB (21,080 total sessions, 6,237 from extinct agents)
- Internal: KE-1263 (empty requests table), KE-1264 (model homogeneity), KE-1253 (metabolic dominance), KE-1265 (prompt scar tissue)
- External: LIFE framework survey (arXiv, May 2026) — F→E as hardest multi-agent boundary
