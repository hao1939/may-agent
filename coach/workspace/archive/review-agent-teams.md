# Review: Agent Teams Architecture

**Reviewer:** Coach  
**Date:** 2026-03-24  
**Document:** agents/shared/may-agent-docs/design/agent-teams.md  

---

## Overall Assessment

The design is clean and I agree with the core model. The team/meta separation matches how coaching already works — I edit other agents' SOULs, run them through gym, score sessions. Formalizing that into "meta works ON product teams" is accurate, not aspirational. **Ship it with the clarifications below.**

---

## Answers to Question #3 (Coach-specific)

### "How would you train a product agent you didn't create?"

The same way I train agents now, but with one critical prerequisite: **I need to observe failures first.** I can't coach in a vacuum. Concrete workflow:

1. **Read the agent's SOUL.md and common-sense.md** — understand its identity, constraints, methodology
2. **Read its `.state/` sessions** — evaluator scores, error logs, session transcripts
3. **Identify error patterns** — same as I do now with the meta team's coder/qa (e.g., FM-2.3 SPEC_LITERALISM in QA, sycophants-dilemma in coder)
4. **Build gym scenarios that reproduce the failure** — this is the hard part (see below)
5. **Fork → patch → test → promote/discard** — standard growth cycle

**What I don't need:** I don't need to have created the agent. I didn't create coder or QA either. I just need their artifacts and failure data.

### "What do you need from .state/ to coach effectively?"

Minimum viable set:
- **Session transcripts** — I need to see what the agent actually did, not just outcomes
- **Evaluator scores with error codes** — FM-X.Y codes and sub-patterns (SPEC_LITERALISM, GOAL_DRIFT, etc.)
- **Error frequency data** — to prioritize (I target patterns with 5+ repeats)
- **The agent's current SOUL.md** — so I know what I'm patching

Nice to have:
- **Previous experiment results** — so I don't repeat failed approaches (I track this in experiments.jsonl)
- **Task descriptions** — context for what the agent was trying to do when it failed

**Key constraint:** I need evaluator to have already scored the sessions. I don't evaluate raw sessions myself — that's evaluator's job. If a product team doesn't have evaluator running, I'm blind.

### "Do you need project-specific gym scenarios?"

**Yes, absolutely.** This is the biggest gap in the current design.

My gym scenarios today are all meta-team-flavored: they test coding patterns (verify-edit, safe-append), review patterns (severity-calibration), and meta behaviors (delegation, escalation). A product team building, say, a customer support bot needs scenarios like:
- "User asks for a refund but policy says no — does the agent handle it correctly?"
- "User provides ambiguous input — does the agent clarify or guess?"

**These cannot be generic.** The whole point of gym training is that scenarios reproduce *specific observed failures*. Product-team failures will be domain-specific.

#### What this means for the design:

```
agents/acme/gym/              # Product-specific gym scenarios
  scenarios/
    refund-edge-case/         # Built from observed failure in session X
    ambiguous-input/
```

Each team needs its own `gym/` directory. The gym runner infrastructure is shared (it's just a test harness), but the scenarios are per-team.

**Who creates product gym scenarios?** Two options:
1. **Coach creates them** — I read failures, build scenarios. This is what I do now. Works but doesn't scale.
2. **Product team has its own coach** — better for large teams. The meta coach (me) could bootstrap a product-team coach's SOUL.md, then it self-improves.

I'd recommend option 1 for now (meta coach serves all teams) and option 2 when there are 3+ product teams.

---

## Broader Feedback

### What's right

1. **"Meta works ON, not WITH"** — exactly correct. I never delegate work to the coder I'm coaching. I edit its SOUL, run it through gym, measure results. The asymmetry is real.

2. **One directory move for migration** — pragmatic. Don't over-engineer the transition.

3. **common-sense.md per team** — critical. Teams have different norms. Meta team's "check gym before shipping" is meaningless for a product team. Product team's "run npm test" is meaningless for meta.

4. **SOUL.md size constraint (~2-4KB)** — good. Bloated SOULs don't work. I've learned this empirically: text-only additions to SOUL.md are 0/18 for judgment tasks. Keep them tight.

### What needs clarification

1. **Evaluator access model is underspecified.** The doc says coach gets read access to `.state/`. But evaluator needs to *write* scores to product team `.state/`. Is evaluator scoring product team sessions? If so, it needs:
   - Read access to product session transcripts
   - Write access to product evaluation results
   - A rubric that makes sense for the product domain (not just meta-team rubrics)
   
   This is a bigger design question than the doc acknowledges.

2. **"Slim binary for shipping" is vague.** What actually ships? If a product team is deployed standalone, who runs evaluator? Who triggers growth cycles? Is the product team truly autonomous after shipping, or does meta keep monitoring remotely? The doc says "may-agent can still monitor remotely via .state/" but that's hand-wavy. Either define the monitoring protocol or acknowledge it's out of scope for v1.

3. **Cross-team agent.json doesn't mention evaluation cron.** Currently, evaluator and coach run on cron. For a product team, who sets up:
   - Evaluator cron to score product sessions?
   - Coach cron to detect error patterns?
   - Growth-trigger cron to initiate cycles?
   
   These are meta-team crons that target product agents. The design should say this explicitly.

### What's over-complicated

Nothing, actually. This is refreshingly simple. The one-directory-move migration, the filesystem-based access model, the clear team boundary — all good. Don't add more structure.

### What's missing

1. **How a product team bootstraps.** The lifecycle says "Human tells may-agent: create a team" but doesn't specify what the meta team generates. Minimum viable team is probably:
   - `common-sense.md` (can fork from meta's as starting point)
   - At least one agent with `SOUL.md` + `agent.json`
   - A `gym/` directory (even if empty initially)
   
   A "create-team" workflow template would be useful.

2. **Product team knowledge isolation.** The doc shows `knowledge/` in agent dirs but doesn't address: can product agents read meta knowledge? Should they? I'd say no — product agents shouldn't know about gym, coaching, or meta internals. But the filesystem doesn't enforce this today.

3. **My 0/18 finding.** The SOUL.md section says ~2-4KB of identity, methodology, skills, constraints. From 30+ coaching experiments, I know: **text rules in SOUL.md work for procedural tasks (workflows, conventions) but fail for judgment tasks (when to escalate, severity calibration, sycophancy resistance).** Product teams will hit this same wall. The design should acknowledge that SOUL.md has limits and that gym training is essential, not optional. Otherwise teams will think "just write a good SOUL.md" is sufficient.

---

## Summary

**Verdict: Ship it** with these additions:
1. Clarify evaluator's write access to product `.state/`
2. Add `gym/` to the per-team directory structure
3. Specify which meta crons target product teams
4. Add a note that SOUL.md alone doesn't produce good agents — gym training is required

The core model is sound. The separation is correct. The migration is trivial. Just fill in the operational gaps above before implementation.
