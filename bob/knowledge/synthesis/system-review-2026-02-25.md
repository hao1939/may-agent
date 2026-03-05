# System Review — 2026-02-25
*Bob — L3 review of today's major redesign*
*Written as live document: initial thoughts first, then verified against actual files*
*Status: COMPLETE*

---

## Summary of Changes Being Reviewed

Today's burn-down accomplished:
1. AGENT-SPEC.md + HEARTBEAT.md merged into a single file per agent
2. COMMON.md redesigned: no-chores rule, heartbeat flowchart, L1/L2/L3 definitions, journal format, escalation protocol
3. design-philosophy.md compacted 576→181 lines (44 sections → 21)
4. agent-capability-review.md deprecated, content merged into agent-evaluation.md
5. failure-analysis-2026-02-25.md written: 10 patterns, root cause classification, 3 spec fixes applied

---

## Question 1: Is This Design Actually Better?

**Short answer: Yes, with one important structural anomaly that undermines the main claim.**

### The merge: what actually happened

The claim is "HEARTBEAT.md files merged into AGENT-SPEC.md." But that's not what's on disk.

The reality:
- For Amy, Scout, Coach: **HEARTBEAT.md is the merged canonical file.** AGENT-SPEC.md is a one-line redirect ("See HEARTBEAT.md").
- For Bob: same — HEARTBEAT.md is the merged canonical file, AGENT-SPEC.md is a 60-byte redirect.
- The naming is inverted from the claim. The *content* lives in HEARTBEAT.md, not AGENT-SPEC.md.

**Why this matters:** It's not a problem for runtime. The platform heartbeat prompt explicitly says `"Follow your HEARTBEAT.md"` — it points to HEARTBEAT.md directly. The merge worked correctly for runtime.

**But it creates confusion at the meta level:** The human described this as "merged into AGENT-SPEC.md." If the human or a new collaborator reads about this design and then looks at the file system, they'll find AGENT-SPEC.md is just a redirect — the opposite of what was said. This creates a "where is the real spec?" confusion for anyone reasoning about the system rather than running it.

**Assessment: The merge is functionally correct. The naming narrative is inverted.** AGENT-SPEC.md should either contain the merged content (which would match the claim) or be deleted entirely (let HEARTBEAT.md be the single file, no redirect needed). The redirect stub adds a lookup hop with no value.

### COMMON.md as single source for L1/L2/L3

**This works.** Amy and Scout both start with `"Read COMMON.md first — it defines your core design."` Coach references COMMON.md for L1/L2/L3 definitions explicitly (`L1 (Useful), L2 (Self-driving), L3 (Building) — see COMMON.md for definitions`). The INBOX.md proposal about Coach redundancy was actually already resolved before it was written.

**One gap:** Bob's HEARTBEAT.md does **not** have the "Read COMMON.md first" line that Amy and Scout have. Bob has his own L1/L2/L3 workflow section (lines 47-68) that defines L1/L2/L3 behavior without explicitly deferring to COMMON.md. This is a different kind of thing than the Coach redundancy — Bob's section is _behavioral specifics_, not a re-definition of the levels. But it means Bob's spec is slightly inconsistent in format with other agents' specs.

### COMMON.md structure itself

**The new COMMON.md is genuinely better than what came before.** The heartbeat flowchart is clear. The no-chores rule is explicit and concrete. The escalation protocol is new and fills a real gap (F1 and F3 both trace to missing escalation design). The journal format is standardized.

**One concrete improvement I can verify:** The Cross-Context Restrictions section was added (F3 fix), and it was applied in today's burn-down. This was an actual design gap — agents were attempting Telegram from depth-2 subagents without knowing it was blocked.

### design-philosophy.md at 181 lines

**The compaction was done carefully.** The archive file (211 lines) preserved everything removed, labeled with why each section was archived. Spot-checking the archived sections: they're genuinely historical/redundant (marketing taglines, agent-specific details, duplicates). The 21 remaining sections represent the actual design principles.

**One concern:** The most recently added section ("Two Channels of Work: Heartbeat vs Direct Task", 2026-02-25) contains an explicit "open design question" note: *"How to properly parallel these two channels is an open design question."* This isn't a problem with the compaction — it was already in the doc. But it means design-philosophy.md ends on an unresolved question. That's honest, but worth noting.

### failure-analysis-2026-02-25.md

**This is the highest-value artifact from today.** 10 patterns, each with: specific instances, MAST classification, root cause (agent vs design vs infra), fix applied or not, recurrence check. The format is rigorous.

