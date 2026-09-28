<ai_context>
summary: "HN surfaced FAB, a reproducible synthetic financial-due-diligence benchmark whose criterion, whole-task, and three-trial results separate partial correctness, completion, and repeatability. Across four evaluated models, criterion pass rates of 76.2–83.4% become whole-task pass rates of 47.3–60.0%, while only 36–48% of tasks pass in all three trials. Use conjunctive and repeated-run measures together, but do not generalize the rankings beyond the single synthetic company or treat an LLM judge as validated ground truth."
triggers: ["FAB", "Finance Agents Benchmark", "financial due diligence", "criterion pass rate", "task completion", "pass@3", "pass^3", "agent repeatability", "conjunctive grading"]
last_updated: "2026-09-28"
source_basis: "HN item 49874360 and pinned repository inspection at 66c08aa996a38ce9ded63d75bc8eb772b3150dac; README, walkthrough, published result JSON, judge implementation, and one representative task inspected. Results and tests were not independently rerun."
</ai_context>

# FAB separates partial correctness from repeatable task completion

**Date:** 2026-09-28  
**Source:** https://news.ycombinator.com/item?id=49874360  
**Repo:** https://github.com/SecondState-ai/finance-agents-benchmark  
**Pinned observation:** [`66c08aa996a38ce9ded63d75bc8eb772b3150dac`](https://github.com/SecondState-ai/finance-agents-benchmark/commit/66c08aa996a38ce9ded63d75bc8eb772b3150dac)  
**Disposition:** new knowledge

## Observation

FAB is an open benchmark for agents performing financial due diligence in one
synthetic company data room. Its current release contains 50 tasks, 160 files,
and 231 grading criteria. The files span SAP-shaped CSV exports, spreadsheets,
PDFs, Word documents, slides, and email. Each run receives the shared data room
read-only in a network-disabled sandbox, while criteria and private generation
data remain outside the agent workspace. The repository publishes the task
specifications, harness, 600 model answers, grades, run metadata, and compressed
traces.

The design exposes three materially different success questions:

1. **Criterion pass rate:** how many requested facts or judgments were present?
2. **Whole-task pass rate:** did one answer satisfy every criterion?
3. **Repeated completion:** did a task pass at least once across three trials
   (`pass@3`), or in all three (`pass³`)?

The published report shows why these should not be collapsed:

| Model | Criterion pass | Whole-task pass | Pass at least once in 3 | Pass all 3 |
| --- | ---: | ---: | ---: | ---: |
| DeepSeek V4.1 Flash | 81.0% | 60.0% | 76% | 46% |
| GPT-6 Sol | 83.4% | 58.7% | 70% | 48% |
| GPT-6 Luna | 79.5% | 50.7% | 66% | 38% |
| GLM 5.3 Flash | 76.2% | 47.3% | 60% | 36% |

Thus a model can satisfy roughly four-fifths of criteria yet complete only about
half of tasks. The gap is partly a declared scoring choice: one failed criterion
fails the whole task. Repetition then reveals a separate deployment property.
For each model, 11–15 of the 50 tasks passed in at least one trial but not all
three. A permissive “can it ever succeed?” measure and a strict “does it succeed
consistently?” measure therefore differ by 22–30 percentage points.

## Interpretation

For multi-part professional work, average component accuracy is not a sufficient
completion metric. One omitted reconciliation, unsupported assumption, or
misclassified uncertainty can invalidate an otherwise strong deliverable.
Conjunctive grading makes this visible; repeated trials distinguish a stable
capability from a recoverable but unreliable one.

A useful evaluation dashboard should retain all three layers rather than promote
one headline score:

- **component coverage** for diagnosing what is usually right;
- **end-to-end completion** for deciding whether the deliverable is usable; and
- **trial stability** for estimating whether a successful run is reproducible.

The repository also models useful provenance practices: report hashes pin task
files and the judge policy, saved scores are not silently overwritten, and the
report separately records failed attempts and unknown usage. Its scoring update
is especially instructive: tasks 041 and 049 were restored using existing
regrades while the report preserved the unresolved assumption ambiguity. A
score can be mechanically included without erasing a validity concern.

## Limitations

- All tasks share one generated company and its planted facts. The results do
  not establish general financial-due-diligence ability or model superiority.
- A single LLM judge (`gpt-6-luna`, maximum reasoning) grades each criterion
  independently from the task, rubric, and submitted answer. It cannot inspect
  the data room or tool trace, and the inspected materials do not report human
  calibration or inter-rater agreement. GPT-6 Luna is also one evaluated model,
  so comparative rankings need independent-judge sensitivity checks.
- The report notes that the harness system prompt changed after the published
  agent runs and that criteria were clarified for the frozen final grades.
  Results are tied to the recorded artifacts, not necessarily current main.
- There were 106 extra agent attempts after failures across 600 completed runs;
  requests without returned usage are excluded from cost estimates. Reliability
  of the surrounding provider/harness is therefore distinct from answer quality.
- This assessment inspected pinned source and published artifacts but did not
  execute the harness, rerun the models or judge, validate the synthetic ledger,
  or independently reproduce any score.

## Evidence inspected

- [`README.md`](https://github.com/SecondState-ai/finance-agents-benchmark/blob/66c08aa996a38ce9ded63d75bc8eb772b3150dac/README.md)
- [`docs/tutorial.md`](https://github.com/SecondState-ai/finance-agents-benchmark/blob/66c08aa996a38ce9ded63d75bc8eb772b3150dac/docs/tutorial.md)
- [`reports/meridian/results-2026-09-27.json`](https://github.com/SecondState-ai/finance-agents-benchmark/blob/66c08aa996a38ce9ded63d75bc8eb772b3150dac/reports/meridian/results-2026-09-27.json)
- [`harness/judge.py`](https://github.com/SecondState-ai/finance-agents-benchmark/blob/66c08aa996a38ce9ded63d75bc8eb772b3150dac/harness/judge.py)
- [`tasks/meridian/tasks/001/task.json`](https://github.com/SecondState-ai/finance-agents-benchmark/blob/66c08aa996a38ce9ded63d75bc8eb772b3150dac/tasks/meridian/tasks/001/task.json)
