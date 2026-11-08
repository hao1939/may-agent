<ai_context>
summary: "Google's Elephant-Goldfish Model makes fresh-context review a required execution boundary, while its own harness records show that parent-turn isolation and host-instruction exclusion are separate claims that need separate evidence."
triggers: ["Elephant-Goldfish Model", "EGM", "fresh-context review", "reviewer isolation", "parent-turn isolation", "instruction-file leakage", "design review"]
last_updated: "2026-11-08"
source_basis: "HN discovery plus static inspection of google/elephant-goldfish-model documentation and skills at commit e9e1f06aa4e26e95cd4ed37210a0632202c429e9. Scout did not install or run the plugin, execute its tests, invoke reviewers, or independently inspect native child traces."
</ai_context>

# Fresh-context review is not the same as a clean-room review

**Date:** 2026-11-08  
**Disposition:** New source-grounded finding  
**HN item:** https://news.ycombinator.com/item?id=50410270  
**Repo:** https://github.com/google/elephant-goldfish-model  
**Inspected revision:** [`e9e1f06aa4e26e95cd4ed37210a0632202c429e9`](https://github.com/google/elephant-goldfish-model/commit/e9e1f06aa4e26e95cd4ed37210a0632202c429e9)

## Question

What must a multi-agent design-review workflow prove before calling a reviewer independent from the agent that developed the proposal?

## Source observation

Google's Elephant-Goldfish Model (EGM) separates a context-rich authoring role, the **Elephant**, from **Goldfish** reviewers that receive the design and selected source material without the earlier conversation. The review skill refuses to imitate this separation inside the authoring context: if the host cannot create a fresh subagent context, it stops rather than treating same-context critique as a Goldfish review. Its five-stage design-review flow also keeps comprehension, design criticism, simplicity, and implementation readiness as separate reviewer passes, with a human retaining trade-off and approval authority.

The more reusable signal is in EGM's verification boundary. Its harness guide explicitly distinguishes:

1. **Parent-turn isolation** — the reviewer does not inherit the author's conversation turns.
2. **Host-instruction exclusion** — project or user instruction files are not injected into the reviewer anyway.
3. **Persona and source reads** — the reviewer actually receives the intended rubric and review target.
4. **Workflow execution** — the required reviewers run in the required stage order and produce the expected artifacts.
5. **Review validity** — the resulting findings are substantively sound.

EGM reports live fixture evidence for several harnesses, but does not collapse those five claims. Its Codex and Antigravity records say parent-turn isolation passed while instruction-file exclusion was not tested; the harness guide also cites issue #237 reporting project and user instruction-file injection despite fresh-turn settings. Claude's opt-in probe checks a narrower instruction-isolation path. Cloud-hosted surfaces retain open trace-evidence gaps. The testing playbook further warns that a persona read request is not proof of a successful read and that artifact existence is not proof that the intended native reviewers or sequence ran.

## Evidence boundary

The repository is project-authored evidence. Scout inspected its pinned README, architecture, skills, harness guide, and testing playbook, but did not install EGM, run its tests, inspect native child transcripts, or reproduce issue #237. The recorded fixture runs establish only the surfaces and versions the project reports. They do not prove that every supported host preserves isolation after upgrades, that a fresh reviewer is unbiased, or that multiple reviewer personas produce better designs.

Fresh context is also not a complete clean room. A child can omit parent turns while still inheriting repository instructions, user-level policy, tool descriptions, environment state, or an author-selected reading list. Conversely, removing all shared context can make review uninformed rather than independent. The useful contract is therefore not “the reviewer started fresh,” but a versioned declaration of **what was withheld, what was deliberately supplied, what the host injected, and what execution evidence was observed**.

**Operational implication:** record review independence as a layered receipt. At minimum, preserve the parent/child context setting, host and version, inherited instruction sources, reviewer persona and target reads, reviewer identity, stage ordering, and returned artifact. Keep the substantive acceptance verdict separate: isolation reduces shared-context anchoring, but does not validate the review's judgment.

## Material inspected

- [Pinned README](https://github.com/google/elephant-goldfish-model/blob/e9e1f06aa4e26e95cd4ed37210a0632202c429e9/README.md)
- [Architecture and lifecycle](https://github.com/google/elephant-goldfish-model/blob/e9e1f06aa4e26e95cd4ed37210a0632202c429e9/docs/designs/architecture.md)
- [Harness support and isolation limits](https://github.com/google/elephant-goldfish-model/blob/e9e1f06aa4e26e95cd4ed37210a0632202c429e9/docs/harnesses.md)
- [Testing playbook and harness records](https://github.com/google/elephant-goldfish-model/blob/e9e1f06aa4e26e95cd4ed37210a0632202c429e9/TESTING.md)
- [Design-review skill](https://github.com/google/elephant-goldfish-model/blob/e9e1f06aa4e26e95cd4ed37210a0632202c429e9/skills/egm-review/SKILL.md)
- [Brainstorm skill](https://github.com/google/elephant-goldfish-model/blob/e9e1f06aa4e26e95cd4ed37210a0632202c429e9/skills/egm-brainstorm/SKILL.md)

Scout inspected static project material only. It did not execute EGM, its offline or live tests, a design review, any supported host, or an instruction-leak probe.
