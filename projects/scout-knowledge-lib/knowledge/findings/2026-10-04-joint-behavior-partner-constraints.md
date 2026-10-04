<ai_context>
summary: "Watch, Infer, Coordinate shows in simulation that a constrained partner's capability can be easier to infer from the whole team's behavior than from the constrained agent alone, because the other agent compensates. Its best results depend on known goals, dynamics, a behavioral model, full observations, and a finite candidate-constraint set, so joint-trace inference should remain a revisable hypothesis rather than durable authority."
triggers: ["Watch Infer Coordinate", "partner capability inference", "multi-agent coordination", "joint behavior", "compensatory behavior", "robot constraints"]
last_updated: "2026-10-04"
source_basis: "Complete arXiv HTML paper v1 and current cs.AI feed metadata for arXiv:2610.02170. Scout did not inspect or run the promised benchmark code, reproduce the simulations, or test physical robots."
</ai_context>

# Infer a Partner's Constraints from the Team, Not Only the Partner

**Date:** 2026-10-04  
**Source:** https://arxiv.org/abs/2610.02170v1  
**Primary text:** https://arxiv.org/html/2610.02170v1  
**Project:** https://watch-infer-coordinate.github.io/  
**Version reviewed:** arXiv v1, submitted 2026-10-01  
**Coverage:** complete HTML paper plus current arXiv feed metadata; project artifacts were not inspected

## Signal

*Watch, Infer, Coordinate: Inferring Robot Partner Constraints for Zero-Shot Coordination* studies a subtle attribution problem in physically coupled teams. A robot with a joint, velocity, or motion-direction restriction may not look obviously impaired because its teammate compensates. The constrained robot's trajectory therefore underdetermines its capability, while the **joint** trajectory can expose how effort or motion was redistributed.

The paper formalizes a two-stage setting. A helper first observes a constrained robot coordinate with a demonstrator on obstacle-free carrying tasks. It knows the goals and observes both agents' states and actions, but not the constraint. The helper then replaces the demonstrator and must coordinate with the same constrained partner on a new obstacle-bearing task. The persistent object is the partner's low-level capability, not the demonstrated policy.

This yields a useful general lesson for multi-agent diagnosis: behavior is relational. A worker's missing action does not by itself reveal inability, preference, or delegation when another worker may absorb the work. Capability inference should inspect the other participants' compensating actions and the shared outcome, not only the focal participant's trace.

## Method and evidence

The benchmark has three simulated joint-carrying settings of increasing complexity: a 2D rod, two fixed-base UR5 arms, and two mobile UR5 systems. Candidate constraints include feasible force directions, arm-joint position or velocity restrictions, and base-motion restrictions. Demonstrations use fixed obstacle-free tasks; test tasks add obstacles and require motions that may not appear in the demonstrations.

The authors model both robots as boundedly rational agents optimizing a known shared objective. For each candidate capability, their scorer asks how likely **both** observed actions are under that model. Learned models approximate the score as the state and action spaces grow. At test time, a cross-entropy-method model-predictive controller plans for the helper while accounting for its belief over the partner's capability.

The partner-only ablation is important. With one observed demonstration, normalized constraint error is lower when the scorer uses both agents rather than only the constrained partner in all three settings: 0.058 versus 0.104 for the 2D rod, 0.031 versus 0.068 for fixed-base dual-UR5, and 0.190 versus 0.201 for mobile dual-UR5. With more demonstrations, the full method reaches 0.002, 0.019, and 0.009 error respectively at the largest reported observation count, though the number of demonstrations differs by setting and the mobile result has no reported variance at that point.

On new obstacle-bearing tasks, the full method plus CEM reports success rates of 92.6%, 85.2%, and 63.0% across the three settings. The oracle with the true constraints reports 96.3%, 88.9%, and 70.4%; capability-blind planning reports 51.9%, 0%, and 25.9%. Behavioral cloning fails all three new tasks despite nonzero success on obstacle-free controls. These author-reported simulation results support transferring an inferred persistent constraint rather than replaying observed coordination.

## Implication for agent runtimes

The paper's mechanism transfers cautiously to software-agent teams. When one worker silently compensates for another—redoing malformed output, narrowing requests, supplying missing context, or absorbing retries—the focal worker's own trace can make its capability look healthier than it is. A diagnostic record should retain:

- the focal agent's proposed and completed actions;
- peer interventions, corrections, retries, and work reassignment;
- shared-state transitions and outcomes; and
- the task and capability assumptions under which the interaction occurred.

That record can support a **candidate explanation** such as “this worker may not handle this interface without peer repair.” It should not automatically become a permanent capability label. Unlike the paper's benchmark, a production runtime rarely knows the true goal, dynamics, behavioral policy, or complete candidate-constraint set. Peer compensation may reflect role design, authority, cost, or preference rather than incapacity.

A safe adaptation would therefore rank explicit, revisable capability hypotheses from joint traces, test them on a separate low-risk task, and expire or update them when the worker, tool, policy, or environment changes. Joint behavior supplies diagnostic evidence; it does not grant authority to restrict or reroute a participant indefinitely.

## Limits

All experiments are simulations, not physical-robot trials. The paper intentionally assumes known goals and dynamics, full observation, a known behavioral model, and a finite candidate set. Those assumptions make candidate likelihoods computable but remove important ambiguities found in open environments.

The same authors define the benchmark, behavioral assumptions, learned scorer, and evaluation. Results are means and standard errors over three random seeds, with a small number of evaluation constraints in each setting. Directly comparable baselines are limited, and the paper says code and evaluation scripts will be released; Scout did not inspect a repository or verify that release. The finding therefore supports a diagnostic pattern—look for compensation in the whole team—not a general claim that latent capability can be identified from arbitrary multi-agent logs.
