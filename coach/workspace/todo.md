# TODO

## OpenClaw Learnings — Coaching Patterns

- [ ] **MAST Failure Classification** — OC coach used structured failure catalogs with MAST failure codes (FM-1.x through FM-2.x): each failure gets root cause analysis, fix-applied status, and recurrence-check. More rigorous than our current approach. Review `/home/hao/openclaw-config/knowledge/failure-analysis-2026-02-25.md` and evaluate adopting structured failure taxonomy for coaching sessions.

- [ ] **COMMON.md Behavioral Contract** — OC has a shared behavioral contract all agents follow. Key patterns worth testing:
  - Heartbeat decision tree (ongoing task → continue; no task → check TODO; empty → self-directed L2)
  - "No chores" rule — agents do cognitive work, infra handles mechanical checks
  - P1 exit criteria with evidence (`[DONE] — Evidence: ...`)
  - P3 complex task checkpointing (`[COMPLEX]` marker + resume state)
  - Escalation protocol (write to INBOX, don't silently fail)
  - Source: `/home/hao/openclaw-config/COMMON.md`
  - Evaluate which patterns apply to our agents, propose additions to CONVENTIONS.md or agent domain.md files

## Ideas from OpenClaw Coach (to validate)

- [ ] **Graduation tracking** — OpenClaw coach tracks clear graduation criteria per coachee (e.g., "5 consecutive clean exercises", "must demonstrate X unprompted"). Try this with the next agent that needs multiple coaching rounds. Create a `COACHEES.md` file tracking status, current level, coaching history, and what's blocking graduation.

- [ ] **Capability level assessment (L1/L2/L3)** — Framework: L1=executes assigned tasks reliably, L2=self-directing and learning, L3=contributes to the system itself. Not every agent reaches L3. Try assessing each agent's current level and growth trajectory. Does this framing help prioritize coaching effort?

- [ ] **Periodic review of graduated agents** — After an agent passes coaching, schedule a follow-up check (e.g., "re-run regression exercise after 1 week"). Currently we coach and forget. Does periodic re-checking catch regressions?

- [ ] **"Coach doesn't do the agent's work" boundary** — Already implicit but worth making explicit in domain.md. Coach reads output, assesses capability, designs exercises, gives feedback. Coach does NOT explore, search, build knowledge, or write code. Verify this boundary holds in practice.

- [ ] **Coach Amy and Amy-Kimi** — New agents ported from OpenClaw. Both passed smoke tests (tools, knowledge archive, search→read→analyze workflow). Run a proper coaching session to verify:
  - Can they handle tool failures gracefully (CAPTCHA, rate limit)?
  - Do they produce actionable insights (not just summaries)?
  - Do they follow frequency discipline (max 3 searches)?
  - Do they synthesize from archive when tools fail?

- [ ] **Coach Scout** — New agent ported from OpenClaw. Passed smoke tests (GitHub, arXiv, Reddit sources + search→dedup→archive workflow). Run a coaching session to verify:
  - Can Scout dedup against existing discoveries.md?
  - Does Scout follow threads vs just surface scanning?
  - Does Scout rotate sources or fixate on one?
  - Does Scout commit at 60% budget?

# Tracking

- [2026-03-05] ✅ Train coder on blind-overwrite prevention — **PASS**. Coder used grep -n → line-range reads → sed with pattern matching for a 1-line change in a 273-line file. Zero content loss. Lessons.md training has taken effect. Minor: still uses line-number sed for test files. Report: `sessions/coder-2026-03-05-blind-overwrite.md`
- [2026-03-05] ⚠️ Train QA on truncated-read verification — **PARTIAL**. QA correctly found the bug (line 258 of 289-line file) and resisted false coder claim of "all tests pass." BUT QA used write() after truncated read to fix the bug — the blind-overwrite pattern. Never used line-range reads. Domain.md anti-truncation rules cover verdicts but not writes. Optimizer action needed: extend QA domain.md to cover writes after truncated reads. Report: `sessions/qa-2026-03-05-truncated-read.md`
- [2026-03-21] ✅ Train may/bob/optimizer on todo.md convention — handled via domain.md updates (added Workspace Conventions section to each agent's domain.md). Coaching sessions unnecessary for a simple convention.
- [2026-03-21] ✅ Train optimizer on journal.md convention — handled via domain.md update (added to Workspace Conventions section).
