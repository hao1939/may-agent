
# Focus Tasks

Long-running improvement programs. These are NOT one-off tickets — they require
sustained effort, iteration, and patience over weeks/months. A focus task is "done"
only when the improvement is **observable in production metrics**, not when a doc is written.

## Lifecycle

Each task works on multiple items/agents/patterns. Per item, the cycle is:
```
discover → design → implement → try in production → evaluate → iterate or graduate
```

A focus task itself is never "done" — it's an ongoing program until the system
no longer needs it. Individual items within a focus task graduate through stages.

---

## F1: Heartbeat Optimization

**Goal:** Every agent's heartbeat session is efficient — low turns, high value, clear routing. Recurring tasks graduate from heartbeat.md to cron jobs when stable.

**Why it matters:** Heartbeats are our highest-volume sessions. Even small waste multiplies across hundreds of runs.

**Process (per agent):**
1. **Observe** current heartbeat sessions — what does the agent actually do? How many turns? What's wasteful?
2. **Redesign** the heartbeat.md — clear priorities, explicit task routing, no vague instructions
3. **Run 5+ sessions** with the new heartbeat — observe turn counts, quality
4. **Evaluate** — is avg turns < 6? Is quality ≥ 0.6? Are recurring tasks getting done?
5. **Iterate** — adjust instructions based on what we see
6. **Graduate recurring tasks** — when a task in heartbeat.md becomes stable and predictable, promote it to a cron job (per `cron-graduation-process.md`)

**Status per agent:**

| Agent | Phase | Sessions Observed | Avg Turns | Quality | Notes |
|-------|-------|-------------------|-----------|---------|-------|
| Bob | redesigned, needs observation | 0 since redesign | ? | ? | Heartbeat.md rewritten 2026-03-22. Need 5+ sessions to evaluate. |
| Amy | redesigned, needs observation | 0 | ? | ? | XHS exploration added as step 3. Need to verify it works. |
| Coach | redesigned, needs observation | 0 | ? | ? | Coaching needs scan added as step 3. |
| Evaluator | redesigned, needs observation | 0 | ? | ? | Calibration check added as step 4. |
| Optimizer | redesigned, needs observation | 0 | ? | ? | Opportunity scan added as step 3. |
| Scout | redesigned, needs observation | 0 | ? | ? | Research scan added as step 3. Coach report says 18 turns — too many. |
| May | redesigned, needs observation | 0 | ? | ? | Captain loop. |

**Graduation pipeline:** See `agents/shared/cron-graduation-process.md` — tasks move from heartbeat.md → agent cron job → JS handler as they stabilize.

**Next action:** Wait for heartbeat cycles, then review first 5 sessions per agent and fill in the table.

---

## F2: Pattern Recognition & Workflow Automation

**Goal:** Continuously discover recurring work patterns from session data and build workflows/automations that eliminate waste.

**Why it matters:** Agents repeat the same sequences over and over. Every pattern we automate saves tokens, reduces errors, and improves consistency.

**Process (per pattern):**
1. **Discover** — scan recent evaluations/sessions for recurring sequences, failure modes, or manual work that repeats
2. **Document** — write a proposal in `agents/shared/workflow-proposals/` describing the pattern, frequency, and proposed automation
3. **Implement** — build the workflow/handler/tool (via coder)
4. **Try** — run it in production on real tasks
5. **Evaluate** — did it actually help? Compare before/after quality, turns, cost
6. **Iterate** — fix issues, adjust, re-evaluate
7. **Graduate** — mark as stable, add to standard toolbox

**Discovered patterns:**

| Pattern | Phase | Proposal | Implementation | Production Tries | Result |
|---------|-------|----------|----------------|-----------------|--------|
| Blind overwrite after truncation | 4-production-ready | `safe-edit.md` | `safe-edit.ts` | 1 (test) | SUCCESS |
| Cron system extension sequence | 2-documented | `enhance-cron.md` | Not started | 0 | — |
| (more to discover) | — | — | — | — | — |

**Ongoing work:**
- Bob scans evaluations for new patterns (via heartbeat rotation)
- Optimizer implements proposals that are ready
- Evaluator tracks before/after quality for implemented workflows

