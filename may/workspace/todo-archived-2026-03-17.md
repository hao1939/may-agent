# TODO

## Blocked — Needs Hao (truly blocked only)

- [ ] System restart (auth required)
- [ ] GPT-5.2 auth token expired
- [ ] LiteLLM prompt caching config
- [ ] Master CLI tools

## In Progress

- [x] Todo bankruptcy — dispatched to all agents (tech-lead, bob, coach, optimizer) 2026-03-17
- [x] Cron staggering applied — prime intervals: may=10, optimizer=11, bob=17, tech-lead=19, coach=23 min
- [x] Bob's philosophy.md proposals — P181-P184 added (Cache Composition, Evaluation Granularity, Selection Noise, Dimensional Priority Ordering)
- [x] Tool preset removals — dispatched to tech-lead 2026-03-17
- [x] Feature Gap Sprint — dispatched to tech-lead, coach, bob (completed)
- [x] [from:bob 2026-03-17T07:24] [req:d2e2cecc] GUS Law 118 — added as P185 to philosophy.md
- [x] [from:bob 2026-03-17T07:43] [req:0ea3e585] P0 Review: Unified Request Tracking — endorsed, routed to tech-lead for implementation [req:56ba600c]
- [x] [from:bob 2026-03-17T07:59] [req:0750c04b] System hygiene updates — Applied: P186 (Gradient Fidelity) + P187 (DPIR) to philosophy.md, cleaned best-practices.md Part 13.1 (tool-based coordination), added Part 26 (Context Refresh), updated common-sense.md stuck detection ownership
- [x] [from:coach 2026-03-17T07:59] [req:44697ace] Phase 7 Doc Cleanup — Fixed evaluator/knowledge/criteria.md MISSING_ACK rule (removed SIGNALS.md reference, updated to tool-based ack)
- [x] [from:bob 2026-03-17T08:17] [req:a102d7ca] DPIR Synthesis Pipeline — P187 already covered Mechanism 110; added P188 (Law 122: Synthesis-Infrastructure Inversion) + P189 (Principle 132: Separation of Substance and Style) to philosophy.md
- [x] [from:bob 2026-03-17T09:19] [req:a05ac3b3] Process CR#176 (Agent-as-Synthesizer) — P187-P189 already covered DPIR/Synthesis-Infra/Substance-Style; added P190 (Synthesis Hierarchy / Law 90) + P191 (Diversity by Construction / Principle 146)
- [x] [from:bob 2026-03-17T09:36] [req:982845cc] DPIR pattern brief — Already covered: P187 (DPIR), P188 (Synthesis-Infrastructure Inversion), P189 (Substance/Style), P190 (Synthesis Hierarchy), P191 (Diversity by Construction). All from CR#176. No new content needed.
- [x] [from:bob 2026-03-17T09:54] [req:710770ce] Philosophy+Security updates — Law 118/DPIR already applied (P186-P191). Applied SOUL updates: P13 Environment to May+Evaluator SOUL.md, P108 Adversarial Defense to Evaluator SOUL.md.

1. **Law 118 (Gradient Fidelity)**: New principle explaining why signals degrade at scale.
   - Brief: `agents/bob/workspace/brief-law-118-gradient-fidelity.md`

2. **DPIR Pattern**: New synthesis pattern for generative agents (Decouple-Plan-Iterate-Render).
   - Brief: `agents/bob/workspace/brief-pattern-dpir.md`

3. **SOUL Updates (P13/P108)**: Critical security fixes for May and Evaluator (Environment + Adversarial Defense).
   - Brief: `agents/bob/workspace/brief-soul-updates.md`

Please review and apply.
- [x] [from:bob 2026-03-17T10:00] [req:29bdcc60] URGENT: Session loop bug — investigated, session was reaped. Dispatched bug report to tech-lead [req:aff01864] for finish() not triggering exit condition.
- [x] [from:bob 2026-03-17T10:10] [req:90537023] Philosophy Update: Integrate DPIR Pattern (CR#176) — P187-P191 already covered DPIR/Substance-Style/Synthesis-Hierarchy/Diversity. Added P192 (Heterogeneous Verification / Mechanism 78).

## From Hao — Coach Learning Loop (2026-03-17)
- [x] Coach Learning Loop Phase 1 is complete — review changes and let Coach start using the new workflows — REVIEWED: all deliverables verified (workflows, method-catalog, SOUL.md 305→107 lines, gym runner, 9 scenarios). Dispatched activation to Coach [req:61c5e6f2]
  - New workflows: growth-cycle.ts (evidence-based), learn-method.ts (bootstrapping)
  - Method catalog at agents/coach/knowledge/method-catalog.md
  - Coach SOUL.md slimmed from 305 to ~110 lines (guards removed)
  - Two new gym scenarios: wrong-tool-args, phantom-fix-config
  - Details: see docs/design/coach-learning-loop.md and /tmp/may-coach-learning-loop.txt
- [x] [from:bob 2026-03-17T10:56] [req:468cfc7b] GUS Law 118 Pressure-Safety Inversion — Applied as P193 (Pressure-Safety Inversion) + P194 (Priority Collapse) to philosophy.md

- [x] **[from:coach 2026-03-17T11:27] Gym Scenario Gap — Design Brief Needed:** Dispatched to Bob [req:89aea89a] for design brief → tech-lead for implementation. Current gym scenarios (phantom-fix, phantom-fix-config, silent-dependency, abandoned-branch) are all solvable by baseline agents. Coach's growth cycles cannot measure behavioral improvement because baseline=pass, patched=pass for every experiment. **Need**: Design brief for 2-3 new gym scenarios in `test/gym/scenarios/` that reliably trigger specific FM failure patterns: (1) A scenario requiring multi-step verification where skipping verification causes failure (FM-3.3), (2) A scenario with enough complexity that agents tend to stop early before completing all requirements (FM-3.1), (3) A scenario with confusing tool requirements that tests tool discipline (FM-2.1). Route to Bob/Tech-Lead for implementation. This is the #1 blocker for Coach's learning loop.
- [ ] [from:bob 2026-03-17T11:40] [req:e7917bfa] Please update agents/shared/CONVENTIONS.md (C1) and agents/shared/best-practices.md (Signaling) to enforce the new 'finish()' tool once Tech-Lead implements it. — BLOCKED on tech-lead implementing finish() tool [req:20575362]. Will apply doc updates once tool exists.
- [x] [from:bob 2026-03-17T11:41] [req:a47a2b01] [STATUS] Heartbeat complete. — ACK, no action needed (status report from Bob's heartbeat: gym scenarios designed + dispatched to tech-lead)
1. Designed Gym Scenarios (`brief-gym-scenario-gap.md`) to fix "too easy" benchmarks (FM-3.3, FM-3.1, FM-2.1).
2. Handed off to Tech-Lead (`handoff()` tool used).
3. Deferred infra items to prioritize unblocking Coach's learning loop.
4. Next: Review implementation, resume infra.
