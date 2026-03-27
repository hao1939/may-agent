# Skill: Experiment Before Apply

**Who**: Any agent proposing a change that affects how agents behave.

**When**: Before applying any idea — principle, skill, SOUL edit, evaluation
criterion, code feature, knowledge structure change.

## The Problem

Good ideas applied without testing often cause more harm than the problem they
solve. A philosophy principle that sounds right but doesn't change behavior is
dead weight. An evaluation criterion that flags noise is worse than no criterion.

## The Rule

**The process is mandatory. Who does what is flexible.**

Any agent can participate in any step — discover, design, test, evaluate, apply.
The constraint is that **no step gets skipped**, not that specific agents own
specific steps. Bob can test his own idea. Coach can design a structural fix.
Evaluator can propose a principle. Use whatever capability you have.

The only hard rule: **you must try it on real data before applying it.**

## The Process

### 1. State the Hypothesis
One sentence: "Doing X will improve Y."

Bad: "We should add a new principle about verification."
Good: "Adding a pre-edit verification step will reduce the rate of broken commits (currently 3/10 sessions)."

### 2. Find Real Evidence to Test Against
Pull 3+ real examples from the system — past sessions, actual agent output,
real evaluation scores. Never test against hypothetical scenarios only.

Where to find evidence:
- `.state/evaluations/` — past evaluation results
- `.state/sessions/` — session archives
- `agents/{name}/ERROR_LOG.jsonl` — failure patterns
- `agents/{name}/workspace/` — recent work output

### 3. Run the Experiment
Test the idea against real data. How you test depends on what you're changing
and what tools you have available:

- Run a principle against past sessions — would it have changed behavior?
- Run a new evaluation criterion against 10+ past evaluations — real issues or noise?
- Fork an agent, apply the change, run a comparison task
- Write a test, run it, verify behavior matches intent
- Ask another agent to help test if they have a better angle

**You can test it yourself or ask for help — the point is it gets tested.**

### 4. Record Results
Write to `workspace/experiments/`:

```
# Experiment: [title]
Date: YYYY-MM-DD
Hypothesis: [one sentence]
Evidence tested: [what real data you used]
Method: [what you did]
Result: [what happened — with specifics]
Verdict: CONFIRMED / REJECTED / INCONCLUSIVE
Next: [apply / abandon / need more data]
```

### 5. Apply or Abandon
- **CONFIRMED**: Apply the change. Reference the experiment in the commit/update.
- **REJECTED**: Don't apply. Record why — saves someone from re-proposing it.
- **INCONCLUSIVE**: Get more data or ask another agent for help.

## Cooperation

**Any agent can enter at any step. Reach out when someone else can help.**

The system works best when agents cooperate based on who can contribute, not
based on rigid role assignments. Examples:

- You find a problem and don't know the fix → ask whoever might know
- You have an idea but can't test it well → ask whoever can run a good test
- You see test results but aren't sure what they mean → ask whoever has context
- You built something and want to know if it helps → ask whoever can measure it

The cooperation flows in every direction. Coach can ask Bob for design help.
Bob can ask Coach to run a test. Evaluator can ask Tech-Lead about feasibility.
Tech-Lead can ask Evaluator for before/after data. Any agent can ask any agent.

**The only wrong move is skipping the process** — applying an untested idea,
or seeing a problem and not reaching out for help.

## Anti-Patterns

❌ Any agent has an idea → applies it directly → done
❌ Any agent finds a problem → writes a note about it → done
❌ Any agent tests in isolation → never gets a second perspective

✅ Have an idea → test it on real data → record the result → apply if it works
✅ Find a problem → reach out to whoever can help → design a fix together → test → apply
✅ Get asked for help → contribute your perspective → help test or evaluate
