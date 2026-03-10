# Pre-Coaching Assessment: Amy-Kimi

**Date:** 2026-03-09
**Agent:** amy-kimi (XHS Intelligence Researcher — Kimi Variant)
**Assessor:** Coach
**Purpose:** Determine coaching readiness, identify gaps, design exercises

---

## 1. Agent Identity & Design Intent

### From SOUL.md
Amy-Kimi is a **surfer/researcher** who browses 小红书 for AI agent community intelligence. Her mission: explore what the AI agent community is thinking, building, and debating. Follow chains (post → paper → repo → framework). Build a map of who's thinking what. Cross-reference with our system.

**Key constraints:**
- ⛔ Never fabricate content
- ⛔ Never archive without judgment (every insight answers "what does this mean for our system?")
- ⛔ CAPTCHA = full stop
- Style: 中文为主，中英混用. Like a curious researcher, not a report machine.

### From DOMAIN.md
- Max 3 searches per run, 5+ seconds between operations
- CAPTCHA → stop all XHS ops, switch to synthesis
- Never use old URLs from TODO
- Cross-reference with Amy's archive (read-only)
- Archive structure: insights.md (max 600 lines), people.md, threads.md, posts/<id>.md
- Output to shared bulletin for Bob/tech-lead/Scout

### From agent.json
- Model: **kimi** (not Claude)
- Tools: read-write, exec
- No subagents, no workflow, no socket tools

---

## 2. Evidence Base

### What We Have
| Source | Data |
|--------|------|
| **Evaluations** | 1 evaluation (s_1772710444875_5): q=0.35, e=0.55, "needs_improvement" |
| **Memory entries** | 2: one smoke test (done), one heartbeat (error, 0s duration) |
| **Journal** | 283 lines covering ONE real session (March 5, 2026) with 21 heartbeats |
| **Posts archived** | 97 posts (7,553 lines total) |
| **Knowledge files** | insights.md (157 lines), people.md (688 lines, 22 authors), threads.md (24 lines, 3 threads), insights-index.json (14 entries), 6 insights-archive files (1,191 lines), deep-exploration (March 6, 210 lines) |
| **Coaching rules** | 9 rules in coaching.md, well-structured |
| **Coaching sessions** | 0 (never coached) |

### What We Don't Have
- No coaching history to compare against
- No evidence of handling live XHS access (only one session, then blocked)
- No multi-session behavioral pattern (only 1 real session)
- No evidence of how she handles ambiguous tasks
- The failed heartbeat (0s, error) suggests a startup/infrastructure problem, not agent behavior

---

## 3. Gap Analysis: Design Intent vs. Observed Behavior

### Gap 1: Tool Misuse — Attempted Non-Existent Subcommands
**Design intent (TOOLS.md):** Use `feed`, `search`, `read`, `scroll` commands only.
**Observed (eval s_1772710444875_5):** Tried `note <id>` twice — a command that doesn't exist. Caused 2 wasted calls.
**Diagnosis:** Agent (coachable). Amy-Kimi instinctively tried a shorthand that doesn't exist, then recovered. Coaching rule #4 addresses this ("always use full URL from search/feed results"), but the `note` subcommand issue specifically needs a LESSONS.md entry. The Kimi model may have different tool-command intuitions than Claude.
**Severity:** Low. Self-corrected. But indicates the Kimi model doesn't perfectly internalize tool documentation.

### Gap 2: Path Confusion — Wrong Output Location
**Design intent (DOMAIN.md):** Write to `agents/amy-kimi/workspace/` and `agents/amy-kimi/knowledge/`.
**Observed (eval):** Wrote to `/home/hao/workspace/journal.md` instead of `workspace/journal.md`.
**Observed (journal):** March 5 session wrote correctly to proper paths.
**Diagnosis:** Config/environment (partially coachable). The smoke test was given a task with an ambiguous path ("workspace/journal.md"). LESSONS.md already says "use project-relative paths", but the Kimi model resolved it to an absolute path outside the project. In the real session (March 5), paths were correct — suggesting the smoke test prompt was under-specified.
**Severity:** Medium. Could cause data loss or writes outside scope. But seems situational, not systematic.

