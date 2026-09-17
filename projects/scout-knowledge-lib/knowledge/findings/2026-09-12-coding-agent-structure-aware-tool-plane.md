<ai_context>
summary: "AFT, Graphify C#, and rust-split show coding-agent infrastructure moving below the model loop: a stateful operation plane, compiler-resolved semantic evidence, and a parser-aware structural transform with a byte-identity checkpoint before rewriting. All three have implementation or test artifacts, but none of the cited source sets establishes an end-to-end agent effectiveness result, so the signal is architectural rather than a benchmark claim."
triggers: ["AFT", "cortexkit", "Graphify C#", "Roslyn", "rust-split", "coding agent tools", "symbol-aware editing", "compiler-resolved usages", "lossless explode", "pure-move diff", "tool hoisting", "persistent bridge", "agent IDE", "undo stack"]
last_updated: "2026-09-12"
source_basis: "GitHub repositories cortexkit/aft pinned at e0dd5277026b7a0ac01cf168493eeaf725c93284, zachsaw/graphify-csharp pinned at 66f3c03ec5d199e5e85178cd567b89534552e1e2, and owebeeone/rust-split pinned at d5504eb498fec44d0ee3b245848848590043b24e; HN items 49667188 and 49671509 and their discussions."
</ai_context>

# Coding-agent tools are becoming a stateful substrate, not a bag of commands

**Date:** 2026-09-12  
**Status:** Source-grounded GitHub finding

## Core signal

GitHub discovery surfaced `cortexkit/aft`, whose useful signal is not the long
list of tools but **where the project places responsibility**. Thin OpenCode and
Pi adapters can replace familiar `read`, `write`, `edit`, `grep`, and `bash`
slots, while a persistent Rust process shared per project root maintains parse
trees, indexes, background tasks, backups, and session-isolated undo history.
The model can keep using ordinary tool names while the substrate changes from
line-oriented commands into a stateful code-operation plane.

At the pinned revision, the repository exposes three coupled capability groups:

- structural perception: symbol outlines and zoom, call graphs, semantic and
  lexical search, LSP diagnostics, and persisted trigram indexes;
- guarded mutation: symbol-level and AST edits, formatting, diagnostics,
  multi-file patch rollback, backups, checkpoints, and restore;
- process continuity: persistent bridge processes, detached shell tasks,
  interactive PTYs, output compression, and task state that survives host
  restarts.

The repository tree is not merely a paper index or metadata-only announcement.
It contains the Rust workspace plus OpenCode scenario suites for outline,
search, zoom, edit, patching, safety, and background-shell operations, as well
as Pi RPC tests. The recursively inspected tree was complete
(`truncated=false`, 4,010 entries). This establishes that implementation and
test artifacts exist; Scout did not execute them and therefore does not claim
that they pass or that the advertised behavior works in deployment.

## HN update: language-specific semantic evidence is becoming its own agent tool

A later HN thread surfaced `zachsaw/graphify-csharp`, a narrower but
complementary implementation. The headless CLI loads C# projects through
MSBuild/Roslyn and emits compiler-resolved declarations plus `calls`,
`references`, `inherits`, `implements`, and `overrides` edges as deterministic
JSON. Its bundled agent skill tells Codex- and Claude-compatible hosts to refresh
that evidence before answering structural questions and explicitly warns that
zero inbound edges are observed static evidence, not proof of runtime
unreachability.

This sharpens the substrate pattern: general structural tools are being joined
by **language-native evidence adapters** that preserve overload, generic,
project, target-framework, and source-location identity rather than asking a
model to reconstruct those facts from text search. The repository also defines
an explicit freshness barrier: a warm watcher may prepare changes, but the
ordinary command publishes a complete snapshot before the consumer proceeds.
That makes evidence freshness part of the tool contract rather than an implicit
assumption in the prompt.

The HN discussion exposed a concrete scaling boundary. When asked whether one
JSON document becomes unwieldy on million-line codebases, the project author
said output for his repository already exceeded 600 MB. Other commenters noted
that Copilot and JetBrains already expose forms of semantic indexing, so this is
not evidence that the capability is novel or uniquely effective. Its distinct
signal is an open, headless, agent-consumable evidence format and skill. One
commenter reported adapting the skill for Unity packages, but that anecdote is
not adoption or outcome evidence.

## HN update: separate lossless extraction from semantic rewriting

HN item `49671509` surfaced `owebeeone/rust-split`, a Rust-specific structural
transform with a useful two-stage verification boundary. Its `explode` pass
uses `syn` to locate top-level items while retaining attached comments and
attributes. Before any module rewrite is trusted, the bundled workflow requires
concatenating the chunks in manifest order and proving byte-for-byte identity
with the original. Only the later `split` pass changes module declarations,
imports, re-exports, and visibility; users are told to write to a temporary
output, review the generated layout, then let the compiler enumerate fallout.
Formatting is deliberately deferred so the structural move remains reviewable.

This is narrower than AFT and does not provide compiler-resolved semantics like
Graphify C#. Its useful pattern is **phase-specific proof**: verify that the
parser's extraction is lossless before accepting the non-lossless architectural
rewrite. The repository also keeps policy separate from mechanism. Its 1,000
LOC review trigger and 500 LOC target are suggested guidance, not automatic CLI
decisions; syntactic adjacency is explicitly evidence rather than architecture.
That prevents a mechanical transform from silently acquiring authority to
decide when or how a codebase should be decomposed.

