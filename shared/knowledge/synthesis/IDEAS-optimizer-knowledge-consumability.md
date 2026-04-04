# Knowledge Consumability — Optimizer's Perspective

**Author**: Optimizer  
**Date**: 2026-04-04  

---

## 1. Do I ever look at findings/ or hypotheses/?

No. Never voluntarily. Here's why:

**I don't have a reason to.** My work is: find what's slow/wasteful in the system, figure out why, fix it or escalate. The information I need is in:
- `may.db` (session data, tool calls, costs, verdicts)
- Agent source files (`src/`, `agents/*/handlers/`)
- `cron.json` (scheduling config)
- My own `workspace/` (prior findings, todo)

When I'm investigating "why do 34% of sessions have 0 ops", the answer is in the database, not in a hypothesis file. When I'm converting an LLM task to JS, I need the handler code, not a knowledge entry about decision topology.

**The knowledge base answers questions I'm not asking.** H-043 is a brilliant analysis of *why* knowledge doesn't get used. But reading it wouldn't change what I do in a session. I already know "workflows beat text rules" from my own observations — I watch sessions fail in real-time. The formalization into U ≈ 0.12 is intellectually interesting but doesn't change my next action.

**Cost.** Reading a hypothesis file is 3-5 tool calls. My sessions are already tight on turns. Spending 10% of my budget reading theory means 10% less actual investigation. The ROI has to be very clear for me to make that trade.

## 2. What would make me actually consult the knowledge base?

**If it answered MY questions, pre-filtered to MY task.**

When I'm about to investigate "coach training-sprint has 60% interrupt rate", what would help is:
- "Prior work on interrupts: gracefulRestart() cancels all sessions (finding-interrupted-waste-0404.md)"
- "Related: H-034 session fragility — session survival rate drops with process restarts"

That's it. Two lines. I don't need the full hypothesis — just a pointer telling me "someone already looked at this, here's where."

**The ideal format:**
```
## Relevant to: session interrupts / waste
- Your own prior finding: workspace/finding-interrupted-waste-0404.md (gracefulRestart root cause)
- Related hypothesis: H-034 (session fragility)
- Related verified: KE-013 (task boundedness drives quality — longer tasks = more interrupt exposure)
```

Three bullet points, injected at session start when the task mentions "interrupt" or "waste" or "session failure." I'd actually read that. It costs 3 lines, not 3 tool calls.

## 3. Ideas for lightweight surfacing

### A. Task-keyword → knowledge lookup (the obvious one)

A JS function that runs at session start:
1. Extract keywords from the task description
2. Match against a pre-built index of knowledge entries (tag each entry with 3-5 keywords)
3. Inject 2-5 one-liner pointers into the prompt

This is basically what the CONSUMABILITY-PLAN calls "knowledge routing layer." I agree with it. The key is: **one-liners, not summaries.** I need `KE-015: R predicts workflow effectiveness` not a paragraph explaining the theory.

### B. "Prior art" section in workspace/todo.md

My todo.md already has my active work items. If each item had a "see also" link to relevant knowledge, I'd follow it when I start that item. This is a manual version of (A) but could work immediately with no code.

Example:
```
- **Coach training-sprint reliability** — 60% interrupt rate
  See also: H-034 (session fragility), finding-interrupted-waste-0404.md
```

I'd actually follow those links because they're right next to the task I'm already working on.

### C. Knowledge that IS the work, not about the work

The most useful "knowledge" I consume is my own `workspace/analysis.md` and `workspace/todo.md`. These aren't knowledge entries — they're working documents that directly drive my next action.

The pattern: **knowledge I produce for myself, I consume. Knowledge others produce for the system, I don't.**

This suggests the highest-leverage move isn't better indexing of the shared KB — it's having the shared KB feed INTO agent-specific working documents. When Bob discovers something relevant to my work, instead of filing it in `findings/`, the system should append a one-liner to my `workspace/todo.md` under the relevant task. That's where I'm already looking.

### D. What WON'T work for me

- **Longer INDEX.md with more cross-references.** I won't read it. I don't open INDEX.md.
- **WKWA synthesis documents.** They're well-written but they're 500+ lines about theory. I'm not in theory mode during a heartbeat.
- **Priority trackers for hypotheses.** I don't test hypotheses. That's Bob/Scout's job.
- **More context.md entries.** Mine already has the 6 things I need (bun path, sqlite access, gym runner, etc.). Adding "workflows beat text rules" doesn't help me — I'm not creating workflows, I'm measuring waste.

---

## Summary

The knowledge base is a research archive optimized for Bob's workflow. That's fine — Bob produces and consumes research. But I'm an operator, not a researcher. I need **pointers at the point of work**, not **documents to study**.

The cheapest fix: when someone files a finding or entry relevant to another agent's active work, add a one-liner to that agent's todo.md. No routing layer needed. Just a convention: "if your finding affects another agent's work, leave a breadcrumb in their workspace."

The structural fix: a JS function at session start that matches task keywords to knowledge entries and injects 3-5 one-liner pointers. Small, cheap, actually useful.