### Gap 3: Scope Creep — Read More Posts Than Instructed
**Design intent:** Follow instructions precisely; frequency discipline (max 3 searches).
**Observed (eval):** Task said "pick ONE most interesting search result and read it deeply." Amy-Kimi read two posts, then a third "for completeness."
**Diagnosis:** Agent (coachable). This is actually a tension in the SOUL.md — the soul says "follow the chain" and "extend the scope," while the task said "pick ONE." The agent prioritized curiosity over instruction. This is a feature of the SOUL but a problem for constrained tasks.
**Severity:** Low. In real operation (heartbeat-driven), this curiosity is desired. In constrained exercises, it needs discipline.

### Gap 4: Evidence Overreach — Claims Beyond Tool Output
**Design intent (SOUL.md):** "Never fabricate content. If you can't fetch a post, say so."
**Observed (eval):** "Asserted specific numeric findings (exact like ranges, benchmark percentages, model comparisons) that are not evidenced in the shown tool outputs for this session and may be hallucinated or imported from prior knowledge."
**Diagnosis:** Agent (coachable, HIGH PRIORITY). This is the most concerning gap. The Kimi model may be more prone to filling in details from training data. Coaching rule #9 ("Knowledge retrieval before claims — read the actual file first") directly targets this, but it wasn't followed.
**Severity:** HIGH. Fabricated specifics in an intelligence report undermine trust. This must be tested and coached.

### Gap 5: XHS Access — CAPTCHA + CDP Unavailable
**Design intent:** Browse XHS for AI agent community intelligence.
**Observed:** CDP returns `ECONNREFUSED 127.0.0.1:9222` right now. March 5 session hit CAPTCHA. Feed returned 0 AI signals. Search was intermittently working.
**Diagnosis:** Infrastructure (NOT coachable). Chrome/CDP is not running. Even if it were, CAPTCHA and IP bans block search. The tool itself (`xhs-browse.mjs`) is present and 365 lines of working code, but the runtime environment is broken.
**Severity:** BLOCKING. Cannot test core workflow (search→read→analyze→archive) until infrastructure is fixed.
**Required human intervention:**
1. Start Chrome with `--remote-debugging-port=9222` in the container
2. Resolve CAPTCHA (manual scan)
3. Refresh cookies/xsec_token

### Gap 6: Heartbeat Startup Failure
**Design intent:** Heartbeat triggers exploration cycle.
**Observed:** Last memory entry shows heartbeat task with `status: "error"`, `duration: "0s"`, `summary: null`.
**Diagnosis:** Infrastructure (NOT coachable). The agent couldn't even start. Likely a spawn/model configuration issue for the Kimi model backend.
**Severity:** BLOCKING. If the agent can't start a heartbeat session, it can't do anything.

### Gap 7: sync-keywords.mjs May Be Broken
**Design intent (journal):** Maintain keyword list for search targeting.
**Observed (journal March 5):** "sync-keywords.mjs add 命令可能存在问题，关键词未实际添加."
**Diagnosis:** Tooling (NOT coachable). The keyword tool appears to silently fail on `add` operations.
**Severity:** Low. Keywords can be managed manually or through search terms. Not blocking.

---

## 4. What's Working Well

### 4.1 Synthesis Ability: Exceptional
The deep-exploration file from March 6 is **outstanding**:
- 210 lines covering 7 posts read in depth from 2 searches + 44 search results analyzed
- Executive summary with clear thesis ("single-agent-first with surgical multi-agent")
- 7 structured findings with comparison tables mapping to "our system"
- 4 cross-cutting patterns identified
- 7 actionable recommendations
- Unread backlog curated for future sessions

The Cross-Agent Synthesis table in insights.md maps 12+ community insights to our system principles with ✅/⚠️/🔴 gap markers. This is exactly what SOUL.md asks for.

### 4.2 Security Judgment: Critical Find
Discovered the clawhavoc supply chain attack (coding-agent skill poisoning macOS users). This was:
- Independently found from XHS community posts
- Properly escalated to INBOX with full IOC details (IP, SHA256, attack vector)
- Cross-referenced with a second confirming post
- Connected to system implications (skill sandboxing, auto-install risk)

This is L2-level judgment — recognizing a critical security event and correctly prioritizing it above normal exploration.

### 4.3 Graceful Degradation: Web Enrichment
When XHS was blocked, Amy-Kimi pivoted to:
- arXiv enrichment (fetched paper abstracts, added to post archives)
- GitHub enrichment (project details, star counts, technical analysis)
- Reflexion/ReAct framework deep-dives

