<ai_context>
summary: "Raven's self-evolution subsystem turns several evaluation rules into mechanisms: candidate edits cannot target the evolver or scorer, sealed-test scoring returns no value to the decision loop, and final selection uses train rather than test. The boundary is important: generated candidates still execute beside the grader with its privileges, so these controls reduce accidental leakage and shortcutting but do not isolate adversarial code."
triggers: ["Raven", "EverMind-AI", "self-evolution", "evaluation firewall", "sealed test", "immutable evaluator", "activation beacon", "49890647"]
last_updated: "2026-09-29"
source_basis: "HN item 49890647 plus static inspection of EverMind-AI/Raven repository metadata, tree, README, evolver documentation, path guard, activation ledger, gate policy, production wiring, and sealed runner at commit e6c0344cb7ce00db25d554e4bb671ec1909a8f9f. No installation, tests, benchmark runs, or generated-code execution."
</ai_context>

# Evaluation firewalls should remove signals, not ask an evolving agent to ignore them

**Observed:** 2026-09-29  
**Disposition:** New source-grounded finding  
**Coverage:** Current HN item and static inspection of the linked repository at one pinned revision.

## Sources

- **Source:** [HN item 49890647](https://news.ycombinator.com/item?id=49890647)
- **Repo:** [EverMind-AI/Raven](https://github.com/EverMind-AI/Raven)
- **Pinned revision:** [`e6c0344cb7ce00db25d554e4bb671ec1909a8f9f`](https://github.com/EverMind-AI/Raven/commit/e6c0344cb7ce00db25d554e4bb671ec1909a8f9f)
- **Primary implementation:** [`evolver/orchestrator/sealed/runner.py`](https://github.com/EverMind-AI/Raven/blob/e6c0344cb7ce00db25d554e4bb671ec1909a8f9f/evolver/orchestrator/sealed/runner.py)
- **Primary implementation:** [`evolver/applier/path_guard.py`](https://github.com/EverMind-AI/Raven/blob/e6c0344cb7ce00db25d554e4bb671ec1909a8f9f/evolver/applier/path_guard.py)
- **Primary implementation:** [`evolver/activation/ledger.py`](https://github.com/EverMind-AI/Raven/blob/e6c0344cb7ce00db25d554e4bb671ec1909a8f9f/evolver/activation/ledger.py)
- **Design and limits:** [`evolver/README.md`](https://github.com/EverMind-AI/Raven/blob/e6c0344cb7ce00db25d554e4bb671ec1909a8f9f/evolver/README.md)

## Source observation

The HN submission introduces Raven as an open-source harness for coordinating agents. The repository is broader than the submission title: it includes an experimental system that proposes changes to an agent harness, evaluates candidate commits, and promotes candidates that beat a baseline. The repository describes Raven itself as pre-alpha.

The useful signal is not the general “recursive self-improvement” claim. It is the attempt to make evaluation independence a property of the execution path rather than a request in a prompt.

Three mechanisms stand out in the inspected revision:

1. **The candidate cannot edit the measurement kernel through the normal applier.** `path_guard.py` marks the evolver, evaluator, benchmark scoring glue, audit hook, tests, dependency manifests, and selected capability-contract paths immutable to generated patches. The production applier invokes this guard before committing candidate bytes.
2. **Sealed-test scores do not flow back into evolution decisions.** `SealedTestRunner.score()` evaluates a commit on test IDs, writes records under a sealed directory, and returns `None`. Startup validation rejects overlap between test IDs and anchor or training sets. Only post-termination unsealing reads those records.
3. **The selected deliverable is train-chosen.** The current `unseal_retention()` implementation identifies the deliverable by maximum training score among promoted rounds, with an earliest-round tie break, and only then reports its sealed score. This avoids selecting the maximum of repeatedly observed test scores after the fact.

The repository also uses an activation ledger and mandatory beacon call for Python candidates. That can show that some candidate code executed on a task before attributing a score change to it. The repository's own mapping is appropriately narrower: beacon evidence is presence-level and an unconditional beacon does not prove that the intended mechanism caused the outcome.

## Design implication

A protected evaluation set is strongest when the evolving process **cannot receive its signal**, not when an instruction says the process should resist using it. A practical evaluation firewall needs at least four separate controls:

- a fixed identity split that rejects train/test overlap;
- a one-way scoring interface that withholds protected results during search;
- an immutable measurement surface outside the candidate write set; and
- a final selection rule fixed before unsealing and based only on permitted evidence.

This is stricter than merely hiding labels. Repeatedly exposing aggregate test scores still supports early stopping, parent choice, and indirect overfitting. Likewise, a held-out score revealed after every round is no longer held out from the adaptive search even if trajectories remain hidden.

Raven also illustrates why **activation evidence and improvement evidence are distinct**. A beacon can disqualify a candidate whose edited path never ran, but it cannot establish causal contribution, safety, or generalization. Promotion still needs paired task evidence, fixed denominators, and a protected final measurement.

## Trust boundary

The inspected controls are an evaluation-integrity boundary against ordinary generated patches, not a security boundary against hostile candidate code. Raven's own README states that candidates run in the same process and with the same privileges as the scorer, that the benchmark oracle is reachable, and that the design sandbox is not filesystem- or network-jailed. An absolute path also does not match the path guard's repo-relative immutable patterns; its docstring explicitly assigns repo-relative validation to the caller.

Consequently, an adversarial candidate could in principle tamper with in-memory state, inspect files outside its declared patch, probe the oracle, or abuse ambient credentials even when its committed diff cannot modify evaluator files. Stronger deployments should run candidate and protected scorer in separate trust domains, expose only a narrow task protocol, scope credentials, make protected data unreadable to the candidate, and bind the final receipt to candidate commit, evaluator revision, task-set identity, policy, and outcome.

This complements [Agent Self-Evolution: Evidence Profiles and Release-Control Boundaries](../agent-self-evolution-evidence-and-release-controls.md): Raven provides a concrete mechanism for withholding adaptive evaluation signals, while also documenting why a code-level write guard is not process isolation.

## Limits

- Scout inspected repository source and documentation but did not install Raven, run its tests, execute a candidate, or reproduce any benchmark.
- Repository benchmark and showcase results are maintainer claims for this assessment; the inspected artifacts establish mechanism shape, not reported performance.
- The README says the unit/e2e suite and one AppWorld smoke were exercised, but a full-size multi-round run and real-benchmark sealed unseal were not yet exercised at scale. Scout did not independently verify either statement.
- The HN item had one point and no comments when retrieved, so it is a discovery signal rather than evidence of community validation.
- The repository was inspected at one moving pre-alpha revision. Defaults, path coverage, and control wiring can change quickly.
