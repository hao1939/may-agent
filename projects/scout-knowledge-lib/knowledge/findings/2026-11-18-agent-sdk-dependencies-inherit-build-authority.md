<ai_context>
summary: "Aikido reports that two compromised patch releases of Microsoft's Agent Framework PyPI meta-package used Python startup hooks to steal CI and cloud credentials without requiring an application import, showing that an agent SDK dependency inherits the ambient authority of every developer, build, and deployment environment that resolves it."
triggers: ["agent SDK supply chain", "agent-framework PyPI compromise", "Python .pth startup hook", "CI credential theft", "dependency provenance", "build authority"]
last_updated: "2026-11-18"
source_basis: "Static inspection of HN item 50539115, Aikido Security's producer-authored incident analysis as updated 2026-11-18, and the current PyPI JSON record for agent-framework. The malicious 1.26.1 and 1.26.2 artifacts had been removed before Scout's review, so Scout could not independently download, hash, execute, or reverse-engineer them; the compromise mechanism, timestamps, payload behavior, and incident scope remain Aikido-reported."
</ai_context>

# Agent SDK dependencies inherit build authority

**Date:** 2026-11-18  
**Disposition:** new knowledge  
**Coverage:** HN item, incident article, and current package-index metadata inspected statically

**Source:** https://news.ycombinator.com/item?id=50539115  
**Incident analysis:** https://www.aikido.dev/blog/two-malicious-agent-framework-releases-hit-pypi-in-33-minutes  
**Package metadata:** https://pypi.org/pypi/agent-framework/json

## Observation

Aikido Security reports that `agent-framework` versions 1.26.1 and 1.26.2, patch releases of Microsoft Agent Framework's PyPI meta-package, contained a credential stealer. The releases appeared 33 minutes apart on 2026-11-17 and were removed by roughly 21:20 UTC. At inspection time, PyPI's current JSON record again identified 1.26.0 as latest, omitted 1.26.1 and 1.26.2, and listed both a wheel and source distribution for 1.26.0.

The reported activation path matters more than an ordinary malicious import. Version 1.26.1 added a `.pth` file under `site-packages`; Python's `site` initialization executes import lines in such files whenever the interpreter starts. Aikido says this caused the payload to run when Python, `pip`, or `pytest` started even if application code never imported Agent Framework. The second release reportedly changed filenames and added GitHub Actions OIDC-token collection while retaining the same broad collection and exfiltration behavior.

Aikido's wheel comparison also describes provenance anomalies that a semantic-version bump alone would not reveal: the legitimate 1.26.0 release had a wheel and source distribution, while 1.26.1 reportedly had only a wheel; added files had inconsistent timestamps and permissions; and the package's legitimate dependency pin remained unchanged. The article says the repacked wheel was uploaded with valid publishing credentials, but how those credentials were obtained was unknown at publication.

The alleged payload targeted the authority surrounding an agent SDK rather than only the SDK itself. It collected environment variables and credential files, inspected other process environments on Linux, requested Azure managed-identity tokens, and in 1.26.2 attempted to request GitHub Actions OIDC tokens. CI runners, cloud VMs, developer machines, and container builds are therefore material exposure boundaries because they often combine fresh dependency resolution with cloud, registry, repository, and model-provider credentials.

## Interpretation

An agent framework dependency should be treated as inheriting the **ambient authority of its installation and execution environment**. The package does not need an explicit tool call or application import if a language-runtime startup mechanism can execute it first. Agent-runtime security reviews that begin at prompt handling or tool invocation therefore start too late for this class of compromise.

Useful controls span package admission, execution authority, and incident response:

1. **Resolve immutable artifacts, not loose patch ranges.** Lock exact versions and hashes, and rebuild only after the selected artifacts are admitted. A range such as `agent-framework>=1.26` can silently select a newly published patch during a clean CI build.
2. **Check release shape and provenance.** Compare expected publishers, attestations, wheel and source-distribution presence, build timestamps, file permissions, and file inventory against a known-good release. A valid package name and publishing credential are not sufficient provenance.
3. **Inspect runtime startup hooks.** Admission checks should flag new or changed `.pth` files and equivalent interpreter or shell startup mechanisms, especially when they import code or launch detached work.
4. **Reduce build-time authority.** Dependency installation and untrusted build steps should not automatically receive deployment identities, repository write tokens, package-publishing credentials, model-provider keys, or broad cloud metadata access.
5. **Treat successive releases as one incident window.** Hash- or filename-only blocking can be obsolete within minutes when publishing access remains compromised. Policy should quarantine the package or publisher boundary until ownership and provenance are re-established.
6. **Rotate reachable authority after exposure.** Removing the package prevents later execution but cannot revoke credentials or identity tokens already collected. Response must cover CI caches, built images, developer environments, service principals, federated identities, and every secret reachable during the affected build or interpreter run.

The general lesson is not that agent SDKs require a unique package manager. It is that they are unusually valuable supply-chain targets because their normal environments aggregate cloud, code-hosting, model, and deployment authority. Package provenance and least-privilege builds are part of the agent security boundary.

## Limitations

Scout could not retrieve the removed 1.26.1 or 1.26.2 distributions and did not execute or independently reverse-engineer the reported payload. The incident analysis is authored by a security vendor that also promotes its scanning products. PyPI's current metadata confirms the present 1.26.0 state and absence of the two reported releases from the current record, but it does not independently prove their prior bytes, upload times, download count, exfiltration, compromise path, or affected-user count. Aikido explicitly says the publishing-credential compromise mechanism was unknown. The evidence supports defensive design and response lessons, not an independent forensic attribution or measured incident impact.

## Inspected source

- [HN item 50539115](https://news.ycombinator.com/item?id=50539115)
- [Aikido Security incident analysis](https://www.aikido.dev/blog/two-malicious-agent-framework-releases-hit-pypi-in-33-minutes)
- [Current PyPI metadata for agent-framework](https://pypi.org/pypi/agent-framework/json)
