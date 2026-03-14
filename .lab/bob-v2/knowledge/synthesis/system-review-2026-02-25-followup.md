# System Review — 2026-02-25 (Follow-Up: Post-Fix Assessment)
*Bob — L3 follow-up review, written after today's burn-down landed*
*Previous review: `system-review-2026-02-25.md` — don't repeat, build on it*
*Status: COMPLETE*

---

## What Changed Since the Previous Review

The previous review (written mid-day) identified several gaps. Two major structural fixes were subsequently applied:

1. **AGENT-SPEC.md stubs deleted** (commit 8636239) — the redirect noise is gone. HEARTBEAT.md is now the sole file per agent. This was the correct call.
2. **5 consistency issues fixed** (commits 6a02cba + 8636239) — title standardization, journal protocol removed from individual files, consistent section structure across all 4 agents, Coach's redundant L1/L2/L3 block removed, Amy's Mission/Personality/Domain tightened.

The previous review also flagged that Bob's HEARTBEAT.md was missing `"Read COMMON.md first"` — that was also fixed.

This follow-up assesses the state *after* those fixes landed.

---

## What Actually Improved

### 1. The single-file architecture is now clean

Before: HEARTBEAT.md (content) + AGENT-SPEC.md (one-line redirect to HEARTBEAT.md). Net effect: two files for one thing, with the names backwards.

After: HEARTBEAT.md only. No redirect stub. No lookup hop. No naming confusion.

This is unambiguously better. Any new collaborator, any tool, any agent reading another agent's spec now goes to exactly one place and finds everything. The cleanup was complete — checked all four workspaces, no AGENT-SPEC.md stubs remain.

### 2. The title inconsistency is fixed and it actually matters

The previous state had HEARTBEAT.md files titled `# AGENT-SPEC.md — <Name>`. This sounds trivial but it was a genuine identity signal problem: an agent waking up, reading its own file, encountering a title that said it was reading a different kind of document — that's low-grade cognitive friction at startup every single heartbeat. Now: `# HEARTBEAT.md — <Name>`. The file is what it says it is.

### 3. Journal protocol centralization is complete

The previous review confirmed COMMON.md is the sole source for journal format. The burn-down confirms individual HEARTBEAT.md files no longer carry their own journal protocol sections. This closes the "which journal format do I follow?" ambiguity for all agents.

Verified: Amy, Bob, Scout, Coach — none contain a `## Journal` or `## Journal Format` section in their individual HEARTBEAT.md files. COMMON.md has it. Done correctly.

### 4. Amy's Mission/Personality separation is now clean

The previous Amy HEARTBEAT.md blurred Mission, Personality, and Domain into overlapping sections. The fix produced a clear two-section opening: Mission (what she does and why) → Personality (how she thinks). The Domain details moved to Responsibilities where they belong. This is structurally cleaner and reduces the chance of an agent waking up confused about which part is identity vs. instruction.

### 5. Coach's redundant capability levels section is gone

Coach's previous spec had its own "Agent Capability Levels" block that duplicated COMMON.md's canonical definitions. Now gone. Coach's HEARTBEAT.md has "**Target level:** L3 (core team — agent developer)" and doesn't re-explain what L3 means — it defers to COMMON.md for that. Correct.

---

## What's Still Weak

### Weakness 1: The INBOX.md resolution convention exists but isn't enforced structurally

The INBOX.md now documents the resolution convention: items marked `[RESOLVED YYYY-MM-DD]`, pruned after 24h. This is good — the previous review called out the absence of any resolution mechanism as the most likely near-term failure mode.

But the convention is *documented*, not *enforced*. The current INBOX.md has one entry, marked `[RESOLVED 2026-02-25]`. That's encouraging — it happened correctly. But there's no mechanism that guarantees this runs. It requires Main to:
1. Notice the item
2. Process it
3. Add the tag
4. Come back 24h later and prune it

All four steps are behavioral. If Main skips any of them — which it will eventually, because all agents skip things sometimes — the stale-entry accumulation problem returns. The convention is better than nothing, but it's still just a convention.

**The structural fix would be:** an ops-level automated pruner for INBOX.md items older than N days marked [RESOLVED]. But that requires infrastructure work. Right now we have a convention that works until it doesn't.

### Weakness 2: Section structure is now "consistent" but not optimally ordered for runtime