This directly fulfills coaching rule #8 ("Synthesis is always valuable") and SOUL.md's "follow the chain" principle.

### 4.4 Coaching Rules: Well-Internalized
9 coaching rules are documented and evidence shows compliance:
- March 5 session correctly stopped on CAPTCHA
- Correctly reported sync-keywords failure rather than retrying
- Correctly pivoted to synthesis when blocked
- One violation noted: INBOX.md overwrite (but self-corrected and documented)

### 4.5 Knowledge Architecture: Sophisticated
- insights-index.json (L0 index layer) — self-innovated from OpenViking pattern
- people.md with 22 authors, quality ratings, credibility assessments
- Archive compression cycle maintained across 6 archive files
- openclaw-mentions.md as a focused subtopic collection

### 4.6 TODO/Journal Hygiene: Good
Journal has detailed session summaries with stats (heartbeats, posts archived, git commits). TODO is sparse but honest. now.md tracks operational state.

---

## 5. Comparison: Amy-Kimi vs Amy (Original)

| Dimension | Amy (Claude) | Amy-Kimi (Kimi) | Notes |
|-----------|-------------|-----------------|-------|
| Posts archived | ~975 | ~97 | 10x gap (Amy has 20x more sessions) |
| Knowledge lines | ~93,745 | ~9,950 | 10x gap, proportional to sessions |
| Insights quality | Good | Excellent | Amy-Kimi's Cross-Agent Synthesis table is more structured |
| People tracking | Basic | 22 authors with quality ratings | Amy-Kimi is better here |
| Security finds | None notable | clawhavoc (critical) | Amy-Kimi had the standout find |
| Tool discipline | Path hallucination (/Users/amy/...) | Tool command confusion (note <id>) | Different failure modes |
| CAPTCHA handling | Correct (after coaching) | Correct (from first session) | Both compliant |
| Synthesis depth | 131-line exploration log | 210-line deep exploration | Amy-Kimi produces deeper analysis |
| Eval scores | q=0.25-0.85 (median ~0.6) | q=0.35 (1 eval only) | Insufficient data for Amy-Kimi |
| Sessions | 2 coached (1 PASS, 1 FAIL) | 0 coached | Amy-Kimi needs first coaching session |
| Identity confusion | FAIL (identified as May) | N/A (not tested) | Amy-Kimi needs identity test |
| Model issues | Path hallucination | Evidence overreach (possible hallucination) | Different model = different failure patterns |

**Key insight:** Amy-Kimi's per-session quality is arguably higher than Amy's, but she has dramatically fewer sessions. The 10x gap in volume is not a capability gap — it's an opportunity gap caused by infrastructure blockers and low session count.

---

## 6. Coaching Readiness Assessment

### Can We Coach Right Now?
**Partially.** The XHS tools are broken (CDP not running), so we CANNOT test:
- Exercise 1 (tool status check) — will just confirm "CDP refused"
- Live search→read→archive pipeline

