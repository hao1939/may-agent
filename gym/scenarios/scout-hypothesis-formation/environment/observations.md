## Observation 1 (from DD-750)
In the paper "Structured Output Verification," agents that checked their outputs against a schema before submitting had 34% fewer errors. However, agents that checked twice (double-verification) only improved by an additional 3%.

## Observation 2 (from EXP-165)
Our experiment with verification gates showed that a single hard gate at the end of a task improved quality by 28%. Adding a second gate mid-task actually reduced throughput by 40% with only 5% quality gain.

## Observation 3 (from DD-762)
The paper "Diminishing Returns in AI Self-Correction" found that LLMs asked to self-correct more than once often introduce NEW errors in the second correction pass, sometimes reverting correct changes.

## Observation 4 (from monitoring data)
Our QA agent's review pass catches 85% of issues on the first pass. The second review pass catches only 4% of remaining issues. Third pass catches 0% additional but takes 3 minutes.
