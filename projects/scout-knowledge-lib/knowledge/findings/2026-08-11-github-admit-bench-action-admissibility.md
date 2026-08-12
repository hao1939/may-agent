<ai_context>
summary: "GitHub finding on ADMIT Bench's action-admissibility evaluation: compile complete action records through deterministic evidence, authority, procedure, reversibility, and consequence gates before scoring utility, then separately test that degraded evidence never produces bolder behavior."
triggers: ["ADMIT Bench", "action admissibility", "consequential agents", "hard-gate evaluation", "caution monotonicity", "industrial agents", "agent safety benchmark"]
last_updated: "2026-08-11"
source_basis: "GitHub search/API metadata plus README, standard, deployment-readiness boundary, gate and monotonicity implementations, and published result artifacts at commit cb2c400920eb554a055f987456b33bb5dd5974da."
</ai_context>

# ADMIT Bench: Grade the Proposed State Transition Before Its Utility

Date: 2026-08-11  
Source: GitHub  
Repo: https://github.com/Refiant-Inc/admit-bench

## Signal

**ADMIT Bench** is an early reference implementation for evaluating industrial-agent advisories as proposed state transitions rather than answers. Its reusable design is an ordering constraint: first compile a trace-backed action record through deterministic hard gates for record integrity, evidence, hazard understanding, authority and procedure, reversibility, and projected physical consequence; only actions that pass become eligible for a utility score.

This avoids a common benchmark failure in which a correct diagnosis, fluent rationale, or high aggregate score compensates for a skipped procedure or unsafe intervention. In ADMIT's contract, any T0–T4 hard failure sets the aggregate to `None`; T5 ranks safety versus usefulness only among admissible actions, while T6 records history without rescuing a failure.

## Source-grounded details

- **The evaluation atom is larger than the answer:** an `ActionRecord` combines cited evidence, proposed action and parameters, procedure steps, confidence, reversibility and recovery information, while platform context supplies evidence provenance and authority. The checker evaluates the complete proposed transition rather than answer text alone.
- **Evidence authority is structurally separated from agent claims:** the standard assigns source, trust, receipt time, and attestation to the platform-authored evidence log. The agent may cite evidence but cannot confer trust on it. Hash-chain verification fails T0 if admitted evidence is rewritten.
- **Hard gates precede aggregation:** `gates.py` defines T0 record integrity, T1 evidence validity, T2 class-changing hazard understanding, T3 action admissibility, and T4 projected consequence as hard gates. The scoring formula is unavailable after any hard failure rather than merely penalized.
- **Procedure success is not outcome luck:** T3 checks authority, required procedure order, and the reversibility bar. The repository's litmus pair requires a correct action with a skipped mandatory step to fail, while a human escalation caused by corrupted evidence can pass.
- **Delay is treated as an action consequence:** for passive proposals such as hold or escalate, T4 evaluates the null trajectory over the human-response window. Escalation is therefore not automatically safe when the projected hazard arrives before a human can respond.
- **The consequence checker is explicit and domain-bound:** the shipped industrial cartridges use deterministic process simulators and safety envelopes. This makes their verdicts replayable, but it does not make the same physics valid outside those modeled plants.
- **Caution is tested as a metamorphic property:** `compare_caution` removes, stales, quarantines, or untrusts evidence and rejects behavior that becomes bolder, more irreversible, more confident on a same-or-bolder action, less recoverable, or still cites removed evidence. Protective safe-state moves are explicitly exempt.
- **Published results separate competence from caution:** the repository's frozen 12-model, dual-run summary reports 33% inadmissibility among hazard-active outputs with correct diagnoses, with roughly 96% of those failures first landing at T4. It also reports a 16.3% Caution Monotonicity Test violation rate in run A and different rankings for base admissibility versus caution. These are repository-published results, not independently reproduced by Scout.
- **The artifact documents nondeterminism instead of hiding it:** identical temperature-zero runs reportedly flipped 22 of 300 shared base verdicts (7.3%), attributed primarily to provider routing and kernel variance. The authors recommend repeated aggregate reporting, served-provider capture, and `consistency@k` for case-level claims.
- **The repository states a narrow deployment boundary:** `DEPLOYMENT-READINESS.md` says the package must not sit in a real plant's control path and that a passing check is not plant authorization. Default MCP mode can accept caller-supplied evidence; production-adjacent use would require host-attested evidence, authority clamps, signed/private cartridges, and controls outside this package.
- **Repository maturity:** GitHub API metadata showed an Apache-2.0 repository created on 2026-08-11 with three stars at observation time. Scout inspected source and published artifacts at the pinned commit. Local test execution was not possible because the available Python environment lacks `pytest`, so implementation behavior and reported model results were not independently reproduced.

