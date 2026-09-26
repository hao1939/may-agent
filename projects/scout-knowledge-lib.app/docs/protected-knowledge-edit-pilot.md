# Scout knowledge publication boundary

## Implemented decision

Scout publishes at each accepted durable-write boundary. `scout-explore`,
`knowledge-planner` (including generic goals and fallback owner review), and
`scout-assess-source` all use the same small Git helper. A periodic sweep was
rejected because it cannot distinguish accepted knowledge from an abandoned
or rejected draft. A broad Host worktree framework was also rejected: Scout
needs isolation only around its own `knowledge/` and `reports/` writes.

The helper allocates a detached Git worktree under `.state/scout-publication/`
in the workflow's admitted output directory. This also works when the Host
supplies the App root as that output directory. Code passes that candidate project root to the writer.
Exploration and planner agents judge usefulness, source continuity, links,
and whether a change fulfills the assignment. Assessment code owns retrieval
and archive construction. Code—not agent prose—then inventories candidate
bytes, validates scope and regular-file ancestry, commits exact named paths,
checks concurrent branch/path state, and reads the commit back byte-for-byte.
Only after those checks does workflow evidence say `publication:commit:<sha>`
and list repository paths plus canonical output paths.

`archive:false` never allocates or publishes an assessment record. A write
boundary with no durable change returns `publication:no-change`, makes no
commit, and removes its pristine candidate worktree. Exploration additionally
rejects durable changes omitted from the
agent's output list. Failed or rejected calls are not published; their isolated
candidate and changed-path inventory are retained in workflow evidence for
review instead of contaminating the shared library.

For routine exploration, Scout compares existing notes with the current question
and source evidence before choosing a write. A fitting, still-current note can
stay unchanged: return `outputs: []` and cite the note and comparison in the
summary. Changed evidence or required coverage can justify updating the matching
note even when the source URL is unchanged. A shared topic alone does not make
two subjects interchangeable; use a new finding when no note fits. This is
Scout's judgment, using the existing no-change publication path. It adds no
Host reuse rule or publication state. Requested source assessments retain their
separate code-owned coverage and archive contract.

After successful exploration publication, code translates candidate-root paths
in the returned summary to canonical library paths, just as it returns canonical
output paths. This applies to both changed and unchanged results: a no-change
candidate is removed too. Failed publication keeps its original failure and
candidate evidence; it does not claim a canonical result.
The [reuse and return-link trial](verification/scout-reuse-guidance-20260926.md)
records the observed failure, correction, and validation limits.

## Git transaction and recovery

Publication stages only the exact changed paths in the isolated candidate; it
never uses repository-wide `git add`. Before either the no-change or changed
publication path, it rejects newly introduced uncommitted canonical Scout edits,
including an undeclared direct write alongside an otherwise valid candidate.
It preserves that observed edit and the candidate for owner recovery. Before
integration it rejects a target
that was dirty at allocation, a symlink/non-file output, an unreviewed deletion,
or concurrent change to an intended path. A disjoint branch advance is accepted
by replaying the already captured candidate bytes onto the new parent.

The candidate commit is created and read from Git. Before any canonical write,
the helper exclusively acquires the canonical index lock, rechecks the branch,
both index and worktree dirtiness, and every intended canonical ancestor (no
symlink traversal). It builds a replacement index from the existing index and
changes only intended entries, preserving unrelated staged bytes and modes.
Candidate bytes are prepared in same-directory temporary files; applied files
and the index are rolled back if integration fails. The shared ref is advanced
last with an expected-old-value update, and an uncertain command result is
accepted only when Git read-back proves that exact commit. A lock, protected
path, or ref race is rolled back without moving the branch or leaving Scout
bytes in the canonical checkout in tested ordinary failures. This is not a
claim of atomic recovery from arbitrary process crashes or external filesystem
writers. If rollback itself encounters another failure, it still attempts every
remaining applied-file and index restoration, and reports unresolved branch,
file, or index effects with the retained candidate. The retained candidate base,
revision, and complete
base-to-revision/worktree path inventory are recovery evidence. Git remains the
only registry: a retry that observes committed bytes is a no-change at that
revision rather than a duplicate commit.