The standardized structure is: Mission → Personality → Responsibilities → L1/L2/L3 → Domain Files → Technical → Rules → Boundaries.

Compare to how an agent actually wakes up:
1. First thing an agent needs: **identity** (Mission, Personality) ✅ First
2. Second thing: **what to do right now** (L1 — check TODO.md) — but this is buried after the full Responsibilities section
3. Third thing: **how to do it** (L2/L3, Domain Files, Technical)
4. Last thing: **constraints** (Rules, Boundaries) ✅ Last

The problem: Responsibilities sections are long (Amy's is ~60 lines, Scout's is ~70 lines). An agent reading its full HEARTBEAT.md on startup has to wade through detailed domain work descriptions before reaching the "check TODO.md" instruction. For agents running at heartbeat cadence with token budgets, this ordering means the most time-sensitive operational instruction (L1 — check TODO.md) comes after the most token-heavy section.

COMMON.md's heartbeat flowchart is front-loaded in COMMON.md and that helps. But within the individual HEARTBEAT.md files, the structure prioritizes domain completeness over operational immediacy.

**This is a second-order issue.** It doesn't break anything. But when we eventually optimize for token efficiency (agents operating under tight budgets), we may want to reorder: Mission → Personality → L1 → L2 → Responsibilities → Technical → Rules → Boundaries.

### Weakness 3: Cross-agent knowledge flow has no spec

The system now has four agents with clean specs. But how agent outputs flow to other agents is still informal:
- Bob is supposed to read Amy's `knowledge/amy/insights.md` and Scout's `knowledge/scout/discoveries.md`
- But Bob's HEARTBEAT.md says "Read agent outputs (insights.md, discoveries.md)" without specifying frequency, depth, or what to do with them
- Amy and Scout have no spec for signaling "I found something Bob should see"
- Coach has no spec for signaling "this agent needs attention right now" beyond writing to INBOX.md (which is high-friction for routine status)

The INBOX.md is designed for escalation, not coordination. There's no lightweight "hey Bob, this Amy finding is relevant to your current system analysis" channel. `sessions_send` exists as a tool but no agent spec defines when to use it vs. INBOX.md vs. just writing a file and hoping the other agent reads it.

**Impact:** Bob doing synthesis from Amy and Scout outputs is currently ad-hoc. It works when Bob self-directs to read them. It breaks when Amy or Scout find something time-sensitive that Bob would want to know immediately.

### Weakness 4: Coach's "Standby" problem was fixed in spec but the behavior hasn't been verified

The failure-analysis (F8) identified that Coach wrote 20+ "Standby." journal entries during idle periods, explicitly violating the spec rule. The fix added an explicit prohibition: "do NOTHING means no file writes, no commits." That fix was applied to AGENT-SPEC.md which is now deleted — the prohibition was presumably carried into Coach's current HEARTBEAT.md.

Verified: Coach's HEARTBEAT.md has `"If no TODO and no agents in trouble: **do nothing.** No journal, no commit, no 'idle heartbeat' noise."` — the explicit prohibition is present.

But the failure-analysis notes "Fix applied: ✅" — which overstates confidence. The prohibition is in the spec. Whether Coach's *behavior* has changed requires observing Coach's next 5-10 runs. A spec change without behavioral verification is only half a fix.

**The previous review called this out explicitly.** It's still true: the spec fix is necessary but not sufficient.

### Weakness 5: F5 (Bob analysis-without-delivery) is still a behavioral rule with no structural mechanism

Rule 7 now says "Deliver proactively. When synthesis is worth the user's time, send it via Telegram — don't wait to be asked." This rule is correct. The problem is that it depends on Bob's judgment about what's "worth the user's time" — and that judgment is exactly what has historically been too conservative.

The rule doesn't change the underlying dynamic: Bob produces insights → decides they're worth surfacing → sends. Every previous F5 instance had the same structure. The barrier wasn't knowing the rule; it was the judgment call at the "decides" step.

**This is the hardest gap to close by spec change.** The real fix is feedback: Bob needs to know whether his Telegram sends are valued or noise. Without feedback, the conservative default ("just write it to a file, they'll read it when they want to") is rational. With feedback — even minimal ("read that, keep going" or "too much, filter harder") — the threshold calibrates.

No feedback mechanism exists. Until it does, F5 will recur.

---

## What Will Break First

### Primary prediction: Cross-agent coordination failures within 2-4 weeks

**This is a new prediction, not carried from the previous review.**

