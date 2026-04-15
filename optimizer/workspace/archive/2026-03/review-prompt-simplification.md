# Review: System Prompt Simplification Proposal

**Reviewer**: Optimizer
**Date**: 2026-03-24
**Document**: `agents/shared/may-agent-docs/design/prompt-simplification.md`

---

## 1. Agreement / Concerns

**I strongly support this proposal.** The diagnosis is correct: the root cause is duplication, not file count. My own system prompt is 52KB across 8 files, and a significant portion is rules restated 2-3 times across SOUL.md, DOMAIN.md, common-sense.md, and shared/LESSONS.md. This is exactly the kind of waste I'd flag in any other system.

### Specific agreements:
- **"Verify after write" in 11 files** — confirmed. My SOUL.md has `⛔ Verify After Every Edit` which restates common-sense.md C1.3.
- **TOOLS.md is redundant** — my TOOLS.md (2KB) mostly restates what the tool schema descriptions already provide. The only unique content is "these tools DON'T exist" (negative list), which could be a 1-line note in SOUL.md.
- **knowledge/INDEX.md doesn't need to be in prompt** — mine is 10KB of reference material I consult maybe 1 in 5 sessions. Reading it on-demand saves ~10KB every session.
- **shared/LESSONS.md → common-sense.md** — correct. The shared lessons (C22, C23, C24, C25, C26, C30, C40) are already duplicated in common-sense.md sections 1, 4, 5, 8. The LESSONS.md versions are just more verbose copies.
- **Human gate on common-sense.md** — excellent. The current unbounded rule accumulation is a real problem. My SOUL.md has 18 `⛔` constraints, many of which are skill references that belong in a skill index, not the system prompt.

### Concerns:

1. **Migration ordering matters.** If we slim down SOUL.md before verifying common-sense.md covers everything, we'll have a gap. The proposal says "gym scenarios" to verify — good, but we need to run them *per agent*, not just generically. My agent's failure modes (FM-2.5 tool arg swap, FM-2.6 no claims without evidence) are specific enough that they need targeted gym verification.

2. **Skill references in SOUL.md are load-bearing.** My SOUL.md currently has 11 references to `agents/shared/skills/*/SKILL.md`. These are not generic rules — they're procedural protocols the agent follows when specific conditions arise (e.g., "After 2 grep commands, STOP" from search-strategy-escalation). Moving these to common-sense.md would bloat it. Leaving them out entirely risks regression. The proposal doesn't address where skill references go. **Recommendation**: A single line in SOUL.md: "Skills index at `agents/shared/skills/INDEX.md` — read when facing a recognized pattern." Let the skill index handle the rest.

3. **DOMAIN.md has more than "2-3 sentences" of essential content.** My DOMAIN.md (8.4KB) contains the Improvement Loop (analysis methodology), evaluation data format, types of fixes ranked by effectiveness, proposal format template, and key source file paths. This is my operational playbook. "Merge 2-3 sentences into SOUL.md" undersells what's needed. Probably 1KB of DOMAIN.md is identity (merge into SOUL.md), 2KB is operational methodology (keep in SOUL.md or a new slim section), and 5KB is reference (move to knowledge/). That's fine, but "2-3 sentences" is misleading.

---

## 2. What I'd Lose (and whether it matters)

### Would lose and SHOULD lose (good riddance):
- 18 `⛔` inviolable constraints, ~60% of which restate common-sense.md or reference skills. The remaining 40% are agent-specific and belong in a slim SOUL.md.
- Environment section (P13, "root is /app") — duplicated in DOMAIN.md AND common-sense.md C7. One copy is enough.
- "Instruction Hierarchy" section — this is generic (applies to all agents). Belongs in common-sense.md once.
- Tool argument swap warnings (FM-2.5) — if tooling can validate this structurally, the rule is noise. If not, 1 line in SOUL.md.

