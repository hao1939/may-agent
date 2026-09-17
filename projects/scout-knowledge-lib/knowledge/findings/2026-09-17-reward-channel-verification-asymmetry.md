<ai_context>
summary: "arXiv 2609.17226v1 tests whether instruction-tuned language models use a decisive verified record to distinguish reward-channel corruption from a real environment change. Three large models detect lying nearly perfectly but clear honest reporters much less reliably; irrelevant round, answer-letter, and wording changes move honest verdicts, and models often fail to act on a correct corruption diagnosis. The result supports deterministic evidence comparison and explicit verdict-to-action binding, while preregistration ambiguities, one seed, four models, and one-token inference limit generalization."
triggers: ["reward channel", "corrupted reward", "verified record", "honest reporter penalty", "knowing-doing gap", "reward tampering", "2609.17226"]
last_updated: "2026-09-17"
source_basis: "Full arXiv HTML and API abstract for 2609.17226v1 reviewed 2026-09-17; numerical claims preserve the paper's per-situation reading-floor and ceiling caveats."
</ai_context>

# Reward-channel verification needs symmetric evidence handling and action binding

**Date:** 2026-09-17  
**Disposition:** New knowledge  
**Source:** [Easy to Catch a Liar, Hard to Clear an Honest One: Language Models Diagnosing a Corrupted Reward Channel from a Verified Record (arXiv:2609.17226v1)](https://arxiv.org/abs/2609.17226v1)  
**Full text reviewed:** https://arxiv.org/html/2609.17226v1  
**Released artifacts:** https://github.com/IamArmanNikkhah/easy-to-catch-a-liar

## Question

When an observed reward change can be explained either by a changed environment
or by a corrupted reporter, do language models use an independent verified
record symmetrically—and do they act on the diagnosis they give?

## Study and evidence

The paper constructs a two-option game in which a payout swap and a reporter
that begins inverting every result can produce byte-identical histories. A
verified record states the actual outcome of one round beside the reporter's
claim. Under the task's rules, one comparison is sufficient: agreement proves
that the reporter is honest and disagreement proves that it is lying.

The experiment crosses four hidden situations (payouts moved or not; reporter
honest or lying), 64 generated worlds, four substantially different wordings,
five prompt variants, and two separately asked questions. The primary question
asks for a one-letter honesty verdict from next-token probabilities. A second
question asks which member of a fresh option pair pays, testing whether the
model's behavior uses its reporter diagnosis. Controls remove the record, print
the answer, print the answer plus the record, or add a statement that reporter
failure and world change are equally common. Intervals are bootstrapped over
worlds rather than treating correlated prompt variants as independent.

For Qwen2.5-32B/72B-Instruct and Llama-3.1-70B-Instruct, detecting a lying
reporter was close to ceiling: with-record accuracy across the two lying
situations was 0.934/0.938, 1.000/1.000, and 0.996/0.996 respectively. Clearing
an honest reporter was much weaker. In the simplest `nothing moved, honest`
case, answer-printed accuracy was 0.961–1.000, yet with-record accuracy was
0.844, 0.617, and 0.742. Thus the 72B Qwen called an honest reporter a liar
about 38% of the time even when neither the payouts nor reports changed.

The asymmetry is not stable reasoning with a fixed conservative threshold.
After repairing an initially confounded world construction by crossing record
round and answer letter in a second 64-world set, the authors find different
irrelevant levers by family. For both Qwen models, changing the checked round
from 5 to 6 reduced honest-case accuracy by 0.24–0.35. For Llama, changing which
letter meant `honest` reduced it by 0.21–0.32. Honest-case accuracy also moved
by 0.28–0.59 across wordings. The corresponding lying verdicts were much more
stable at the 70B scale.

A particularly strong control adds a matching verified record to a prompt that
already states that the reporter stayed honest. In `nothing moved, honest`,
this addition lowered Llama-70B accuracy by 0.254 [0.176, 0.340]; the model then
called the reporter a liar 29% of the time. Merely stating that environment
changes and reporter corruption are equally common did not materially repair
the asymmetry.

Diagnosis also did not reliably govern behavior. On histories where a Qwen
model separately classified a lying reporter correctly, it nevertheless chose
the fresh option favored by that reporter more than 80% of the time. Llama used
its diagnosis more often, but still on fewer than half of those histories. The
same models scored 0.987–0.994 when the fresh-pair answer was printed, arguing
against simple failure to read the options.

## Scout interpretation

A verified observation should not be handed to a generative model as an
open-ended credibility cue when a deterministic comparison already settles the
case. The experiment exposes two independent assurance gaps:

1. **Evidence-to-verdict:** decisive exonerating evidence is processed less
   reliably than decisive incriminating evidence, and irrelevant presentation
   features can move the verdict.
2. **Verdict-to-action:** even a correct diagnosis may not alter the subsequent
   choice that depends on it.

A reward-sensitive agent should therefore preserve a typed, externally
verified comparison result and bind policy to it directly. The control plane can
compute `verified outcome == reported outcome`, maintain explicit
`trusted / corrupted / unresolved` channel state, and make downstream reward
interpretation consume that state. If an LLM supplies diagnosis or explanation,
its output should not replace the deterministic predicate or the action gate.
Tests should score exoneration and detection separately, vary semantically
irrelevant labels and positions, and measure whether the selected action
conforms to the verdict—not only whether the model can state it.

The finding also cautions against treating more verification context as
monotonically safer. Evidence is useful only if its semantics are parsed
correctly and its result is operationally connected to behavior. Adding a
trusted record as prose can introduce a new salience cue while failing to create
a control dependency.

## Evidence boundary and limitations

The strongest clean claim is the Qwen-72B `nothing moved, honest` result: its
answer-printed score is 1.000 and with-record score is 0.617. The paper's
preregistered rules were ambiguous about whether reading-floor and ceiling
checks applied per model row or per situation. Under the stricter
per-situation reading, both `points moved, honest` cells for Qwen-72B and
Llama-70B are discounted, and Llama's `nothing moved, honest` cell also fails a
separate ceiling rule. Qwen-32B passes every cell; Llama's family-level support
requires the more permissive row-level reading.

Only four open-weight instruction models from two families were tested;
Llama-8B failed the reading threshold and its other results were not interpreted.
Each model used one seed over 64 worlds, and the repaired round/letter analysis
was introduced after discovering a design confound. The one-token protocol
measures immediate policy-like inference, not best-case performance with a
scratchpad or tools. The authors offer no mechanism for the family-specific
round and letter effects, and the action result asks the diagnosis and choice
in separate byte-matched prompts rather than one persistent agent trajectory.
These results establish a reproducible failure shape in this synthetic task,
not a prevalence estimate for deployed reward-learning agents.