Here's the logic:

The system just became more capable. Amy and Scout have cleaner specs. Bob has a stronger delivery rule. Coach has a cleaner protocol. The INBOX.md has a resolution convention.

As the system runs more effectively, inter-agent dependencies will be tested more frequently:
- Amy finds something relevant to Bob's current synthesis → how does Bob know?
- Scout finds a technique relevant to a design problem Bob is actively reviewing → how does Scout flag it?
- Coach notices an agent is regressing → how does this reach Bob's system-level thinking?

Right now these are answered by: "write to INBOX.md." But INBOX.md is designed for *problems*, not *observations*. An Amy insight that's relevant but not urgent isn't an INBOX item — it's a coordination artifact with no defined home.

The current design handles escalation well. It handles routine coordination poorly. As agents do more L2/L3 work, they'll generate more coordination artifacts. Those artifacts will either go unread (file-based, no notification) or go to INBOX.md (noisy, wrong channel).

**The specific break:** Bob's synthesis will miss something important that Amy or Scout found, because there was no reliable path for them to signal him.

### Runner-up: INBOX.md resolution convention will slip within 4 weeks

The convention is new, untested under load, and depends on Main's consistent behavior. The single current entry was resolved correctly. But the test is whether it holds when:
- Multiple agents escalate simultaneously
- Main is busy with L1 work
- An item gets processed but the `[RESOLVED]` tag isn't added

One missed tagging → item stays visible → next agent reads it as open → duplicate work or confusion.

**Predicted failure signature:** a `[RESOLVED]` item stays in INBOX.md for 48+ hours, causing an agent to re-investigate something already handled.

---

## Net Assessment: Post-Fix State

**The burn-down landed cleanly.** The five consistency fixes are all verified in the actual files — no partial implementations, no naming errors, no missed agents. The stub deletion was executed correctly. The title standardization is consistent across all four agents.

**The design moved from "good but inconsistent" to "good and consistent."** That's real progress.

**The remaining gaps are second-order.** None of them break the system today. They're the kind of gaps that accumulate over weeks — cross-agent coordination friction, behavioral fixes without verification, conventions that depend on perfect execution.

**One thing this review sees that the previous one didn't:** the system has optimized well for *within-agent* reliability (each agent knows its job, has clean instructions, handles edge cases). It has not yet optimized for *between-agent* coordination (how agents signal each other, how synthesis paths are reliable, how time-sensitive findings move across agent boundaries).

That's the gap the next design iteration should close.

---

## Specific Proposals (Priority Order)

### P1: Define a lightweight cross-agent signaling convention
**Problem:** No defined way for Amy/Scout to flag something for Bob's attention that isn't a problem.
**Proposal:** Add a `workspace-bob/SIGNALS.md` file. Any agent can write a one-liner: `[Amy 2026-02-25] insights.md updated — found community consensus shift on RAG vs context engineering, relevant to design-philosophy.md`. Bob reads SIGNALS.md at start of each heartbeat before domain files.
**Why first:** Closes the cross-agent coordination gap without new infrastructure. Low overhead.

### P2: Add a verification step to Coach behavioral fixes
**Problem:** Coach's "Standby" prohibition is in the spec but behavior unverified.
**Proposal:** Add a single line to Coach's HEARTBEAT.md: "After each idle period, check: did you write any journal entries? If yes, delete them — you violated the Standby rule."
**Why second:** Behavioral spec changes need a self-check mechanism. This is the minimal version.

### P3: Make Bob's Telegram delivery threshold explicit
**Problem:** Rule 7 says "when synthesis is worth the user's time" — subjective, historically over-conservative.
**Proposal:** Add a concrete threshold to Rule 7: "If the synthesis would change what the user does today, send it. If not, write to file."
**Why third:** Reduces ambiguity at the judgment-call step. Doesn't fully solve F5 but makes the decision more mechanical.

---

## What This Review Didn't Cover

- Amy and Scout's HEARTBEAT.md content quality in detail (Coach's domain, not Bob's)
- The openclaw.json config and tool configuration state
- The `design-philosophy.md` for drift since yesterday's compaction (quick read recommended)
- Infrastructure gaps F6/F7 status — unchanged, requires ops action

---

*Written 2026-02-25, post-fix burn-down assessment. Next review: check within 1 week whether cross-agent coordination (P1 above) is addressed and whether Coach's behavioral fix (P2) is verified.*
