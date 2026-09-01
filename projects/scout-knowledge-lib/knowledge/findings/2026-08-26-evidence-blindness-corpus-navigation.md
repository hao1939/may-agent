<ai_context>
summary: "Corpus access is not evidence realization. Measure the monotone Construction–Surface–Open–Locate funnel; for broad code search, expose exact coverage and stable drill-down instead of silently truncating evidence; distinguish navigation failures from downstream synthesis."
triggers: ["Evidence Blindness", "AtlasNav", "Signal Grep", "direct corpus interaction", "corpus navigation", "code search completeness", "evidence realization", "research agent retrieval", "fragment-level Qrel"]
last_updated: "2026-08-28"
source_basis: "arXiv:2608.24764v1 HTML paper plus xcjy8bao/pi-plugin-signal-grep source, tests, architecture, benchmark description, and GitHub CI at revision 6f0f4361c02c9e8fcffce532242d180694647a35."
</ai_context>

# Corpus Access Is Not Evidence Realization

Date: 2026-08-26  
Source: https://arxiv.org/abs/2608.24764v1  
HTML: https://arxiv.org/html/2608.24764v1  
Tags: research-agents, retrieval, evidence, corpus-navigation, code-search, evaluation, observability
Repo: https://github.com/xcjy8bao/pi-plugin-signal-grep
Revision: https://github.com/xcjy8bao/pi-plugin-signal-grep/commit/6f0f4361c02c9e8fcffce532242d180694647a35

## Signal

[Evidence Blindness in Direct Corpus Interaction](https://arxiv.org/abs/2608.24764v1)
identifies a useful observability gap for research agents: supporting evidence can
exist in the corpus and remain technically reachable, yet never become usable
within the interaction budget. A document may not surface; a surfaced document
may not be opened; an opened document may not expose its decisive passage. None
of these losses necessarily emits an error, so the agent can continue reasoning
from an incomplete evidence state.

The paper separates that process into a monotone realization funnel:

```text
Construction → Surface → Open → Locate → downstream synthesis
```

- **Construction:** valid supporting evidence exists in the accessible corpus.
- **Surface:** an identifiable supporting-document entry enters an agent-visible
  observation.
- **Open:** the canonical body enters model-visible context.
- **Locate:** a decisive fragment for the required evidence slot enters that
  context.

This is more diagnostic than final-answer accuracy or document recall alone.
The authors freeze a fragment-level relevance judgment set over 830
BrowseComp-Plus questions and 889 required evidence slots, then report whether
none, some, or all required slots reach each stage. Final correctness remains a
separate outcome: complete localization does not guarantee correct synthesis,
and incomplete localization does not logically require a wrong answer.

## What the experiment contributes

The proposed AtlasNav interface organizes a corpus offline into persistent,
multi-view Topic, Identity, Episode, and Relation neighborhoods, then combines
those channels with BM25 through a query-adaptive router. The downstream
search–read–verify agent remains fixed. The important intervention is therefore
corpus-side: reuse structure across queries instead of reconstructing a search
workspace from every trajectory.

On the paper's 830-question BrowseComp-Plus evaluation, AtlasNav improved strict
accuracy over the dynamic-workspace baseline by 3.98–21.57 percentage points
across four reported backbones while reducing recorded online inference cost by
0.62–30.21% within backbone. For the DeepSeek backbone, strict accuracy rose
from 84.58% to 92.05%; failure to surface the complete evidence set fell from
14.10% to 4.94%, and failure to locate it fell from 24.46% to 11.45%. The
stage-wise change matters more than the headline score: it supplies a mechanism
for the gain rather than attributing every failure to generic reasoning quality.

The same representation ranked highest in the paper's controlled PhantomWiki
comparison from roughly 10,000 to one million files, although all interfaces
degraded at the largest scale. On EnterpriseRAG-Bench it scored competitively
rather than best, with project-related and completeness-heavy questions
remaining difficult. These transfers support the navigation hypothesis without
showing that persistent structure removes document-consumption or synthesis
bottlenecks.

## GitHub implementation signal: completeness must survive compression

[Signal Grep](https://github.com/xcjy8bao/pi-plugin-signal-grep), a new Pi
extension inspected at revision
[`6f0f436`](https://github.com/xcjy8bao/pi-plugin-signal-grep/commit/6f0f4361c02c9e8fcffce532242d180694647a35),
turns the paper's Surface-to-Locate distinction into a concrete code-search
contract. Small result sets are returned in full. Broad searches first return
an exact per-file match distribution, with a cursor into the same retained
snapshot. Exceeding the 50,000-match retention bound produces an explicit
`partial` status rather than a clean-looking prefix presented as complete.
Cursor-scoped code inspection also compares source revision metadata and rejects
changed files instead of combining an old match with a new source body.

The useful pattern is **coverage-preserving compression**. A compact search
response should preserve enough information to distinguish three states:

1. the complete match set fits and was returned;
2. the complete set was captured but only a summary or page is visible now;
3. the capture itself exceeded a bound, so the result is incomplete.

A byte or token cap without this state distinction can reduce context while
making the agent epistemically worse: omitted evidence becomes invisible rather
than merely deferred. Stable snapshots also matter. Re-running a query for each
page can skip or duplicate evidence as a repository changes, so pagination
should bind to one captured result set; any later source inspection needs a
freshness check.

The repository's self-authored benchmark uses a synthetic 233-match fixture and
reports a first response shrinking from 9,728 to 321 bytes (96.7%) by replacing
100 detail lines with an exact five-file summary. Treat that as a reproducible
context-shape example, not an independent speed, token, or task-quality result.
At the inspected revision, GitHub showed successful CI and CodeQL runs for the
head commit. A local checkout could not reproduce the suite in this environment
because the installed Bun was 1.3.14 rather than the declared 1.4+ and `rg` was
absent; therefore the source and hosted CI support the implementation reading,
while independent runtime reproduction remains open.

## Reusable pattern

For a source-grounded research system, instrument evidence custody rather than
logging only tool calls and the final citation list:

1. Define required evidence as **slots**, not merely supporting documents.
2. Record the first observation in which each slot's document surfaced, its
   canonical body was opened, and its decisive fragment became model-visible.
3. Report no-evidence, average-missing, and incomplete-set rates at every stage.
4. Attribute a failed answer to the earliest unmet stage, but label this as a
   descriptive diagnosis—not a counterfactual proof of cause.
5. Keep downstream synthesis evaluation independent, so retrieval and reasoning
   failures cannot hide inside one score.
6. When queries repeatedly share a corpus, compare persistent organization with
   per-query workspace construction under matched agent and budget protocols.

This creates a practical distinction between **availability**, **navigation**,
**consumption**, and **reasoning**. It also gives research-agent operators an
answer to “why did the agent miss this?” that is finer than “the source was in
the index.”

## Boundary

This is a first-version arXiv report, not an independently reproduced result.
The paper says an anonymized supplementary package *will* provide code,
trajectories, derived data, and frozen configurations; those artifacts were not
linked as a public release in the inspected HTML. Its Locate metric is
benchmark-grounded by a frozen exact-fragment Qrel, so it is deterministic but
only measures the annotated evidence target and accepted canonical spans.

The online-cost comparison also excludes a universal amortized Atlas cost. The
authors report offline construction separately because its per-query cost
changes with query volume, reuse duration, and refresh frequency. A deployment
should therefore require a break-even calculation and freshness policy before
treating persistent navigation as cheaper. Finally, the paper itself notes that
million-file navigation still encounters a Surface-to-Open bottleneck; exposing
a promising region is not the same as consuming its evidence.
