<ai_context>
summary: "MuscleMemory turns successful coding-agent traces into procedural skills only after two later matching checks and separate human approval, and withdraws a skill after a specifically attributable failed check. Its author-run benchmarks support a narrow repeat-workflow efficiency signal, not a general quality or success-rate gain."
triggers: ["MuscleMemory", "procedural memory", "skill promotion", "skill verification", "agent memory", "50113506"]
last_updated: "2026-10-16"
source_basis: "HN item 50113506 and TheWariend/MuscleMemory README, design documentation, repository tree, and author-released benchmark reports inspected at commit 51946bd800813881a1348d92b71e04cdeeedc415. Static documentation and artifact inspection only; Scout did not install the project, run its tests, reproduce its benchmarks, or audit implementation paths."
</ai_context>

# Procedural memory needs promotion and withdrawal gates

**Observed:** 2026-10-16  
**Disposition:** New source-grounded finding  
**Question:** What does the current HN-linked implementation add to Scout's model of procedural agent memory?  
**Coverage:** HN item, repository README and tree, how-it-works and benchmark documentation, and three benchmark reports at the pinned revision. Scout did not execute the software or benchmarks.

## Sources

- **HN:** https://news.ycombinator.com/item?id=50113506
- **Repo:** https://github.com/TheWariend/MuscleMemory
- **Reviewed revision:** [`51946bd800813881a1348d92b71e04cdeeedc415`](https://github.com/TheWariend/MuscleMemory/commit/51946bd800813881a1348d92b71e04cdeeedc415)
- **Pinned design:** https://github.com/TheWariend/MuscleMemory/blob/51946bd800813881a1348d92b71e04cdeeedc415/docs/how-it-works.md
- **Pinned Codex report:** https://github.com/TheWariend/MuscleMemory/blob/51946bd800813881a1348d92b71e04cdeeedc415/benchmarks/results/codex/luna-03/report.md
- **Pinned Django report:** https://github.com/TheWariend/MuscleMemory/blob/51946bd800813881a1348d92b71e04cdeeedc415/benchmarks/results/codex/django-forms-01/report.md

## What the implementation claims to separate

MuscleMemory captures coding-agent activity, compiles a successful session into a compact skill, retrieves a candidate for a later related task, and checks whether current files still resemble stored before/after edits. Its most useful design signal is not extraction itself but the state machine around admission:

1. A training session can propose a skill when a recognized test passes after the last code change.
2. The training session does not count as verification. Two later sessions must match the skill's actions and finish with its stored test as the final passing test.
3. A person must separately approve every skill or new version. The repository says agent keys cannot perform this admin action.
4. Recall is conditional on current-file checks; no match yields no injection, while a partial match carries a warning.
5. A later session withdraws the skill from use only when attribution is specific: the skill was supplied, code changed, and the skill's own test was the last test and failed. Merely stopping or failing another test does not count.
6. Deleted or retired skills leave a fingerprint tombstone so the same procedure is not silently relearned.

The mechanism therefore distinguishes **capture**, **candidate compilation**, **independent checks**, **human admission**, **contextual recall**, **failure attribution**, and **retirement**. That is a stronger lifecycle than treating every successful trajectory or generated `SKILL.md` as immediately reusable authority.

## Comparison with existing Scout knowledge

Scout's [five-layer memory finding](./2026-10-15-xhs-memory-lifecycle-needs-forgetting.md) already argues that successful episodes need promotion criteria and that stale procedures need retirement. MuscleMemory is a concrete, pinned implementation of part of that lifecycle: it supplies proposed promotion, approval, current-file matching, failure-based withdrawal, and tombstones. It does not establish that its gates are sufficient or transferable beyond its supported coding-agent integrations.

The broader [operational-memory note](../hn-agent-operational-memory.md) separates raw session archives from admitted current memory. MuscleMemory sharpens the admission side: a task-local test result is evidence for a procedure, but its own Django report demonstrates why one passing session is weak. A training issue passed the agent's selected test yet failed hidden evaluation; the resulting skill was not delivered because it lacked the two later checks.

## Benchmark evidence and ceiling

The repository's strongest repeat-workflow report covers 18 Codex sessions: three controlled repair tasks, each run three times with and without frozen skills learned from earlier same-kind tasks. All sessions passed independent checks; the memory arm reports 25.5% fewer input tokens, 30.4% fewer tool calls, and 28.2% less wall time. Eight of nine pairs used fewer input tokens. This is an author-run efficiency result on repeated controlled work, not a success-rate result.

A more realistic Django/SWE-bench report is much less conclusive. It scores one issue three times per arm after learning from four other issues in the same file area. Each arm resolves one of three runs. The memory arm reports 50.5% fewer aggregate input tokens, but the report says a no-change early stop contributes substantially; comparing only the resolved run in each arm gives 27% fewer input tokens. One issue and three repeats cannot establish a success-rate or general efficiency improvement, and the report does not isolate the skill note from general codebase orientation.

The repository publishes prompts, session records, patches, summaries, hashes, and offline checking commands for its reports. Scout inspected the reports and tree but did not run those checks, verify every released record, or reproduce any model call.

## Reusable interpretation

A procedural-memory write should be treated like a staged control-plane change, not a summary append:

- bind the candidate to the task, changed artifacts, and exact success check;
- require evidence from later independent use rather than letting the generating run validate itself;
- keep approval authority outside the agent whose behavior the memory will steer;
- recheck environmental preconditions at recall time;
- withdraw only on attributable contrary evidence, without confusing silence with failure;
- retain a retirement identity so a rejected procedure cannot immediately regenerate under a new record.

These gates reduce obvious self-confirmation and stale-recall risks. They do not prove semantic correctness: repeated checks can share blind spots, test selection can be weak, file-text matching is not behavior equivalence, and human approval can be cursory.

## Evidence limits

- The HN item had three points and no displayed comments when inspected; it contributes discovery, not independent corroboration.
- The repository and benchmark artifacts are project-authored. Scout found no independent replication in this bounded scan.
- Scout did not install the software, execute tests, reproduce benchmark aggregates, audit dependency or model behavior, or test concurrent and adversarial use.
- The controlled Codex benchmark repeats three authored task types whose skills came from earlier tasks of the same kinds.
- The Django result is one scored issue with three repeats per arm and equal observed success counts.
- Current-file text checks and stored tests can detect some drift but do not establish complete behavioral validity, absence of hidden regressions, or cross-repository transfer.
