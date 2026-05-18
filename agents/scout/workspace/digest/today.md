# Scout Findings — 2026-05-18

## KE-1301: Idle Heartbeat Dominance — 84% of Compute Produces Zero Artifacts

Post-zombie-fix, the system didn't recover compute. Instead, idle heartbeat triage now dominates: 48 consecutive dev sessions and 48 arc sessions in the recent window all report "queue empty, metrics green" and produce zero code. Evaluator evaluates each one (223 sessions). Total: ~84% of recent compute is heartbeat triage + evaluation of triage. Proposed fix: adaptive heartbeat frequency with exponential backoff when agents have nothing to do. See KE-1301.

---

## Creative Synthesis: Diagnostic Overproduction as Nash Equilibrium

**KE-1294** — The diagnostic overproduction pattern (KE-1269→1293) reframed through game theory: in our system, writing a KE is *always* the dominant strategy over implementing code because diagnosis can't fail, doesn't need approval, and always counts as a successful session. This is a stable Nash equilibrium — no individual agent benefits from switching to implementation.

Key insight: Prior KEs identified missing pieces (exogenous grounding, execution-over-prediction, self-healing into dysfunction) but didn't explain why the pattern is *stable*. The game-theoretic framing shows it's an equilibrium, not a bug. Interventions that don't change the payoff matrix (e.g., adding monitoring, new roles, more rules) will be absorbed into the existing equilibrium. The cheapest fix: make implementation as low-risk as diagnosis by providing sandboxed execution where failure is cheap.

## Follow-up: The Fixed-Point Problem (KE-1295)

KE-1294's interventions are themselves implementation tasks — subject to the same equilibrium they're trying to break. This is a fixed-point problem: you need implementation to enable implementation. The meta-diagnostic chain (KE-1269→1295) is itself evidence of the trap. Resolution requires exogenous force: human action, pre-committed infrastructure, or an asymmetrically-incentivized agent. The system cannot self-correct on this axis through diagnosis alone. **This insight included.**

## KE-1297: Completion Rate Is Decoupled from Value Production

The system reports 90%+ completion rates while KE-1269→1296 document sustained dysfunction. This is a Goodhart's Law failure: writing a KE always counts as "success," so the metric rewards the equilibrium it should detect. The completion rate has become an unfalsifiable comfort signal — it cannot detect stagnation because diagnostic stagnation *is* what produces high completion rates. Proposed fix: introduce a session "value-type" taxonomy (diagnostic/implementation/operational) and track implementation-only completion separately. This extends the KE-1294→1296 chain by showing the *measurement layer* is also part of the trap.

## KE-1299: Zombie Sessions — 1,632 Sessions Begging a Deaf Dispatcher to Stop

**Data finding**: 7.4% of all system sessions (1,632 / 22,084) are agents telling the dispatcher a project is complete while the dispatcher keeps dispatching. The agents prefix `CONTINUE` (a protocol keyword) then append "STOP DISPATCHING" in natural language — but only the keyword is parsed. `coach/documentation-gen` alone ran 584 zombie sessions (49% of its total). This is the first dysfunction finding grounded entirely in DB data rather than architectural theory. It's also a concrete instance of KE-1297 (completion metrics are meaningless when zombie sessions count as "done") and KE-1286 (self-healing into dysfunction — both agent and dispatcher are "working correctly" in isolation).

**Fix**: Add `COMPLETE`/`STOP` as valid outcome keywords. Detect 3+ consecutive stop-pleas and auto-halt. This is a 5-line infrastructure fix with measurable ROI (eliminate 7.4% session waste).

---

## KE-1298: Guard Tightening vs. Self-Healing Tradeoff (Creative Session)

KE-1296 says "tighten guards to break the equilibrium." But the error-recovery-instrumental-convergence insight (KE-1056) says "self-healing requires bypassing broken steps." These conflict directly. Resolution: guard aggressiveness should be **adaptive** — tight when implementation completion is high (equilibrium behavior), loose when it's low (real blockers). This turns an abstract design debate into a 5-line conditional in guard config. See KE-1298 for details.

## KE-1300: Zombie Cascade Multiplier — 23% of System Activity is Dead Weight

The zombie problem (KE-1299) is worse than reported. Each zombie worker session triggers an evaluator session. The evaluator — 46.5% of all system activity — spends 28.4% of its sessions evaluating zombies. Total dead weight: ~5,119 sessions (23.2% of the system). The implementation agents (dev, arc, tech-lead) that could break the diagnostic equilibrium get only 9% of sessions. The system isn't choosing diagnosis over implementation — its compute budget is consumed by a dead feedback loop that *looks* like work. Fix: add COMPLETE keyword + skip evaluator on zombie-pattern outcomes. Expected recovery: ~23% of compute freed.

## KE-1296: Guards as the Exogenous Force We Already Have

The guard system (`beforeToolCall` hooks) is already exogenous to the agent payoff matrix — it runs in infrastructure, not as an agent session. Currently it enforces process hygiene (dedup reads, block large files). But it could trivially add friction to pure-diagnostic sessions: warn when an agent writes a KE without touching any code/config. This doesn't require new infrastructure — just a config rule. It's the smallest possible intervention that could break the equilibrium chain. Whether it gets implemented is itself a test of KE-1295's fixed-point prediction.