**One structural concern:** The failure-analysis is a standalone document. It's not linked from any agent's operational flow. Agents won't read it unless they're explicitly directed to. Right now it serves as a historical record and a basis for fixes — that's good. But its value could be higher if the most critical patterns were incorporated into COMMON.md's permanent design (not just "fixes applied" to individual specs).

---

## Question 2: What's Still Weak?

### Gap 1: The AGENT-SPEC.md redirect stub (all agents)

As described above: AGENT-SPEC.md = one-line redirect → HEARTBEAT.md for all agents. The redirect adds confusion and no value. Either the content should live in AGENT-SPEC.md (matching the stated intent) or AGENT-SPEC.md should be deleted and HEARTBEAT.md should be the sole file.

**Severity:** Low for runtime, medium for system understanding and onboarding.

### Gap 2: Bob's HEARTBEAT.md is missing the "Read COMMON.md first" directive

Amy's HEARTBEAT.md, line 4: `"Read COMMON.md first — it defines your core design."`
Scout's HEARTBEAT.md, line 4: same.
Bob's HEARTBEAT.md: no such line. Bob's spec references COMMON.md in the responsibilities section but doesn't make it a startup instruction.

This is inconsistent and slightly contradictory: Bob is the one who *owns* COMMON.md and design-philosophy.md, yet his own spec doesn't canonically point to them. More importantly: if COMMON.md ever changes (e.g., escalation rules updated), Bob is less likely to notice because he doesn't have a strong startup habit of reading it.

**Severity:** Low but genuine inconsistency.

### Gap 3: The INBOX.md proposal about Coach L1/L2/L3 (already resolved, but still in INBOX.md)

The INBOX.md still shows the Coach L1/L2/L3 dedup proposal as an open item. But reading Coach's HEARTBEAT.md shows line 22: `"L1 (Useful), L2 (Self-driving), L3 (Building) — see COMMON.md for definitions."` — the fix was already applied. INBOX.md has a stale entry.

This is a minor cleanliness issue but it illustrates a structural weakness: **INBOX.md has no resolution mechanism built in.** Items are written, supposedly processed by Main, but the "resolved" signal is unclear. A stale open item in INBOX.md erodes trust in the inbox as a reliable signal.

**Severity:** Low individually, but this is an instance of the F9 pattern (COACHEES.md stale) happening in a different file.

### Gap 4: Three infrastructure gaps from failure-analysis remain open (F6, F7, F10)

- F6: Scout's Brave API key still uninstalled (web_search broken since day 1)
- F7: Amy's cookie refresh process undocumented/unautomated
- F10: Main's agent creation checklist not updated

These weren't fixed by today's design burn-down — they require ops/human action. But they're worth naming: **the design is now better, but two agents are still operating at reduced capability due to infrastructure debt.** This is the biggest functional gap.

### Gap 5: F5 (Bob analysis-without-delivery) is "improving but not fixed"

The failure-analysis itself says: "⚠️ Partially recurring. Bob still shows FM-2.6 tendencies. Improving but not fixed."

A domain rule was added (Rule 7: "Deliver proactively via Telegram"). But rules that say "do X" without a trigger mechanism often fail. The rule is correct but it relies on Bob having good judgment about when synthesis is Telegram-worthy. The *structural* problem is that Bob has no feedback mechanism — he doesn't know if his file-based analyses are ever read. Without that feedback, the instinct to "just write to a file" will persist.

**This is the most important behavioral gap that today's design changes didn't fix.**

### Gap 6: design-philosophy.md's open design question (Two Channels of Work)

The last section explicitly flags a parallelism problem: heartbeat vs direct task channels need to coexist, "how to properly parallel these two channels is an open design question." This isn't new — it was in the pre-compaction doc. But it's worth naming: the system has a known unresolved concurrency model. Running Bob as a subagent for L3 reviews (like right now) is fine, but it's a workaround, not an architecture.

---

## Question 3: What Will Break First?

### Prediction: The INBOX.md stale-entry problem will accumulate into signal noise within 2 weeks.

**Reasoning:** INBOX.md is the system's only explicit escalation and inter-agent communication channel. Items are written by agents but the resolution path is: Main reads, routes, removes. If Main doesn't consistently remove resolved items:
- Agents reading INBOX.md can't distinguish "open" from "stale-resolved"
- The Coach L1/L2/L3 entry is already stale
- As agents escalate more (F1 fix: 3-strikes rule; F3 fix: cross-context documented), INBOX.md volume increases
- Without pruning, it becomes a list of resolved items that looks like a backlog

