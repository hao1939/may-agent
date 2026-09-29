<ai_context>
summary: "A current HN launch shows a domain skill bundle placing review gates immediately before paid media generation, with reusable intermediate artifacts and dry-run previews. Static inspection also shows why these are workflow checkpoints rather than authorization controls: the prose permits pre-waiving prompts and does not bind approval to actor, artifact digest, budget, or one-shot execution."
triggers: ["SuperCMO", "agent skills", "cost-shaped approval", "media generation", "human approval", "dry run", "storyboard", "49888905"]
last_updated: "2026-09-29"
source_basis: "HN item 49888905 plus static inspection of SupercmoHQ/superCMO-skills README, repository tree, and selected skill files at commit a6dd060ed46132e1944b1dd38981cb9ffcc42fc8. Repository-authored tests and live generation were not run."
</ai_context>

# Put agent review at the cost and irreversibility boundary

**Observed:** 2026-09-29  
**Disposition:** New source-grounded finding  
**Coverage:** Current HN story metadata and submission text; linked repository metadata, tree, README, and selected `generating-ugc-videos`, `planning-campaigns`, and `generating-videos` skill files. Static inspection only.

## Sources

- **Source:** [HN item 49888905](https://news.ycombinator.com/item?id=49888905)
- **Repo:** [SupercmoHQ/superCMO-skills](https://github.com/SupercmoHQ/superCMO-skills)
- **Pinned revision:** [`a6dd060ed46132e1944b1dd38981cb9ffcc42fc8`](https://github.com/SupercmoHQ/superCMO-skills/commit/a6dd060ed46132e1944b1dd38981cb9ffcc42fc8)
- **Inspected skill:** [`generating-ugc-videos/SKILL.md`](https://github.com/SupercmoHQ/superCMO-skills/blob/a6dd060ed46132e1944b1dd38981cb9ffcc42fc8/skills/generating-ugc-videos/SKILL.md)
- **Inspected skill:** [`planning-campaigns/SKILL.md`](https://github.com/SupercmoHQ/superCMO-skills/blob/a6dd060ed46132e1944b1dd38981cb9ffcc42fc8/skills/planning-campaigns/SKILL.md)
- **Inspected skill:** [`generating-videos/SKILL.md`](https://github.com/SupercmoHQ/superCMO-skills/blob/a6dd060ed46132e1944b1dd38981cb9ffcc42fc8/skills/generating-videos/SKILL.md)

## Source observation

The HN submission presents SuperCMO as an open-source bundle of agent skills and a local MCP server for producing marketing campaigns across Claude Code, Cursor, Codex, and other hosts. The repository tree contains separate skills for product and competitor analysis, campaign planning, script and prompt writing, actor and storyboard generation, media generation, and post-production. This is more than a single prompt wrapper: it packages a domain workflow as composable procedures over common tools.

Its strongest reusable pattern is **cost-shaped review**. In the inspected UGC workflow, the agent first writes a concrete concept and script, then must show the creator, each clip's on-screen action, and exact spoken lines. The instruction explicitly says not to cast an actor, build a storyboard, or generate a clip until the user approves because every later step costs money. After approval, the agent creates storyboards and pauses again so the user can inspect the product and revise individual panels before video rendering. The planning skill similarly keeps unapproved concepts queued and tells downstream producer skills to retain their own approval gates rather than approving on the user's behalf.

The README describes a complementary `dry_run` mode for generation tools that previews the request and cost without making an API call. The repository also separates relatively cheap, editable artifacts—brief, script, concept, reference image, storyboard—from expensive rendering. Together these choices make review actionable: the user sees a compact artifact at the last point where correction is cheap, rather than receiving a generic confirmation before planning or a finished asset after the spend.

## Design implication

Agent workflows should place checkpoints around **changes in consequence**, not at arbitrary step counts:

1. assemble a reviewable intermediate artifact;
2. expose its consequential fields and estimated cost;
3. allow narrow revision without replaying unaffected work;
4. bind approval to that exact artifact and budget; and
5. only then issue the expensive or irreversible call.

For multimodal production, a useful sequence is therefore `brief → concept/script approval → storyboard approval → render`, not one approval at session start. The same pattern applies to deployments, purchases, database writes, and bulk outbound actions: stage a cheap representation first, then authorize the specific effect.

## Control boundary

SuperCMO's inspected gates are natural-language workflow policy, not a hardened authorization mechanism. The UGC skill says to continue after a one-line notice when the user has already said they do not want to be asked. The inspected instructions do not define an authenticated approver, canonical artifact digest, budget ceiling, expiry, or one-shot grant. Nor did this scan establish that every host injects the skill reliably or that the MCP server independently blocks an unapproved render.

The implementation is therefore evidence for **where and what to review**, not proof that review is enforced. A production control plane should preserve the workflow's useful intermediate artifacts while moving the final render admission into a trusted service that binds actor, artifact revision, provider request, maximum spend, and terminal outcome. This complements [Approval evidence needs trusted actor attribution](./2026-09-27-agent-approval-attribution-boundary.md): good checkpoint placement and trustworthy approval evidence solve different problems.

## Limits

- The HN item had two points and no comments when retrieved, so it provides discovery and maintainer description, not community validation or adoption evidence.
- Repository metadata showed 54 stars and eight forks, but popularity was not used as evidence of quality or effectiveness.
- Scout did not install the package, run its tests, invoke paid generation, verify cost estimates, or compare output quality and continuity claims.
- The repository's claims about finished-asset quality, cross-shot consistency, local key handling, and model selection remain maintainer claims unless directly supported by the inspected static workflow.
- The pinned commit predates the HN submission; the repository had no newer commit on its default branch when checked, but remote services and managed-key behavior can change independently.