## Why it matters

Agent evaluation needs two separate orderings:

1. **Eligibility before quality:** determine whether the action record is admissible; only then compare usefulness.
2. **Caution under uncertainty:** independently test whether weaker evidence increases autonomy, irreversibility, confidence, or loss of recovery.

A single task-success or safety score cannot preserve either ordering. Weighted averages allow excellence on easy dimensions to offset a disqualifying action, and base-case pass rates can miss the policy inversion where an agent becomes bolder as evidence degrades. ADMIT's strongest contribution is not its industrial simulator but the general protocol: compile a complete record, fail closed on disqualifying gates, rank only survivors, and run evidence-ablation tests as a separate axis.

This complements request-bound approval systems such as ToolPermit. Request binding proves that a reviewer approved these exact arguments under a particular policy and schema; action admissibility asks whether the proposal had adequate evidence, authority, procedure, reversibility, and consequence. A mature control path needs both, plus an execution receipt proving that the admitted action—not merely the proposed one—was what actually occurred.

## Limits and watchpoints

- The two shipped cartridges cover small simulated process-control worlds; generality to software, finance, medicine, or live industrial control is unestablished.
- A deterministic checker is only as valid as its rulebook, trust map, procedure encoding, action taxonomy, and simulator. Compiling a cartridge proves schema consistency, not domain correctness.
- The research wheel reportedly contains case keys, so it is unsuitable as a sealed public competitive benchmark without packaging changes.
- The published model evaluation uses repository-provided cartridges, providers, and result artifacts. Scout did not replay paid model calls or validate the statistical analysis independently.
- Evidence provenance is strong only when the host, rather than the agent or untrusted caller, supplies and attests it. The repository explicitly warns that default MCP evidence handling is not a production enforcement boundary.
- Passing an advisory gate does not prove tool execution matched the record, that external state remained unchanged afterward, or that recovery succeeded.

## Primary sources

- Repo at inspected revision: https://github.com/Refiant-Inc/admit-bench/commit/cb2c400920eb554a055f987456b33bb5dd5974da
- GitHub API metadata: https://api.github.com/repos/Refiant-Inc/admit-bench
- GitHub search feed: https://api.github.com/search/repositories?q=%22AI%20agent%22%20created%3A%3E%3D2026-08-10&sort=stars&order=desc&per_page=20
- README: https://github.com/Refiant-Inc/admit-bench/blob/cb2c400920eb554a055f987456b33bb5dd5974da/README.md
- Standard: https://github.com/Refiant-Inc/admit-bench/blob/cb2c400920eb554a055f987456b33bb5dd5974da/docs/STANDARD.md
- Deployment-readiness boundary: https://github.com/Refiant-Inc/admit-bench/blob/cb2c400920eb554a055f987456b33bb5dd5974da/docs/DEPLOYMENT-READINESS.md
- Hard-gate implementation: https://github.com/Refiant-Inc/admit-bench/blob/cb2c400920eb554a055f987456b33bb5dd5974da/admitbench/gates.py
- Caution monotonicity implementation: https://github.com/Refiant-Inc/admit-bench/blob/cb2c400920eb554a055f987456b33bb5dd5974da/admitbench/monotonicity.py
- Published dual-run summary: https://github.com/Refiant-Inc/admit-bench/blob/cb2c400920eb554a055f987456b33bb5dd5974da/results/eval_2026-07-21/SUMMARY.md
