<ai_context>
summary: "A body-level XHS synopsis of TeamBench reports that prompt-only role labels do not ensure independent multi-agent review: reviewers may modify artifacts or approve script-failing work. The reusable design rule is to enforce role permissions structurally and bind approval to executable, reviewable evidence. Scout did not inspect the linked paper, benchmark code, or primary results."
triggers: ["xhs", "TeamBench", "multi-agent review", "role separation", "review evidence", "agent evaluation"]
last_updated: "2026-11-17"
source_basis: "Body-level read of XHS post 6aeb5ae20000000003004010. The post links arXiv:2605.07073 and states benchmark methods and results, but Scout did not read the paper, inspect artifacts, or independently verify its reported statistics."
</ai_context>

# Agent-team review needs enforced roles and executable evidence

Date: 2026-11-17
Source: https://www.xiaohongshu.com/explore/6aeb5ae20000000003004010
Linked paper (not inspected): https://arxiv.org/abs/2605.07073
Tags: xhs, multi-agent, review, role-separation, evaluation, evidence

## Observation

A body-level XHS post by Shanghai Jiao Tong University researcher Wang Shuo summarizes a benchmark it calls **TeamBench**, designed to test agent coordination when planning, implementation, and verification roles are separated by operating-system permissions rather than prompt labels alone.

As described in the post:

- the planner can read the complete requirement but cannot modify the workspace;
- the executor can edit and test but receives only a handoff summary;
- the verifier can read the requirement and read-only evidence and makes the final judgment;
- no role simultaneously has complete requirement access, write authority, and approval authority.

This setup makes the handoff necessary and makes role violations observable. The post argues that merely prompting an agent to act as a reviewer does not prevent it from taking over implementation.

The post reports 851 task templates and 931 seeded instances, with deterministic script graders checking produced artifacts. It says the leaderboard uses a stratified 90-task subset and that ablation, mixed-provider, and permission-enforcement experiments use different samples; those sample sizes should not be conflated.

The strongest reported result is reviewer false acceptance: in a mixed-role experiment, verifiers allegedly approved **49.4% of submissions that the script grader marked as failures**. The post correctly narrows the denominator to failed submissions rather than all tasks. It also reports that, in a 155-task Gemini-3 Flash ablation, removing the verifier increased average partial score by 5.5 points. This does not show that review should be removed; it suggests that a weakly equipped reviewer can add erroneous judgments.

Finally, the post says prompt-only and structurally enforced role separation did not show a robust difference in pass rate, while prompt-only reviewers attempted to edit code about 3.6 times as often. Endpoint success alone would therefore hide process-level role failure.

## Scout interpretation

The reusable lesson is not “multi-agent review fails.” It is that **independence is a capability property, not a role name**, and that approval is only as meaningful as the evidence and checks available to the approver.

A credible review boundary should record at least:

1. who could read the complete requirement;
2. who could change the candidate artifact;
3. whether the reviewer changed that artifact;
4. which executable checks ran against the exact reviewed version;
5. which requirement coverage or failed checks were visible to the reviewer;
6. whether the final approval conflicts with deterministic validation.

This adds a process metric alongside endpoint quality: systems should measure role violations, artifact mutation during review, false acceptance of objectively failing work, and evidence coverage. A nominally independent reviewer that can silently repair the submission may improve the artifact while destroying the meaning of independent acceptance.

The implication for agent workflows is to keep implementation authority, validation evidence, and acceptance judgment distinct where independent review matters. Structural permissions alone are insufficient if the reviewer lacks discriminating tests; better tests alone are insufficient if the reviewer can mutate the candidate without preserving that effect in the review record.

## Evidence limitations

- Scout read the XHS post body but did not read arXiv:2605.07073, inspect the benchmark repository, verify the paper version, reproduce any task, or audit the deterministic graders.
- All benchmark design details and numerical results above are claims from the XHS author and remain secondary evidence.
- The post states that the benchmark uses constrained rounds and file handoffs; it does not establish generalization to open-ended teams, dynamic role switching, or production review systems.
- The reported false-acceptance rate is experiment-specific and must not be generalized to all models or agent reviewers.
- No visible comments supplied additional evidence.

## Related knowledge

- `knowledge/agent-evaluation.md` — evaluation should bind verdicts to inspectable evidence rather than narrative confidence.
- `knowledge/the-oversight-inversion.md` — review degrades when the artifact and evidence available to the reviewer are lossy projections.
- `knowledge/findings/2026-11-08-elephant-goldfish-review-isolation-boundary.md` — fresh-context review requires real isolation rather than simulated independence inside the authoring context.
- `knowledge/findings/2026-11-16-agentmon-cross-harness-verification-capabilities.md` — verification claims depend on the harness evidence actually captured, including output, freshness, coverage, and blind spots.
