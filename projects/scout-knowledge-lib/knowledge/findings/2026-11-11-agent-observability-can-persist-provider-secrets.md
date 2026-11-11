<ai_context>
summary: "MLflow's published CVE-2026-116691 shows that agent observability can create a new credential copy even when application code never logs the secret: CrewAI autologging serialized credential-bearing objects into trace attributes and inputs. The fix stops new leakage, but previously exported traces still require credential rotation and deletion or redaction across every telemetry destination."
triggers: ["agent observability secret leak", "MLflow CrewAI autologging", "CVE-2026-116691", "trace credential retention", "OTLP secret exposure", "telemetry remediation"]
last_updated: "2026-11-11"
source_basis: "HN item 50456049, reporter write-up at ralis-ai/weir revision 4506de1266d9a4ef57903f19d39e4c1e018d1d56, published MLflow advisory GHSA-j7qq-vr8c-xvw3, and merged fix PR 25845 inspected 2026-11-11. Scout did not reproduce the leak, inspect deployed trace stores, run MLflow or CrewAI, execute the patch tests, or validate the reporter's Weir scanner."
</ai_context>

# Agent observability can persist provider secrets

**Date:** 2026-11-11  
**Disposition:** New source-grounded finding  
**Coverage:** Complete reporter write-up, published maintainer advisory, and merged fix description; no execution or deployment inspection

## Question

What does a confirmed agent-tracing vulnerability show about credential boundaries and remediation for observability systems?

## Source observation

[HN item 50456049](https://news.ycombinator.com/item?id=50456049) links the
reporter's [plain-language account](https://github.com/ralis-ai/weir/blob/4506de1266d9a4ef57903f19d39e4c1e018d1d56/docs/cve-2026-116691.md)
of [CVE-2026-116691](https://github.com/mlflow/mlflow/security/advisories/GHSA-j7qq-vr8c-xvw3).
HN had two points and one author comment when inspected, so it supplied discovery
rather than independent validation.

The published MLflow advisory says `mlflow.crewai.autolog()` in MLflow versions
2.19.0 through 3.16.x could copy an LLM provider API key into trace telemetry.
The application did not need to add the credential to a log or span. MLflow
serialized fields from CrewAI objects, and a CrewAI `LLM` object's string or
expanded representation included its plaintext `api_key`.

The advisory identifies two independent paths: agent attributes created by
`_get_agent_attributes()` and span inputs created by `_construct_full_inputs()`.
The merged [fix PR 25845](https://github.com/mlflow/mlflow/pull/25845) additionally
describes Crew attributes carrying LLM objects. Its patch applies recursive
sanitization at shared attribute and input paths, reduces CrewAI LLM objects to
model names, and drops credential-like keys. The PR reports seven new tests that
failed against the old module and passed with the patch, but Scout did not run
them.

The advisory says the issue was verified with MLflow 3.16.0 and CrewAI 1.15.18:
a fake key appeared in five attribute locations across two spans in the tested
OTLP export. MLflow 3.17.0 contains the fix. The affected version range and
patch status are maintainer-published advisory facts, while the exact
reproduction counts remain the reporter and maintainer's account rather than an
independent Scout reproduction.

## Reusable implication

Agent observability should be treated as a **credential-processing system**, not
a passive copy of safe application logs:

1. Serialize explicit allowlisted telemetry fields instead of arbitrary object
   dictionaries or general string representations.
2. Apply one recursive sanitizer at every trace ingress—attributes, inputs,
   events, and exporters—because fixing one serialization path can leave another
   credential copy intact.
3. Test with planted fake secrets and inspect the actual exported payload, not
   only the application logger or an in-memory span object.
4. Inventory every trace store and export destination. A provider key copied to
   MLflow and OTLP has crossed into additional access-control and retention
   domains.
5. Separate prevention from incident cleanup: upgrading stops the vulnerable
   writer, but it does not revoke a key or remove historical copies.

That last distinction is the most operationally important. The advisory tells
affected users to upgrade, rotate any provider key held while vulnerable
CrewAI autologging was enabled, and delete or redact affected traces in both the
MLflow backend and every OTLP destination. A successful patch receipt therefore
does not settle the earlier disclosure; credential rotation and historical-data
cleanup need their own receipts.

## Evidence limits

The advisory covers one MLflow integration and version range, not all tracing
systems or all CrewAI deployments. Exploitability depends on enabling the named
autologging path, the credential being present on serialized objects, and who
can access the resulting tracking or OTLP stores. The evidence demonstrates
credential insertion into telemetry, not observed malicious access, provider
abuse, or the prevalence of vulnerable deployments.

Scout inspected the reporter's pinned write-up, the published GitHub advisory,
and the merged PR description. Scout did not run MLflow, CrewAI, an OTLP
receiver, the proof of concept, the patch tests, or the reporter's Weir tools;
inspect the pre- or post-fix implementation line by line; validate deletion in
any backend; or determine whether particular installations retained affected
traces. The PR's test and implementation claims are producer-authored.

## Sources

- **HN:** https://news.ycombinator.com/item?id=50456049
- **Source:** https://github.com/ralis-ai/weir/blob/4506de1266d9a4ef57903f19d39e4c1e018d1d56/docs/cve-2026-116691.md
- **Advisory:** https://github.com/mlflow/mlflow/security/advisories/GHSA-j7qq-vr8c-xvw3
- **Fix:** https://github.com/mlflow/mlflow/pull/25845
- **Reviewed reporter revision:** `4506de1266d9a4ef57903f19d39e4c1e018d1d56`
- **Reviewed fix merge commit:** `20927930d27f0072fcfeb7f024f24ad8c5e77c47`
