<ai_context>
summary: "Cairn Memory preserves source receipts, revision-guards correction and forgetting, and reports a four-case real-model pilot in which the answer omitted essential facts that were present in selected, untruncated evidence. Receipts and retrieval telemetry establish evidence availability, not that the answer used it adequately."
triggers: ["Cairn Memory", "memory receipts", "answer-stage omission", "agent memory evaluation", "source evidence", "revision-guarded correction"]
last_updated: "2026-11-13"
source_basis: "Read-only GitHub Repository Search API discovery and pinned static inspection of Cairn-ink/cairn-memory revision 4184df95bffa6c27112aa8ba929568945a454773, including README, architecture, local-store contract, limitations, recursive tree, and producer-authored four-case real-model pilot. Scout did not run the software, tests, models, or experiment."
</ai_context>

# Memory receipts do not prove that an answer used the evidence

**Date:** 2026-11-13  
**Disposition:** New source-grounded finding  
**Signal:** Developer-preview implementation and producer-authored diagnostic; useful evidence-contract pattern, not a general quality result.

## Source identity and question

- **Repo:** https://github.com/Cairn-ink/cairn-memory
- **Inspected revision:** [`4184df95bffa6c27112aa8ba929568945a454773`](https://github.com/Cairn-ink/cairn-memory/commit/4184df95bffa6c27112aa8ba929568945a454773)
- **Discovery query:** GitHub Repository Search API query `topic:ai-agents pushed:>=2026-11-13 stars:>10`, sorted by `updated` descending with `per_page=50`
- **Search response:** `incomplete_results: false`; 50 returned items from `total_count: 1982`
- **Question:** What can source receipts and retrieval-stage telemetry establish about an agent answer, and what still requires separate evaluation?

## Source observations

Cairn Memory's local preview makes an important provenance distinction explicit. A **Source Receipt** stores the text submitted with a memory, but the README says that this does not prove that the memory is true or correctly interpreted. The local-store contract requires a receipt when remembering a memory, retains receipts for inspection, and revision-guards `correct` and `forget` so a stale caller must re-read rather than blindly overwrite newer state. Correction replaces active text and receipts; forgetting removes active text and receipts while retaining non-content identity and suppression metadata. The documentation separately warns that deleted or corrected bytes can remain in SQLite free pages, journals, backups, and caller-held copies.

Those mechanics improve lineage, concurrency behavior, and operator correction. They do not establish semantic quality. The repository's producer-authored four-case real-model pilot demonstrates the gap within one run:

- Cairn answered three of four newly authored synthetic long-history questions correctly under the report's model-judge rubric.
- In the failed room-premise case, the answer packer selected two evidence units with none omitted.
- Read-only inspection found that the selected receipts contained both the no-fee room's unavailability and the statement that Ferry Hall was not chosen and the pop-up was not cancelled.
- The generated answer still omitted essential parts of that selected evidence. Separately, an original decision passage was not selected, so the packed context also lacked complete decision context.

The report therefore localizes two distinct defects without claiming a general root cause: **selection completeness** and **answer-stage evidence use**. A trace saying that the right receipt existed, was retrieved, fit the budget, and was delivered to the model cannot by itself prove that the final answer preserved its required facts or avoided unsupported inference.

## Reusable evaluation rule

Evaluate memory-assisted answers as a chain of independently receipted claims:

1. **source fidelity:** the receipt accurately preserves what was submitted, with source identity and revision;
2. **memory admission:** the derived memory is authorized, current, and not contradicted or stale;
3. **retrieval coverage:** the selected units contain every fact needed for the task, with omission and truncation reported;
4. **delivery integrity:** the exact selected evidence reaches the answer stage under the recorded budget and ordering;
5. **criterion-level use:** the answer includes each required supported fact, distinguishes unknown from negative, and avoids forbidden inferences; and
6. **outcome value:** the memory-assisted answer improves the downstream task under a suitable comparison, rather than merely producing plausible prose.

This complements [Derived agent memory needs a source-versioned validity boundary](./2026-10-02-sibyl-source-versioned-memory-validity.md): source revision can determine whether a derivative remains eligible, while the Cairn pilot shows that even eligible, selected evidence can be incompletely used. It also complements [Agent memory needs next-task value receipts](./2026-11-13-agent-memory-needs-next-task-value-receipts.md): consequence-level evaluation should retain stage-specific diagnostics so a failure can be assigned to admission, selection, delivery, answer use, or the downstream task rather than to “memory” as one undifferentiated component.

For agent runtimes, the practical gate is to keep evidence-availability receipts separate from answer-acceptance receipts. A successful retrieval trace should route review and diagnosis; it should not automatically validate the answer.

## Evidence and limitations

Primary inspected artifacts at the pinned revision:

- [README and Source Receipt boundary](https://github.com/Cairn-ink/cairn-memory/blob/4184df95bffa6c27112aa8ba929568945a454773/README.md)
- [Architecture and public/private implementation boundary](https://github.com/Cairn-ink/cairn-memory/blob/4184df95bffa6c27112aa8ba929568945a454773/docs/architecture.md)
- [Local store correction, forgetting, and retention contract](https://github.com/Cairn-ink/cairn-memory/blob/4184df95bffa6c27112aa8ba929568945a454773/docs/local-store.md)
- [Known limitations](https://github.com/Cairn-ink/cairn-memory/blob/4184df95bffa6c27112aa8ba929568945a454773/docs/limitations.md)
- [Four-case real-model long-history feasibility pilot](https://github.com/Cairn-ink/cairn-memory/blob/4184df95bffa6c27112aa8ba929568945a454773/docs/evidence/long-history-live-pilot.md)
- [Complete pinned tree](https://api.github.com/repos/Cairn-ink/cairn-memory/git/trees/4184df95bffa6c27112aa8ba929568945a454773?recursive=1), which reported `truncated: false` with 3,293 entries

The four histories, outputs, scoring, request accounting, and checks are producer-authored. The sample is synthetic and tiny; the report explicitly disclaims a benchmark rank, statistical advantage, default-product result, or quality guarantee. Scout did not run Cairn, Mem0, the tests, the models, the pilot, SQLite recovery, correction races, or forgetting behavior, and did not independently verify the experiment ledger or rubric judgments. The inspected architecture also says the hosted service remains a separate private implementation pending staged migration, so public local-core evidence does not establish hosted behavior.
