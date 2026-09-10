<ai_context>
summary: "Skills Are Not Islands supports graph-aware skill review on one large SkillsMP snapshot, but its 1.43M units are GitHub-backed registry records and its transitive-security percentages are mostly conditional audit-signal reachability, not a matched npm/PyPI risk rate or proof that risk generally concentrates outside root skills."
triggers: ["Skills Are Not Islands", "2607.01136", "SkillDepAnalyzer", "SKILL-DEP", "agent skill supply chain", "SkillBOM", "transitive skill risk", "SkillsMP"]
last_updated: "2026-09-08"
source_basis: "arXiv:2607.01136v1 exact-ID API response and 319,960-byte source archive retrieved 2026-09-08; archive SHA-256 67cc2e28cebfb275af3ea38c38376cf8833f74f1ae5fd791d69e9f90407d7d57; main.tex SHA-256 bab8b6d0527789181de3cf5b4920594c65157555dc7bc7029808b451ef452c14; five-file source manifest SHA-256 11bdf83429d793a2becc8fd024efc5b341aa6645162a6bc809688a6d1fd3ed31; three bounded GitHub repository searches."
</ai_context>

# Agent skill supply chains need graph review, not a borrowed risk verdict

The library had promoted *Skills Are Not Islands* into two stronger claims:
that agent-skill dependency trees have the same risk properties as npm/PyPI,
and that risk generally concentrates in dependencies rather than root skills.
The primary paper supports neither conclusion at that breadth. It supplies a
large registry-snapshot analysis and useful conditional reachability results,
but it does not compare ecosystem-wide vulnerability rates or execute attacks.

## What the paper actually measures

The paper analyzes a 6 June 2026 SkillsMP snapshot. SkillsMP listed 1,640,440
records; the authors downloaded 1,434,046 GitHub-backed records, or about
87.4%. They deliberately keep 0.52% hash-identical records because location
and naming can affect dependency resolution. The headline should therefore be
read as registry records, not 1.43 million proven-unique skills or coverage of
private and enterprise skills.

SkillDepAnalyzer extracts skill, package, and service-use edges from front
matter, prose, and scripts. Its human reference has 500 stratified root
documents for direct edges and 100 selected depth-3-to-5 graphs for recursive
construction. Two researchers used an openly discussed guideline, resolved 11
disagreements by consensus, and report F1 0.95 for both direct and multi-layer
dependency extraction. This is meaningful instrument evidence, but the
stratified benchmark is not a random prevalence sample. The source archive
contains the paper, bibliography, class file, one pipeline figure, and arXiv
README; it does not contain SkillDepAnalyzer, SKILL-DEP, the SkillsMP snapshot,
generated SkillBOMs, prompts, or per-record outputs. Exact-title and exact-tool
GitHub repository searches returned zero attributable repositories.

On the analyzed snapshot, 36.60% of records have at least one direct skill,
package, or service-use dependency. The individual channel rates are 8.92%,
15.48%, and 22.25%, with overlap. Skill and package targets have normalized
Gini values 0.925 and 0.944; the paper compares these with npm dependency Gini
0.87. It also reports that 22.42% of dependency-bearing roots obtain packages
only through reused skills, and that 71.87% of npm and 73.33% of PyPI package
exposures in these generated graphs are inherited through skill reuse.

## Security result and contradictory evidence

The paper correctly labels most RQ3 matches as **security-relevant audit
signals rather than confirmed vulnerabilities**. Its percentages are
conditional on roots already reached by each selected signal family; they are
not rates over all 1,434,046 records and do not measure exploitation or harm.

- Regex signal families are dependency-only for 60–78% of affected roots.
- Selected package rows range from 0% to 98.01% dependency-only.
- Selected service rows range from 53.14% to 93.10% dependency-only.
- For the strongest label—publicly reported malicious skills—only 26 of 194
  reached roots, or 13.40%, are dependency-only. Most such reached roots are
  therefore not evidence for a dependency-only concentration.

The durable conclusion is narrower: root-only inspection can miss material
transitive signals, so an audit should resolve the graph and preserve versions,
sources, edge evidence, and uncertainty. The paper does not establish that
skills and npm/PyPI have equal risk, that all dependency edges execute, that a
matched graph audit prevents harm, or that graph-level risk exceeds root-level
risk across the ecosystem. Its npm comparison is structural concentration,
not a matched security comparison.

## Confidence and next evidence

Confidence is high in the paper identity, archive bytes, reported snapshot and
table values, and the distinction between conditional signal reachability and
vulnerability prevalence. Confidence is moderate in the generated dependency
structure because the authors validate the analyzer on two labeled samples.
Confidence is low in ecosystem-wide security prevalence, runtime exposure,
causal harm, npm/PyPI risk equivalence, and transfer beyond public GitHub-backed
SkillsMP records.

Decisive follow-up is release of the analyzer, frozen benchmark and snapshot,
generated SkillBOMs, and per-edge evidence, followed by an independent replay
that separates declared, installable, loaded, and executed dependencies and
uses version-specific confirmed vulnerabilities. Until then, use the paper to
justify graph visibility—not an ecosystem risk verdict.

Source: https://arxiv.org/abs/2607.01136v1
