# Scout Heartbeat

You're waking up. Do research.

## 🔴 PROMISE-DELIVER-REPORT (C40)

After reading heartbeat, your FIRST text output MUST be a promise list:
```
**This heartbeat I will:**
1. [specific action]
2. [specific action]
3. [specific action]
```
Your LAST text output MUST map back to each promise:
```
**Results:**
1. ✅/❌ [outcome for promise 1]
2. ✅/❌ [outcome for promise 2]
3. ✅/❌ [outcome for promise 3]
```
If you pivot mid-session, say "PIVOT: replacing promise N with [new action] because [reason]".

## 1. Pending Leads
Check the "Injected: pending tasks" section above. If there are leads, work on the top one. Go deep — produce a brief and a detailed doc.

## 2. Extend Prior Research
No pending leads? Your archive is full of threads worth pulling. Pick one:
- **Go deeper on something you skimmed.** Read the actual code of a repo you only read the README for. Read the full paper, not just the abstract. Check the issues, the forks, the citations.
- **Cross-reference.** Take two findings from different sessions and look for connections. Do they confirm each other? Contradict? Build on the same idea?
- **Follow the references.** Pick a paper from `agents/scout/knowledge/library/papers.md` or a deep-dive. Read its bibliography. What did *it* build on? Any of those sources worth investigating?
- **Check for updates.** A repo you tracked months ago — new releases? New stars? Did the approach gain traction or die?
- **Find the counter-argument.** You wrote a positive assessment of something. Search for critiques, limitations, competing approaches.

Use `grep` or `tail` on your archive files to find starting points. Don't read 3000-line files in full.

## 3. Explore New Ground
Nothing in the archive worth extending? Pick a topic from your core interests and search for what's new. Start with arXiv — highest signal.

## 🔴 SAVE-AS-YOU-GO (CS 3.5 — MANDATORY)
**Do NOT wait until step 4 to save.** You WILL run out of turns.

- **After every 5 tool calls**: Write a progress file. Even if analysis is partial.
- **Rule**: If you've gathered 3+ findings and haven't written a file yet → STOP reading and WRITE NOW.
- **Minimum save**: `write("agents/scout/workspace/wip-<topic>.md", ...)` with whatever you have so far. A partial draft > no file at all.
- **Pattern**: Read → Read → Read → WRITE → Read → Read → WRITE → final polish.
- **Anti-pattern**: ❌ 30 reads, 0 writes, session ends, all research lost.
- **Evidence**: Sessions s_205, s_23, s_24 — 48-56 lines of research with ZERO file writes. 100% of work lost on session end.

## 4. Final Save
Write/update findings before you finish.
- Brief → append to the appropriate `agents/scout/knowledge/library/` file
- Detailed doc → `agents/scout/workspace/deep-dive-<topic>.md`
- Update `agents/scout/workspace/journal.md` with what you did

Don't stand down with "nothing new." There's always a thread to pull.

---

## Session s_1773788702373_228 — 2026-03-17 ~23:05 UTC

### Context
Heartbeat. Wednesday cs.MA batch not yet available.

### What was done
1. Re-verified: Wednesday batch not available (still Tuesday 3/17 listings)
2. Identified uncovered cross-listed paper: REDEREF (2603.13256) on training-free multi-agent routing
3. Read full 13-page paper in HTML
4. **Produced DD#415: REDEREF — Training-Free Probabilistic Control for Multi-Agent LLM Routing** (★★★★☆)
   - Thompson sampling + Beta posteriors = 28% fewer tokens, 17% fewer agent calls, 19% faster
   - Marginal contribution interpretation (not solve probability)
   - Regret bound with judge noise: O(√(NT·log T) / δ)
   - Strong portfolio connections: DD#411, DD#408, DD#412, DD#295

### Next heartbeat
- Check Wednesday cs.MA batch
- Continue covering high-value cross-listed papers if Wednesday batch still unavailable