The mechanism preserves file modes supplied by Git for existing regular files;
new knowledge is ordinary non-executable content. It intentionally does not
make arbitrary direct edits to canonical paths transactional. Direct Scout use
must either use this workflow boundary or report exact uncommitted paths for an
owner to adopt; it must never broadly stage or claim a commit from prose alone.

## Accepted publication ownership

A publication failure after Scout has accepted content is different from a
rejected or unfinished draft. The publisher commits the exact admitted Scout
paths to a content-keyed `refs/archive/scout-publication/...` ref and verifies
that ref before exposing it. The ref, revision, original parent, and changed-path
inventory form an immutable recovery descriptor; the temporary worktree may be
removed. A disjoint canonical advance does not broaden that inventory, and a
failed archive operation does not claim durable recovery.

The workflow then requests an ordinary `scout-knowledge-lib` generic goal whose
stable dependency id comes from the content-keyed ref. Replays therefore reuse
the same input, while later scans and unrelated publications proceed
independently and cannot satisfy the retained obligation. Planner publication
failure preserves an already admitted waiting result as a whole, including
unrelated dependencies, Conditions, actions, result data, report state,
`continue`, and `reviewAt`. Recovery failure does not recursively create another
recovery goal.

The ordinary Scout owner reads the archived Git tree and chooses the remedy. On
recovery, the planner also reads the exact current Task through the supported
Task API and presents its retained publication failure, archive descriptor, and
previous-attempt link. Relevant caller procedure input is shown separately and
remains subordinate to the Task requirement. An unavailable exact read is made
explicit rather than replaced by a scan or an empty-history assumption.

The canonical project is a read-only observation target and final link
destination for the bounded writer, never its write target. Candidate
editability does not prove that the corresponding canonical path can be
atomically replaced. Scout may use non-mutating checks to understand the exact
destination, but must not probe-write, overwrite in place, change permissions or
mounts, or bypass the publisher. A confirmed protected destination is not
retried unchanged merely because archive restoration succeeds in the candidate.

Scout may reproduce the exact bytes or judge a suitable writable adaptation;
the shared publisher still verifies the actual committed outputs. An adaptation
must explain how it preserves this accepted candidate and its provenance; a
narrow linked addendum is preferable when suitable to renaming or duplicating a
protected original. A no-change claim closes the publication obligation only
when Git proves canonical HEAD contains the exact archived bytes. An adapted
commit counts only with Scout's accepted `converged` judgment. A waiting or
incomplete result, including a partial unrelated commit, does not assert
delivery. When integration truly requires a human decision, Scout returns a
supported human-owned Condition through normal Task reconciliation and sleeps
for that fact; publication code does not invent an approval event, request an
immediate retry, or change protected mounts, permissions, or bytes.

Standing source Tasks use the native Scout owner as their reconciliation
executor. Each wake supplies the current Task, accepted result, pending inputs,
Conditions, and dependencies so Scout can decide whether a new scan is useful.
Review-only reconciliation returns the standard Task result directly without
source setup. When Scout selects source work, it invokes `scout-explore`; that
workflow remains the only path for current-source validation, candidate checks,
and atomic publication. Its complete admitted result is carried back through
the native owner, so an independent scan can coexist with an accepted
publication recovery or another wait without satisfying or discarding it. This
reuses agent-owned method selection and the existing workflow boundary instead
of adding a wake classifier, preflight protocol, or publication state machine.
The extra cost is one native owner judgment on each source-task wake; source I/O
and the nested Scout research call occur only when that judgment selects a scan.

## Existing backlog

The separate reviewer adoption is complete at local-main commit
`16937cf877b9738410569ab84b894fbb0dfd6343`. It committed all 149 historical
Scout paths plus the adoption report after exact-byte, deletion, source-link,
and 457 retained-result published-path checks. The canonical Scout project was
clean at review completion and unrelated design work was preserved.

The committed [adoption report](../../scout-knowledge-lib/reports/triage/scout-git-backlog-adoption-2026-09-18.md)
records the scope and verification. Detailed per-path receipts remain in
`backlog-review/adoption-result.json`, `manifest-draft.json`, and
`published-path-check.json` under the review-pilot artifact directory.
No second backlog commit or `archive:false` publication is required.
