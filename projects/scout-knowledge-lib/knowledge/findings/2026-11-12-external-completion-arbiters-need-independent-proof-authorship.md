<ai_context>
summary: "punchtape usefully binds task text, claimed code ranges, exact check outputs, environment fingerprints, drift, and a durable verdict, but the working agent authors the requirements mapping, proof commands, expected bytes, claims, and exclusions; an external runner is not an independent correctness oracle unless proof obligations and exemptions carry separate authority provenance."
triggers: ["punchtape", "external completion arbiter", "proof authorship", "agent-authored checks", "completion verdict", "evidence authority", "verification independence"]
last_updated: "2026-11-12"
source_basis: "Static inspection of neurophant/punchtape at pinned commit 03d8fd248ef77e51e269bcdc8c15b090bc16c4b0: complete non-truncated 983-entry repository tree, README, architecture and validation contract, campaign methodology, and selected producer-authored verdict/proof tests. Scout did not install or run the program, execute its tests or campaigns, inspect the linked preprint in full, reproduce reported field results, or validate security and filesystem behavior independently."
</ai_context>

# External completion arbiters need independent proof authorship

**Date:** 2026-11-12  
**Disposition:** new knowledge  
**Coverage:** static source and producer-authored test inspection at one pinned revision

**Repo:** https://github.com/neurophant/punchtape  
**Pinned revision:** https://github.com/neurophant/punchtape/commit/03d8fd248ef77e51e269bcdc8c15b090bc16c4b0

## Observation

`punchtape` is a Go state machine that sits beside a coding agent and owns a durable task record. The inspected design preserves the user's task lines, requires each line to receive a declared outcome, maps requirements to behaviors and claimed code ranges, runs exact-output checks itself, binds green rows to claim and environment fingerprints, re-runs stale checks, detects post-verdict drift, and refuses completion while requirements, coverage, checks, questions, or tree accounting remain open. This is a useful separation between an agent saying "done" and a machine recording a verdict.

The repository also states an important limit: the machine measures bytes and sets, not meaning. The same working agent that changes the code fills the submission document with the requirement interpretation, behavior prose, claimed ranges, check commands, expected output or files, and exclusions. Validation proves that these objects are complete and internally consistent; it does not establish that their semantics faithfully test the user's intent.

A checked-in verdict test demonstrates the boundary compactly. It creates a behavior named `The copy`, claims one input line, covers the requirement, runs a shell command chosen in the submission, and expects an author-chosen output file containing `ok`. The state machine correctly refuses an empty corpus, executes the declared check, seals a green verdict, and later opens that verdict when the claimed line drifts. What it proves is that the declared command produced the declared bytes against the declared subject. The command, expected bytes, coverage relationship, and exclusions are not independent observations merely because another process executes them.

This distinction matters because the README makes stronger user-facing claims such as taking verification away from the user and being an external party that owns the task's truth. Its "Honest limits" section narrows the actual guarantee to formal integrity and says the final semantic look remains with the user. The architecture supports the narrower claim well: it makes omissions, stale proofs, mutable history, and self-reported process success harder to hide. It does not by itself solve adversarial or mistaken proof design.

## Interpretation

An external completion service should separate **execution independence** from **evidence-authority independence**:

1. **Execution independence:** a framework-owned process runs the check, captures the actual exit, output, files, environment, and subject revision, and does not trust the agent's narration.
2. **Specification independence:** the acceptance claim, oracle, expected result, allowed exclusions, and coverage mapping come from an owner-controlled source or receive an explicit independent review.
3. **Subject binding:** the receipt identifies the exact task text, code ranges or artifact revision, check definition, environment, and result.
4. **Authority provenance:** each requirement, check, expected value, exclusion, and approval records who proposed it and which authority accepted it.
5. **Negative challenge:** high-impact checks are tested against known-bad variants or mutation negatives so a self-consistent but vacuous oracle cannot mint completion.

Agent-authored checks remain valuable. They can provide fast regression protection, expose the candidate's theory of correctness, and reduce repeated work when fingerprints have not changed. But they should be treated as **proposed evidence** until their authority is established. For low-risk tasks, owner review of the side-by-side requirement and check may be sufficient. For release, security, migration, or irreversible effects, an independently controlled evaluator or explicit human acceptance should be required before the durable completion transition.

The corresponding runtime rule is: **do not call a verdict independent merely because the verifier process is outside the agent.** Independence depends on who controls the proof obligation and oracle, not only who invokes the command. A trustworthy receipt should let later readers distinguish user text, agent interpretation, agent-proposed check, framework measurement, independent review, and final acceptance.

## Limitations

All inspected evidence is producer-authored. Scout did not build or run `punchtape`, execute its Go tests, reproduce the repository's campaigns, audit all call sites, test journal tamper resistance, verify shell/process isolation, or inspect the linked preprint and raw campaign data in full. The repository reported zero stars at retrieval. Its README reports field-study results from a non-peer-reviewed preprint, but this scan did not validate those figures or study design. The finding therefore evaluates the visible authority boundary and proof contract, not the tool's empirical effectiveness, security, adoption, or production fitness.

## Inspected source

- [README and stated limits](https://github.com/neurophant/punchtape/blob/03d8fd248ef77e51e269bcdc8c15b090bc16c4b0/README.md)
- [Architecture, validation rules, fingerprints, staleness, and verdict gates](https://github.com/neurophant/punchtape/blob/03d8fd248ef77e51e269bcdc8c15b090bc16c4b0/docs/ARCHITECTURE.md)
- [Verdict tests](https://github.com/neurophant/punchtape/blob/03d8fd248ef77e51e269bcdc8c15b090bc16c4b0/internal/application/verdict_test.go)
- [Proof tests](https://github.com/neurophant/punchtape/blob/03d8fd248ef77e51e269bcdc8c15b090bc16c4b0/internal/application/proofs_test.go)
- [Field-campaign methodology](https://github.com/neurophant/punchtape/blob/03d8fd248ef77e51e269bcdc8c15b090bc16c4b0/campaigns/METHODOLOGY.md)