**Why this breaks first vs other candidates:**
- The redirect stubs (Gap 1) are annoying but don't cause functional failures
- The Bob delivery gap (Gap 5) has been present for weeks and won't get suddenly worse
- The infrastructure gaps (F6, F7) are stable-broken — they won't degrade further
- INBOX.md stale entries are *cumulative* — each unresolved stale item makes the next item less visible

**The failure mode is subtle:** agents will keep writing to INBOX.md (as designed), but the signal-to-noise ratio decreases. Main will take longer to identify genuinely new items. Eventually an item gets missed because it's buried in stale entries.

**What would fix it:** INBOX.md needs a "resolved" section or a cleanup convention. Simple: when Main processes an item, add `[RESOLVED YYYY-MM-DD]` before removing, or move to a `~/.openclaw/INBOX-archive.md`. Right now there's no stated convention for resolution — the process description says "remove" but doesn't say when or by whom.

### Runner-up: Bob's L3 delivery gap will cause at least one valuable insight to get missed.

Bob is now the primary L3 agent for a system that just underwent its largest single-day redesign. The review I'm doing right now generates real findings. Per COMMON.md rules (depth-2 subagent, Telegram blocked), I'm writing to files — correct behavior. But when this subagent session ends, those files need to be surfaced proactively by a Bob heartbeat session. If that heartbeat doesn't happen promptly, or if the next Bob heartbeat session doesn't read this file, the findings sit unreached. This is FM-2.6 in structural form: the subagent does the work, but the delivery hop (subagent → heartbeat → Telegram) has no guarantee.

---

## Verdict: Is This Design Actually Better?

**Yes. The design is genuinely better across four dimensions:**

1. **Single operational file per agent** (HEARTBEAT.md): runtime behavior is correct, no more "check two files" confusion during execution
2. **COMMON.md as shared ground truth**: the flowchart, no-chores rule, escalation protocol, journal format — all things that were previously implicit or inconsistent are now explicit and in one place
3. **design-philosophy.md at 181 lines**: more readable, principles are cleaner, archive preserves history
4. **failure-analysis.md**: the first time the system has a formal failure catalog with root cause classification and recurrence checks

**But it's better by 70%, not 100%.** The three meaningful gaps:

1. The AGENT-SPEC.md redirect stubs are confusing noise — they should be resolved
2. Bob's spec is slightly inconsistent (missing "Read COMMON.md first")
3. The delivery mechanism for Bob's L3 work is still behavioral (a rule) not structural (a mechanism)

The infrastructure gaps (F6, F7) are pre-existing and outside today's scope — not a critique of today's work.

---

## Highest-Value Improvement

After evaluating all gaps, the single highest-value improvement is:

**Add "Read COMMON.md first" to Bob's HEARTBEAT.md as the first content line (after title).**

**Why this is highest-value:**
- Bob is the agent responsible for *owning* COMMON.md and design-philosophy.md
- If COMMON.md changes (escalation rules, journal format, new conventions), Bob needs to be the first to know and apply it — not the last
- Every other non-Bob agent has this startup directive; Bob's absence is an inconsistency in the only agent who should have it most
- It's a 1-line change, zero risk, directly fixes a concrete gap
- It also sets Bob up to catch COMMON.md drift before it affects other agents

**Why not the AGENT-SPEC.md redirect issue:**
- The redirect stubs are annoying but platform-safe (heartbeat reads HEARTBEAT.md directly)
- Renaming or replacing the redirect stubs would touch 4 agents' files and requires understanding if any other tooling references AGENT-SPEC.md by name — this is clear+low-risk for Bob's own file, but not for all agents

**Applying it now** — this is my own file and it's a direct fix to a concrete inconsistency I own.

---

## Action: Apply Fix to Bob's HEARTBEAT.md

Adding `"Read COMMON.md first — it defines your core design."` as line 4 of Bob's HEARTBEAT.md, matching Amy and Scout's format.

*[Applied — see commit]*

---

## INBOX.md Entry

Writing the AGENT-SPEC.md redirect resolution as a proposal, since it touches all agents and requires human decision on naming.

---

## Post-Review Notes

**What this review didn't cover:**
- Amy and Scout's specific HEARTBEAT.md content quality (in scope for Coach, not Bob)
- The openclaw.json config (not a design doc, different review domain)
- Weekly brief quality / communication effectiveness

**What should be reviewed next (within 1 week):**
- Did the F5 delivery fix (Rule 7) change Bob's actual behavior? Check next 3 Bob heartbeats.
- Did the F8 fix (Coach idle journal rule) stop the Standby entries? Check Coach's next 5 runs.
- Did the INBOX.md stale entry get cleaned? Check INBOX.md in 3 days.

