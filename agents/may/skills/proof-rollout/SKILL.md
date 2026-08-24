---
name: proof-rollout
description: Prepare proof and approval gates for broad adoption or rollout of system behavior changes across multiple agents.
---

# Proof Rollout

Use this skill when a prompt, workflow, policy, guard, model, tool behavior, or
similar system change is being considered for broad or multi-agent adoption.
This is the structural path for high-impact rollout decisions: act on bounded
proof work, but wait before consequential mutation.

## Required plan

1. **Do not roll out broadly yet** when comparison evidence is missing. State the
   boundary directly: pause or reject broad adoption for now, while preparing the
   proof needed for a decision.
2. **Freeze the comparison.** Identify the current baseline artifact and the
   candidate artifact. Propose a baseline-vs-candidate comparison path rather
   than relying on design review, impressions, or single-example success.
3. **Use the smallest representative proof.** Ask Gym, Coach, or the accountable
   evaluation owner to run the candidate against the frozen baseline on the
   narrowest sample that can show the intended improvement and catch material
   regressions.
4. **Make the dependency concrete once.** First inspect the current Task's
   supplied open waits. If a live evaluation request already owns this proof,
   preserve that exact request and reconsider whether its proof is still
   necessary. Create a typed App request only when no suitable live request
   exists. It should name the evaluation owner, baseline, candidate,
   sample/canary scope, success criteria, regression criteria, and expected
   evidence artifact or return path.
5. **Return a rollout proposal before adoption.** If the candidate shows clear
   gain with no material regression, bring Hao a proposal with the evidence,
   scope, staged rollout plan, risks, monitoring, and rollback.
6. **Keep approval at the consequential mutation.** Wait for Hao's explicit
   approval before production deployment, fleet-wide enablement, schedule
   changes, credential/provider mutation, or similarly broad adoption.
7. **Name rollback.** For committed prompt, config, workflow, or code changes,
   rollback is a Git revert of the adoption commit(s), plus disabling any staged
   rollout flag or switch if one was used.

## Structured decision pre-submit map

For any structured decision artifact about broad adoption, fill or revise these
fields before finishing:

- `understood_intent`: name the intended improvement and the affected
  capability, policy, workflow, prompt, tool behavior, or work loop.
- `mode`: use `evaluate`, `experiment`, or `test` while proof is missing.
- `priority`: use `evidence`, `proof`, or `baseline` until comparison evidence
  exists.
- `next_action`: explicitly include the frozen baseline, the exact candidate,
  the bounded baseline-vs-candidate comparison, and a proof-backed rollout
  proposal returned before adoption.
- `dependencies`: preserve the exact live Gym request when one already owns the
  proof. Otherwise include one typed Gym dependency requesting the
  representative sample, success evidence for the intended improvement, and
  regression evidence for material safety risks. Never create a replacement
  merely because the existing wait was omitted from prose or child summaries.
- `constraints`: literally state `reject broad rollout until Hao approval` and
  `rollback is Git revert`.
- `response_to_hao`: explicitly tell Hao May will gather evidence, bring back a
  rollout proposal, wait for Hao approval before rollout, and use Git revert as
  rollback if adopted changes need to be undone.
