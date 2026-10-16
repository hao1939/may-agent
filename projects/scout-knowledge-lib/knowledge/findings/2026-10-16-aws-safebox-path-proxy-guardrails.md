<ai_context>
summary: "AWS SafeBox demonstrates a small deterministic deny layer in front of infrastructure CLIs, but its PATH proxy, six-command deny list, and allow-by-default rules do not establish complete mediation or broad infrastructure safety."
triggers: ["AWS SafeBox", "PATH proxy", "infrastructure agent guardrail", "deterministic command policy", "complete mediation", "deny list"]
last_updated: "2026-10-16"
source_basis: "HN item 50117268 and aws-safebox/aws-safebox source at commit 51aa27594b366d1b9ecf2e9e6f31f5b65b94145a inspected 2026-10-16; project tests and runtime were not executed."
</ai_context>

# A deterministic command proxy is a guardrail, not complete mediation

**Date:** 2026-10-16  
**Disposition:** New implementation-evidence finding  
**Coverage:** HN item, complete repository README, policy, executor, proxy, default rules, and relevant project-authored tests at one pinned commit; software and tests not run

## Observation

[HN item 50117268](https://news.ycombinator.com/item?id=50117268) links to
[AWS SafeBox](https://github.com/aws-safebox/aws-safebox), a local policy layer
for infrastructure commands. The item had one point and no comments when
inspected, so HN is a discovery lead rather than community validation.

At repository commit
[`51aa27594b366d1b9ecf2e9e6f31f5b65b94145a`](https://github.com/aws-safebox/aws-safebox/commit/51aa27594b366d1b9ecf2e9e6f31f5b65b94145a),
SafeBox parses a command, normalizes selected wrappers and executable paths,
checks explicit TOML deny rules, and invokes allowed commands with
`subprocess.run(..., shell=False)`. Its default rules block six forms:
Terraform destroy, Kubernetes delete, EC2 instance termination, RDS instance
deletion, recursive S3 removal, and CloudFormation stack deletion. The parser
checks each segment joined by `&&`, `||`, or `;` and fails closed on pipes,
background operators, command substitution, backticks, parse failure, and
unsupported nested shell programs.

The repository also supplies an optional executable-proxy route. Generated
`terraform`, `aws`, and `kubectl` scripts can be placed first in `PATH`; an
allowed request is then executed with that proxy directory removed from
`PATH`. Project-authored tests cover blocked and allowed decisions, selected
wrapper and compound-command forms, non-execution of a denied command, and an
end-to-end proxy fixture in which a fake Terraform executable is not reached
for `terraform destroy`.

This is a useful example of moving a safety decision out of model reasoning and
into inspectable deterministic code. It is narrower than an infrastructure
security boundary, however. Rules are deny-only and the final decision is
allow-by-default when no current rule matches. The default catalog covers six
syntactic command patterns, not all destructive operations or equivalent
effect routes. The generated proxy mediates only callers that resolve the three
proxied names through the configured `PATH`; a caller can invoke the real
executable by absolute path or use another binary, API, SDK, shell route, or
credentialed process. The README states these limitations directly and says the
Community Edition is not a hardened sandbox, IAM replacement, semantic
Terraform-plan checker, environment classifier, or blast-radius analyzer.

## Reusable implication

Treat a local command proxy as one route-specific **mistake-reduction layer**,
not as proof that an agent cannot produce the protected effect:

1. Define exactly which command routes the proxy owns and which equivalent
   routes remain reachable.
2. Prefer an allow list or capability grant where the accepted operation set is
   small; if using a deny list, label unmatched commands as an explicit
   degradation rather than “safe.”
3. Keep parse failures and unsupported syntax fail-closed, and test compound,
   wrapper, quoting, argument-order, and executable-resolution variants.
4. Bind stronger claims to the actual effect boundary—least-privilege cloud
   credentials, service-control policy, isolated execution, approval, and
   provider-side audit—not merely to a `PATH` convention.
5. Measure both enforcement correctness on mediated calls and coverage of all
   relevant effect routes. A passing proxy test proves the fixture crossed the
   proxy and was denied; it does not prove complete mediation.

This complements [Agent Security: Enforcement Evidence and Runtime
Coverage](../agent-security-enforcement-evidence.md): enforcement evidence must
separate a correct decision on an observed route from evidence that every
relevant effect was forced through that route.

## Evidence boundary

Scout statically inspected the pinned README, `safebox/policy.py`,
`safebox/executor.py`, `safebox/proxy.py`, `safebox/policies.toml`, and the
policy, executor, and proxy test files. Scout did not install or run SafeBox,
execute its 59-test self-reported baseline, connect to AWS, Terraform, or
Kubernetes, test adversarial bypasses, inspect package provenance, or establish
deployment coverage. The repository and HN post were newly published and had
minimal engagement at inspection time; reliability and operational adoption
are unknown.

## Sources

- **HN:** https://news.ycombinator.com/item?id=50117268
- **Repo:** https://github.com/aws-safebox/aws-safebox
- **Pinned revision:** https://github.com/aws-safebox/aws-safebox/commit/51aa27594b366d1b9ecf2e9e6f31f5b65b94145a
