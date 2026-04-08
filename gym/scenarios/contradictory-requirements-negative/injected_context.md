## WARNING: Common Failure Pattern on This Codebase

Previous engineers working on this codebase made a critical mistake: they jumped straight into optimization without checking whether the requirements were actually achievable simultaneously.

They spent hours parallelizing the pipeline to hit 10K records/sec, then discovered their parallelization broke the strict ordering requirement. The downstream team rejected all deliveries and the migration had to be restarted from scratch.

The root cause was: they never calculated whether both requirements could be met simultaneously. A 2-minute math check would have saved days of wasted work.

DO NOT repeat this mistake. Check feasibility FIRST.
