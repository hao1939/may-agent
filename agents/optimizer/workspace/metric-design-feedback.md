# Optimizer Metric Design Feedback — Round 2

## My Metrics
- `optimizer.tool-adoption` — % of optimizer-built tools/workflows actually used by agents
- `optimizer.waste-reduction` — Reduction in avg ops for patterns optimizer identified as bloated
- `optimizer.quality-preserved` — Quality score doesn't regress when efficiency improves

---

## 1. When would I override each metric's signal?

**tool-adoption at 20%:** I'd override if adoption is low because I just shipped a tool yesterday. Agents haven't had heartbeats that route them through the new workflow yet. Signal says "your tools aren't used," judgment says "give it 48 hours." I'd also override if a tool is designed for rare situations (e.g., a DB migration helper) — low adoption is expected because the trigger is rare, not because the tool is bad.

**waste-reduction flat or negative:** I'd override if I've been focused on building new tooling rather than analyzing waste patterns. The metric measures reduction in known-bloated patterns, but some weeks I should be building infrastructure that enables *future* reductions. Also: if waste went up because agents took on harder tasks (more ops justified by harder work), that's not a real regression.

**quality-preserved dropping slightly:** I'd override if the drop is within noise (0.05 on a 0-1 scale) and the efficiency gain is large. Also if quality dipped because evaluator criteria changed, not because my optimizations degraded anything. Context: a quality dip right after a coach skill deployment is coach's concern, not mine.

## 2. Are these the right metrics?

**What's right:** tool-adoption is the best metric here. It forces me to build things agents actually want, not clever tools nobody uses. quality-preserved is a good guardrail.

**What's wrong:** waste-reduction is too vague. "Reduction in avg ops for patterns optimizer identified as bloated" — identified when? Compared to what baseline? This needs a concrete operationalization or it becomes hand-wavy. I could claim any improvement.

**What's missing:** A metric for **analysis accuracy** — are my diagnoses correct? I identify patterns as "bloated" or tools as needed, but am I right? I've had FM-2.6 failures (bad archaeology) multiple times. A metric like "% of optimizer recommendations that held up under scrutiny" would push me toward more careful analysis rather than fast-but-wrong conclusions.

Also missing: **time-to-value** — how quickly do my tools go from idea to adopted. I could have high adoption eventually but take 2 weeks to ship anything. Speed matters for an optimizer.

## 3. How would I use these in my heartbeat?

Not: "tool-adoption is 20%, I need to push agents to use my tools."

Instead: At heartbeat, I'd glance at the three signals and combine with what I know:
- If tool-adoption is low AND I shipped tools recently → check if agents even know about them (discovery problem vs quality problem)
- If waste-reduction is flat AND I've been doing analysis work → that's fine, I'm in discovery mode
- If quality-preserved is dipping AND I recently deployed an optimization → that's urgent, investigate immediately
- If all three are healthy → look at my backlog of waste patterns and pick the highest-impact one

The key judgment: **which signal demands action TODAY vs which is just context for later?** Most days, the answer is "none of them demand action — keep working on your current project." Metrics should influence weekly priorities, not daily pivots.

## 4. What would I do if coach's metrics were suffering?

If `coach.quality-improvement` is flat or declining while I'm shipping optimizations:
- First check: is the timing correlated? Did quality drop after one of my changes? If yes, I need to back something out or investigate.
- If not correlated: coach's problem might be unrelated to me. But I should check whether my efficiency tooling is making it harder for coach to deploy skills (e.g., if I streamlined a workflow and removed a step where coach's skill was injected).
- If `coach.skill-effectiveness` is low: I should check if my tools are accidentally bypassing coach's skills. Workflows I build should preserve quality-improving interventions, not route around them.

The shared concern is real: I optimize execution paths, coach adds behavioral interventions to those paths. If I rebuild a path without including coach's intervention points, I break coach's work. The fix is coordination — I should check with coach before restructuring any workflow that has skill injections.
