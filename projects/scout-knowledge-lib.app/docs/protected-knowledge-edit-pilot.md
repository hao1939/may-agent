# Scout knowledge publication boundary

## Implemented decision

Scout publishes at each accepted durable-write boundary. `scout-explore`,
`knowledge-planner` (including generic goals and fallback owner review), and
`scout-assess-source` all use the same small Git helper. A periodic sweep was
rejected because it cannot distinguish accepted knowledge from an abandoned
or rejected draft. A broad Host worktree framework was also rejected: Scout
needs isolation only around its own `knowledge/` and `reports/` writes.

The helper allocates a detached Git worktree under the workflow's retained
output directory. Code passes that candidate project root to the writer.
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
