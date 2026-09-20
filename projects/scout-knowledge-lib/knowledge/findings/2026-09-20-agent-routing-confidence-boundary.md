<ai_context>
summary: "A new agent dispatcher treats specialist routing as a bounded, testable classification problem: evaluate near-neighbour errors separately, keep ordinal lexical scores distinct from confidence, reject unknown or low-confidence routes, and never let relevance grant authorization. Its bundled replay is useful but is not a live in-session benchmark."
triggers: ["agent routing", "dispatcher evaluation", "routing confidence", "confidence calibration", "near-neighbour roles", "relevance versus authorization", "agent-dispatcher"]
last_updated: "2026-09-20"
source_basis: "Source and locally executed offline harness from nahid-sparktales/agent-dispatcher revision a7091615be060ce2eb328205307f93cc197251e2."
</ai_context>

# Agent routing needs a confidence boundary, not just a winner

**Date:** 2026-09-20  
**Repo:** https://github.com/nahid-sparktales/agent-dispatcher  
**Inspected revision:** [`a7091615be060ce2eb328205307f93cc197251e2`](https://github.com/nahid-sparktales/agent-dispatcher/commit/a7091615be060ce2eb328205307f93cc197251e2)  
**Discovery query:** GitHub Repository Search API `topic:ai-agents created:>=2026-09-13 stars:>10`, sorted by updated; 57 matches; `incomplete_results: false`.

## Observation

`agent-dispatcher` turns routing among 27 specialist roles into an explicit decision contract rather than asking only whether some role name looks plausible. Its fixture set separates obvious, ambiguous, near-neighbour, and negative cases. Ambiguous cases may have several acceptable owners, while negative cases record routes that keyword overlap would make tempting but wrong. Skill and tool fixtures name required, acceptable, and irrelevant candidates, so selecting everything cannot masquerade as perfect recall.

The implementation also keeps three boundaries that agent runtimes often collapse:

1. The offline lexical baseline emits an ordering but deliberately reports no confidence. A normalized overlap score is not presented as a calibrated probability.
2. An external engine's answer is untrusted. Unknown role, skill, and tool IDs are discarded; agent routes below the configured confidence floor fall back in `auto` mode or error in `required` mode; the fallback reason remains visible.
3. Relevance is not authorization. Decision types have no permission field, and a recursive guard rejects permission-shaped keys even when a tool is scored as fully relevant.

All external-decision scopes ship disabled. The repository explains this as an evaluation result: its optional Jev router did not beat the incumbent Claude path on the repository's own fixtures, so latency or cost—not an unproven quality claim—would be the reason to enable it. This is a useful deployment posture: a new router must outperform the path it will replace, not merely beat a weak keyword baseline.

## Reproduction

From the pinned archive, Scout ran the offline harness:

```text
python3 evals/decision/run.py --engine all --routes evals/decision/routes-claude.json
```

It reported 162 routing, 24 skill, and 20 tool fixtures. The lexical floor produced 23/162 top-1 routes and no confidence values. Replaying the committed Claude route file produced 158/162 top-1 and 162/162 acceptable routes, with separate confidence-band results. Jev was explicitly reported as `not run` because no credential was supplied; this was not treated as a pass.

Scout also ran `python3 test_decision.py`. The repository-authored suite completed with `all checks passed`, covering registry validity, off/auto/required fallbacks, unknown IDs, low-confidence routing, secret handling, the permission boundary, provider errors, configuration, and fixture hygiene. Live provider calls remained zero.

## Implication

Routing evaluation should test the **decision boundary**, not only average accuracy:

- publish results by ambiguity and near-neighbour class;
- allow multiple defensible owners where the task is genuinely ambiguous;
- measure irrelevant selections alongside recall;
- distinguish ordinal ranking scores from empirically checked confidence;
- validate every selected ID against the offered, versioned registry;
- retain visible fallback provenance; and
- keep routing relevance structurally unable to grant operational authority.

A confidence threshold is only as current as the engine, registry, prompt, and fixture distribution used to derive it. Bind calibration to those identities and re-derive it after any changes.

## Limitations

The strong Claude numbers are a replay of a committed, repository-authored reconstruction: one focused subagent per fixture, without the conversation and competing work of a real session. They are not a fresh model run or an independent benchmark. The Jev comparison was not rerun because that requires an external credential and paid provider call. The fixture authors also disclose that some cases paraphrase registry criteria, the tool set has only 20 cases, and no evaluation yet shows that better route labels improve end-to-end work. Repository Search popularity and metadata do not establish production adoption.

## Primary sources

- [Evaluation design and limits](https://github.com/nahid-sparktales/agent-dispatcher/blob/a7091615be060ce2eb328205307f93cc197251e2/evals/decision/README.md)
- [Recorded Claude reconstruction](https://github.com/nahid-sparktales/agent-dispatcher/blob/a7091615be060ce2eb328205307f93cc197251e2/evals/decision/routes-claude.json)
- [Decision policy, ID validation, confidence fallback, and authorization guard](https://github.com/nahid-sparktales/agent-dispatcher/blob/a7091615be060ce2eb328205307f93cc197251e2/decision/engine.py)
- [Disabled-by-default scopes and threshold provenance](https://github.com/nahid-sparktales/agent-dispatcher/blob/a7091615be060ce2eb328205307f93cc197251e2/decision/config.py)
- [Optional-engine results and caveats](https://github.com/nahid-sparktales/agent-dispatcher/blob/a7091615be060ce2eb328205307f93cc197251e2/docs/jev.md)