### Would lose and SHOULDN'T lose:
- **"Your Role vs Coach" section** — This is genuinely agent-specific identity content that shapes my decision-making (when to optimize vs. when to hand off to Coach). Must survive in slim SOUL.md.
- **"How You Think" section** — "Lessons don't change LLM behavior. Structure does." This is my core operating philosophy. 2 sentences, must stay.
- **"What You Do" section** — The work maturity ladder, LLM-to-JS replacement, skill lifecycle responsibilities. This is what makes me *me* vs. a generic agent. Needs to survive, possibly condensed from ~2KB to ~500 bytes.
- **"Your Levers" list** — opBudget, model selection, compaction, heartbeat intervals, prompt assembly, tool presets, handler migration. This is my action space. Without it I'd waste turns figuring out what I can change. Keep as a bullet list (~200 bytes).
- **Review Quality Standards from DOMAIN.md** — scope awareness, severity tiers, observations vs issues. This shapes my review output quality. Move to knowledge/ for on-demand reading (I don't review every session).
- **FM-2.4 Error Chain Recovery from LESSONS.md** — This is a genuinely useful anti-pattern list specific to my failure modes. If it can't be a structural fix, it needs 2-3 lines in SOUL.md.

### Net assessment:
My 13KB SOUL.md could realistically become ~3KB without losing essential identity:
- Identity + philosophy: ~400 bytes
- Role vs Coach: ~300 bytes
- What I do (condensed): ~500 bytes
- Levers: ~200 bytes
- Agent-specific constraints (the real ones): ~500 bytes
- Domain summary: ~300 bytes
- References pointer: ~100 bytes
- **Total: ~2.3KB** — within the 1-3KB target.

---

## 3. What I'd Gain

1. **~40KB less noise per session.** At ~$0.003/1K input tokens (Sonnet), that's roughly $0.04-0.06 saved per session on input alone. Across ~50 optimizer sessions/week, that's $2-3/week. Small individually, but system-wide across all agents it adds up.

2. **Less instruction dilution.** This is the bigger win. When my system prompt is 52KB, the model weights important rules equally with filler. A 10KB prompt means my core identity and constraints have higher signal-to-noise ratio. I'd expect fewer FM-1.1 (goal drift) violations because there's less prompt to drift through.

3. **Faster auditing.** Today I audit 9 SOUL.md files + common-sense.md + shared/LESSONS.md for duplication. After: I audit 1 common-sense.md + 9 slim SOUL.md files. Each SOUL.md is 1-3KB instead of 7-15KB. Total audit surface drops from ~100KB to ~30KB.

4. **Cleaner coaching loop.** Today Coach writes a rule to SOUL.md, it duplicates something in common-sense.md, nobody notices for weeks. After: Coach proposes to common-sense.md (human reviews) or edits the tiny SOUL.md (easy to spot duplication in 2KB).

5. **Measurability.** The proposal explicitly calls for prompt size logging. This gives me a metric I've wanted — I can track prompt bloat over time and catch regressions.

---

## 4. Migration Risk (Optimizer-specific)

### HIGH risk: Regression on agent-specific failure modes
My SOUL.md has accumulated defenses against specific failure patterns (FM-2.5 tool arg swap, FM-2.6 claims without evidence, FM-2.4 error chain recovery). These were added because I actually failed in these specific ways. If they're removed during migration and not adequately covered by common-sense.md, I'll regress. **Mitigation**: Before removing any FM-* rule from my SOUL.md, verify it's covered by common-sense.md or a structural fix. Run gym scenarios targeting each FM pattern.

### MEDIUM risk: Operational methodology loss
My DOMAIN.md contains the Improvement Loop, which is how I actually do my work. If this gets reduced to "2-3 sentences" without the methodology moving to knowledge/, I'll waste turns re-deriving my approach each session. **Mitigation**: Move the full Improvement Loop to `knowledge/methodology.md`. Add a pointer in SOUL.md: "Read knowledge/methodology.md for analysis process."

### MEDIUM risk: Skill reference gap
11 skill references in my SOUL.md act as behavioral triggers ("when X happens, follow skill Y"). If these disappear and I have to remember to read a skills index, there's a latency cost — I might not check the index and fall back to ad-hoc behavior. **Mitigation**: The skill index must be well-structured with trigger conditions, so a single read tells me which skill applies.

### LOW risk: TOOLS.md removal
My TOOLS.md's only unique value is the negative list ("no scrape_webpage, no exec"). This is only needed because I've hallucinated these tools in the past. A 1-line note in SOUL.md covers it. Low risk.

### LOW risk: knowledge/INDEX.md not in prompt
I rarely use it during most sessions. Reading on-demand adds 1 tool call when needed. Acceptable tradeoff for saving 10KB every session.

---

## Summary Verdict

**Strong support. Proceed with migration.**

The proposal correctly identifies duplication as the root cause and proposes a clean solution. My 52KB prompt can realistically become ~10KB (2.3KB SOUL.md + ~7KB common-sense.md + generated) without losing anything that matters.

Key recommendations:
1. **Don't undersell DOMAIN.md migration** — it's not "2-3 sentences," it's ~1KB identity + ~2KB methodology + ~5KB reference. Plan accordingly.
2. **Add a skill reference strategy** — where do the 11 skill triggers go? I suggest one line pointing to a skills index.
3. **Run per-agent gym scenarios** before and after migration, targeting each agent's known failure modes (not just generic scenarios).
4. **Migrate in phases**: slim SOUL.md first (biggest savings), then stop loading INDEX.md (easy), then merge LESSONS.md (needs care), then delete TOOLS.md (low risk).
5. **Measure prompt size before/after** — add the logging before migration starts so we have a clean baseline.