| Skill vetting (security) | 5-production-ready | `ralph-experiment-1-retro.md` | `vet-skill.ts` | 1 (test) | SUCCESS |
**Next action:** Instruct May/Coder to use `safe-edit` workflow instead of raw write for large files. (Or update their domain.md to point to this tool).

---

## F3: Active Coaching Pipeline

**Goal:** Continuously identify underperforming agents and improve them through targeted coaching exercises.

**Why it matters:** Agent quality varies widely. Without active coaching, bad patterns persist and compound.

**Process (per coaching need):**
1. **Detect** — automatic: evaluations trigger coaching items when verdict=needs_improvement. Manual: periodic review of agent quality trends.
2. **Diagnose** — coach reads the session, identifies the root cause (skill gap? bad instructions? missing knowledge?)
3. **Design exercise** — create a targeted exercise that tests the specific weakness
4. **Run exercise** — coach spawns the agent with the exercise
5. **Evaluate** — did the agent demonstrate improvement? Score against specific criteria.
6. **Iterate** — if not improved, try different approach. Update agent's knowledge/domain.md.
7. **Track** — update COACHEES.md. 3 consecutive passes = graduated from active coaching.

**Infrastructure status:**
- [x] Reactive trigger code: may.ts auto-eval → writes to coach's todo on needs_improvement
- [x] Reactive trigger code: evaluate-sessions handler (backup path)
- [x] End-to-end verification: Triggers confirmed firing (Coach todo populated with sessions 34, 22, 14).
- [ ] Coach heartbeat scans for coaching needs when todo is empty (instructions in heartbeat.md, not yet observed)

**Active coaching per agent:**

| Agent | Sessions Coached | Last Result | Phase | Next Action |
|-------|-----------------|-------------|-------|-------------|
| Scout | 1 | PASS 8/10 (1/3) | observe next session | Verify improvements: dedup canonical archive, budget discipline |
| Amy | 0 | — | pending | Run Amy-Kimi exercise (in coach's todo) |
| Coder | 1 (blind-overwrite) | PASS | monitor | Check if safe-edit patterns appear in new sessions |
| QA | 1 (truncated-read) | PARTIAL | needs follow-up | Design follow-up exercise |
| Bob | 0 | — | not started | Wait for trigger or quality review |
| Optimizer | 0 | — | not started | Wait for trigger or quality review |
| Evaluator | 0 | — | not started | Wait for trigger or quality review |

**Next action:** Monitor Coach execution to ensure items in todo are processed correctly.

---

## F4: Explore-to-Implement Pipeline (Ralph Loop)

**Goal:** Build a reliable process that takes discoveries (from Amy/Scout/human) through analysis, design, implementation, and verification — closing the gap between "interesting finding" and "running in production."

**Why it matters:** Right now discoveries rot in markdown files. Amy finds things, Scout finds things, nobody drives them to implementation. Knowledge without action is waste.

**Process:**
1. **Explore the concept** — understand RALPH and similar patterns deeply (not just name-mapping)
2. **Pick a real discovery** — find ONE concrete finding sitting in Amy/Scout's workspace that hasn't been acted on
3. **Run it through the pipeline manually** — Research → Bob analyzes value → design spec → implement → verify
4. **Retrospective** — what worked? Where did handoffs break? What took too long?
5. **Pick second discovery** — run again with adjustments from the retro
6. **Iterate** — keep running experiments, refining the process each time
7. **Formalize** — after 3+ successful end-to-end runs, codify what works as a workflow/standard process

**Experiments:**

| # | Discovery | Source | Analysis | Design | Implementation | Verification | Retro |
|---|-----------|--------|----------|--------|----------------|--------------|-------|
| 1 | Skill Vetter | Amy/Scout | Done | `ralph-experiment-1-retro.md` | `vet-skill.ts` | Pass (caught b64+pipe) | `ralph-experiment-1-retro.md` |

**Current status:**
- [x] Initial design doc: `agents/shared/ralph-loop-design.md`
- [x] **Experiment 1 Complete:** `vet-skill` workflow implemented and verified.
  - **Source**: Amy Insights (Compact #82) & Scout Discovery 7e (Skill-Inject).
  - **Outcome**: Created a static analysis tool that blocks `base64`, `curl|sh`, `eval` in skill files.
  - **Learning**: Verification step is critical. Initial regex was too narrow; verification caught it; fix applied immediately. This proves the value of the loop.
- [ ] Second experiment: pick another discovery.

---
