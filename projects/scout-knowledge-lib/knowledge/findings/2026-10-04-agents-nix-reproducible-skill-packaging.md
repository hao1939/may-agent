<ai_context>
summary: "agents.nix packages a large cross-agent skill and plugin catalog as revision- and hash-pinned Nix derivations. Its reusable supply-chain pattern is to separate discovery, repository reconciliation, snapshot building, and consumption, while refusing suspicious mass deletion and keeping repository identity aliases; this improves reproducibility but does not establish that packaged skills are safe or behaviorally correct."
triggers: ["agents.nix", "agent skill packaging", "reproducible skills", "skill supply chain", "Nix agent skills", "skill registry admission"]
last_updated: "2026-10-04"
source_basis: "Static inspection of sudosubin/agents.nix at commit 09eb4743c84d97db078205924d2d8ecd6e9be49e, including README.md, flake.nix, nix/trees.nix, ci/README.md, and committed package metadata. No Nix build, workflow run, packaged skill audit, or scale claim was independently reproduced."
</ai_context>

# agents.nix turns skill discovery into pinned package snapshots

## Assessment

- **Question:** What repository-level mechanism can make third-party agent skills reproducible and reviewable rather than installing whatever a moving branch currently serves?
- **Observation date:** 2026-10-04
- **Repository:** [`sudosubin/agents.nix`](https://github.com/sudosubin/agents.nix)
- **Inspected revision:** [`09eb4743c84d97db078205924d2d8ecd6e9be49e`](https://github.com/sudosubin/agents.nix/commit/09eb4743c84d97db078205924d2d8ecd6e9be49e)
- **Coverage:** Pinned source archive; repository README, root flake and Nix tree builder, CI design documentation, workflow inventory, and a committed agent-skill package record. Scout did not run Nix builds or GitHub Actions.
- **Disposition:** New source-level finding. Existing Scout coverage describes portable skills, registry trust, loadability, and installation receipts, but did not cover this repository's reproducible package-snapshot mechanism.

## Source observation

GitHub Repository Search for `agentic in:name,description pushed:>=2026-10-04 stars:3..1000`, sorted by most recently updated, returned `incomplete_results: false` and surfaced `sudosubin/agents.nix`. The project describes a Nixpkgs overlay spanning agent skills, agent plugins, Claude Code/Codex/Copilot marketplaces and plugins, and Kiro powers.

At the inspected revision, the repository makes a useful separation between four operations:

1. **Discovery:** scheduled scanners ingest listings from `skills.sh` and `skillsdirectory.com`; the README says a newly listed agent-skill repository is admitted once it has ten stars.
2. **Identity reconciliation:** a separate job checks the repository's current GitHub identity. Renames move the package line while an old attribute path remains as a warning alias.
3. **Snapshot production:** update jobs choose a release or a commit touching a skill, download and hash the source, discover `SKILL.md` files, build changed packages, and propose repository-scoped updates. Committed JSON stores revision, version, content hash, and skill paths.
4. **Consumption:** Nix evaluation reads one JSON record per requested repository and uses the pinned revision and hash to produce packages exposed through stable attribute paths such as `agent-skills.github.<owner>.<repo>.<skill>`.

The repository README reports more than 145,000 skills from more than 21,000 repositories as of September 2026. Those are project-authored scale claims, not counts independently reconstructed in this scan.

## Reusable architectural signal

The notable contribution is not another skill directory. It is a **two-stage trust boundary between discovery and use**. A discovery site can nominate a repository, but consumers resolve a committed package snapshot rather than the site's latest listing or the repository's moving default branch. The snapshot binds package identity to immutable source coordinates and a content hash, while the committed metadata makes review and rollback practical.

The CI design also encodes conservative failure handling. It refuses a run that would delete more than 5% of the held set, because a token failure or outage can resemble mass disappearance. It retains empty snapshots for intentionally skipped or now-empty repositories, validates hand-written source rules against a schema, and uses a compare-and-swap base revision when proposing updates. These controls address disappearance, rename, and concurrent-update failure modes that a simple `git clone` installer does not.

This complements [the portable-skills ecosystem note](./2026-07-22-github-agent-skills-ecosystem.md): pinning and hashing answer **which bytes were installed**, while parser-backed load checks, malware analysis, capability declarations, and behavioral tests answer different questions. Packaging is evidence of provenance and reproducibility, not evidence that a skill is safe, useful, compatible with a host, or faithful to its description.

## Implications for agent platforms

A skill installer or registry can borrow the repository's control-plane shape without adopting Nix wholesale:

- resolve every accepted skill to an immutable repository revision and content digest;
- preserve repository rename history instead of silently changing identity;
- separate source discovery from snapshot admission and make each transition auditable;
- treat unexpectedly large removals as a failed observation, not an instruction to delete;
- build or parse each changed artifact before admitting its new snapshot; and
- expose an installation receipt that names source revision, digest, selected subpath, and host compatibility result.

The final two fields matter because this repository packages source bytes but does not, by itself, prove that a May-style runtime loaded the skill or that its instructions produced the intended behavior.

## Evidence limits

- Static source inspection verifies the repository's declared design and committed metadata shape, not successful operation of every scheduled workflow.
- Scout did not have Nix in the evidence loop and did not build any package, verify the reported catalog size, or sample packaged skills for semantic correctness.
- The ten-star threshold is a popularity gate, not a security review. A pinned malicious or vulnerable revision remains malicious or vulnerable.
- A source hash detects byte drift but does not declare required tools, permissions, prompt-injection risk, licensing compatibility, or runtime behavior.
- Search was complete for the returned GitHub API result set (`incomplete_results: false`), but only the first ten results were reviewed for candidate selection; this is not a claim that all matching repositories were assessed.

## Primary sources

Repo: https://github.com/sudosubin/agents.nix

Source: https://github.com/sudosubin/agents.nix/commit/09eb4743c84d97db078205924d2d8ecd6e9be49e

Source: https://github.com/sudosubin/agents.nix/blob/09eb4743c84d97db078205924d2d8ecd6e9be49e/README.md

Source: https://github.com/sudosubin/agents.nix/blob/09eb4743c84d97db078205924d2d8ecd6e9be49e/ci/README.md

Source: https://github.com/sudosubin/agents.nix/blob/09eb4743c84d97db078205924d2d8ecd6e9be49e/nix/trees.nix