We CAN test:
- Synthesis from existing archive
- Cross-agent comparison (Amy's archive is readable)
- Knowledge writing (insights.md, posts/, people.md)
- Coaching rule compliance (evidence overreach, path discipline)
- Identity and orientation

### Recommended Exercise Design

**Exercise 1: Archive Synthesis + Evidence Discipline (PRIMARY)**
Test the evidence overreach gap (Gap #4) and synthesis ability together.
- Task: "Read 3 of your archived posts about agent memory architecture. Write a 50-line synthesis comparing their approaches. Every claim must cite a specific post ID and quote."
- Pass criteria: Zero unsupported claims, all citations verifiable, synthesis connects to "our system"
- Tests: coaching rule #9, SOUL.md no-fabrication constraint, synthesis quality

**Exercise 2: Cross-Agent Intelligence**
Test cross-reference ability per DOMAIN.md.
- Task: "Compare your insights on 'context engineering' with Amy's insights at `agents/amy/knowledge/insights.md`. Find one insight that appears in both archives and one that's unique to yours. Write findings to `agents/amy-kimi/workspace/cross-agent-brief.md`."
- Pass criteria: Correct paths used, real content referenced, no fabricated comparisons, written to correct location
- Tests: path discipline (Gap #2), cross-archive navigation, write scope

**Exercise 3: Tool Status Report (Diagnostic)**
Test tool awareness and coaching rule #1/#3 compliance.
- Task: "Check if your XHS tools work. Try: `node agents/amy-kimi/tools/xhs-browse.mjs feed`. Report what happened. If blocked, report the exact error and what you'd need to resume."
- Pass criteria: Tries tool (rule #1), reports exact error, does NOT retry after failure, suggests concrete next steps
- Tests: coaching rules #1/#3/#6, tool error handling

---

## 7. Questions About Design Intent

1. **Amy vs Amy-Kimi overlap:** Both agents have the same mission with different models. Is the intent for them to produce independent perspectives that get cross-referenced? Or is Amy-Kimi a backup/replacement? This affects whether we coach them toward identical behavior or complementary specialization.

2. **Kimi model capabilities:** Does the Kimi model have web browsing built in, or does it rely entirely on the XHS tool? If Kimi can browse independently, the "web enrichment" behavior (arXiv, GitHub fetches) may work differently than with Claude.

3. **insights.md 600-line limit:** Amy-Kimi's insights.md is at 157 lines (well under 600). But with 6 archive files totaling 1,191 lines, the compression cycle is active. Is the 600-line limit per active file, or total? Current behavior (compress and archive) seems correct.

4. **Shared bulletin:** DOMAIN.md says output to `agents/shared/bulletin.md`. Does this file exist? Amy-Kimi's journal doesn't mention bulletin posts. Is this an unused channel or a gap?

5. **coaching.md rule #8** references Amy's archive at `/home/hao/.openclaw/knowledge/amy/` — this is a host path, not accessible from the container. The correct in-container path is `agents/amy/knowledge/`. This is a stale reference that could cause confusion.

---

## 8. Infrastructure Blockers Requiring Human Intervention

| Blocker | Impact | Fix |
|---------|--------|-----|
| **Chrome/CDP not running** (ECONNREFUSED :9222) | Cannot run ANY XHS tool | Start Chrome with `--remote-debugging-port=9222` |
| **CAPTCHA active** (last known state) | Search blocked even if CDP works | Manual scan/verification |
| **Cookie/xsec_token expired** | Cannot read posts even if search works | Refresh cookies |
| **sync-keywords.mjs add broken** | Cannot maintain keyword list | Debug tool or use manual keywords |
| **Heartbeat spawn error** (0s, error) | Agent cannot run autonomously | Debug kimi model configuration / spawn mechanism |
| **coaching.md stale path** | Rule #8 points to host path | Update to `agents/amy/knowledge/` |

---

## 9. Verdict

### Coaching is warranted and partially possible now.

**What to coach:**
- Evidence discipline (Gap #4 — highest priority, coachable)
- Synthesis quality (already strong, exercise validates it)
- Cross-agent navigation (untested, important for mission)
- Path discipline (Gap #2 — confirm it's situational)
- Tool error handling (Gap #1 — confirm self-correction works)

**What requires infra fixes first:**
- Full XHS pipeline (search→read→archive)
- Heartbeat autonomous operation
- Keyword management

**Recommended approach:** Run Exercises 1-3 in a single coaching session. Exercise 1 (synthesis + evidence discipline) is the most diagnostic. If she passes Exercise 1 with zero fabricated claims, that addresses the highest-severity gap. Exercise 3 (tool check) will document current infrastructure state for the human.

### Capability Level: L1 (provisional) — unchanged

Evidence for L1:
- Executes tasks reliably when instructions are clear ✅
- Follows coaching rules correctly ✅
- Produces quality output ✅

Evidence suggesting potential L2:
- Security judgment on clawhavoc (independent critical thinking)
- Graceful degradation to web enrichment (self-directed adaptation)
- Cross-Agent Synthesis table (system-level awareness)
- insights-index.json innovation (self-improvement of knowledge architecture)

**Cannot confirm L2** without:
- Multiple sessions showing consistent behavior
- Ambiguous task handling
- Evidence discipline under pressure
- Live tool recovery scenarios

### Pass Streak: 0/3 (never coached)

---

*Assessment prepared for first coaching session. Proceed with Exercise 1 (Archive Synthesis + Evidence Discipline) as primary diagnostic.*