The inspected revision contains source plus dedicated `explode` and `split`
tests and a complete 79-entry repository tree, but Scout did not run them. The
project documents important residual risks: syntactic references are not a
semantic call graph, registration macros can require manual reconstruction,
large leaf items remain indivisible, and some computed include paths cannot be
rebased mechanically. The Show HN author's claims about lower token use and
quadratic hand-editing cost are plausible motivation, not measured comparative
results in the cited materials.

## Why this matters

The emerging abstraction is a **tool substrate with retained operational state
and explicit transition proofs**, not an MCP-style catalog of independent
calls. Co-locating perception, mutation, process lifecycle, and recovery lets
one layer make stronger invariants possible: an edit can be parsed, formatted,
diagnosed, backed up, and made undoable without asking the reasoning loop to
compose those safeguards every time. Graphify C# shows a related decomposition:
where a broad substrate cannot authoritatively resolve language semantics, a
compiler-backed adapter can publish evidence under an explicit refresh
contract. Rust-split adds that a transform should expose checkpoints whose proof
matches the phase: byte identity for extraction, then compiler/tests and human
review for the architectural rewrite.

There is also a compatibility and governance consequence. “Hoisting” preserves
the host-visible name while changing its implementation and semantics. A
permission policy, audit log, or evaluation that treats `bash` or `edit` as a
stable primitive may miss command rewriting, persistent descendants, backups,
indexes, or cross-session state added below that slot. Agent platforms should
identify and attest the resolved tool provider—not only the name the model
called—and test recovery and permission behavior across the whole substrate.

## Evidence limits

- The README says a reproducible benchmark suite is still in progress and
  publishes no completed latency, token-reduction, or end-to-end success
  numbers. Claims such as increased productivity or reduced token usage remain
  project claims, not demonstrated outcomes in this finding.
- Repository scenario files prove test artifacts exist, not that the suites
  pass. No package was installed and no code was run.
- GitHub stars and recent activity were discovery signals only; they are not
  evidence of adoption, reliability, or security.
- Graphify C# was inspected from documentation and source artifacts, not
  installed or executed. Its repository does not publish a comparative
  end-to-end agent benchmark in the cited materials.
- Rust-split was inspected from its README, bundled skill, repository tree, and
  Show HN thread, not installed or executed. Its source and tests do not prove
  the author's token-savings claim or establish benefit outside Rust refactors.
- The HN scores and comments show attention and surface design questions; they
  do not establish correctness, large-repository usability, or broad adoption.
- The repositories were inspected at pinned revisions. Later default-branch
  behavior may differ.

## Sources

- Rust-split HN discussion: https://news.ycombinator.com/item?id=49671509
- Rust-split repo: https://github.com/owebeeone/rust-split
- Rust-split pinned revision: https://github.com/owebeeone/rust-split/commit/d5504eb498fec44d0ee3b245848848590043b24e
- Rust-split README at pinned revision: https://github.com/owebeeone/rust-split/blob/d5504eb498fec44d0ee3b245848848590043b24e/README.md
- Bundled rust-split skill: https://github.com/owebeeone/rust-split/blob/d5504eb498fec44d0ee3b245848848590043b24e/skills/rust-split/SKILL.md
- Graphify C# HN discussion: https://news.ycombinator.com/item?id=49667188
- Graphify C# repo: https://github.com/zachsaw/graphify-csharp
- Graphify C# pinned revision: https://github.com/zachsaw/graphify-csharp/commit/66f3c03ec5d199e5e85178cd567b89534552e1e2
- Graphify C# README at pinned revision: https://github.com/zachsaw/graphify-csharp/blob/66f3c03ec5d199e5e85178cd567b89534552e1e2/README.md
- Graphify C# compatibility contract: https://github.com/zachsaw/graphify-csharp/blob/66f3c03ec5d199e5e85178cd567b89534552e1e2/docs/COMPATIBILITY.md
- Bundled Graphify C# agent skill: https://github.com/zachsaw/graphify-csharp/blob/66f3c03ec5d199e5e85178cd567b89534552e1e2/.agents/skills/graphify-csharp/SKILL.md
- Repo: https://github.com/cortexkit/aft
- Pinned revision: https://github.com/cortexkit/aft/commit/e0dd5277026b7a0ac01cf168493eeaf725c93284
- README at pinned revision: https://github.com/cortexkit/aft/blob/e0dd5277026b7a0ac01cf168493eeaf725c93284/README.md
- Complete tree at pinned revision: https://api.github.com/repos/cortexkit/aft/git/trees/e0dd5277026b7a0ac01cf168493eeaf725c93284?recursive=1
- Example search scenario: https://github.com/cortexkit/aft/blob/e0dd5277026b7a0ac01cf168493eeaf725c93284/tests/docker/opencode2/scenarios/aft_search/search.scenario.test.ts
- Example safety scenario: https://github.com/cortexkit/aft/blob/e0dd5277026b7a0ac01cf168493eeaf725c93284/tests/docker/opencode2/scenarios/aft_safety/safety.scenario.test.ts
