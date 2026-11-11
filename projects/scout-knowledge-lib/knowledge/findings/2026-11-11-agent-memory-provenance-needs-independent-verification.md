<ai_context>
summary: "A deterministic agent-memory simulation shows that provenance metadata filters careless false claims but can become attacker-controlled decoration; the useful control is independent verification plus scoped quarantine, with explicit coverage, evasion, and collateral-damage limits."
triggers: ["agent memory provenance", "memory poisoning", "trust scores", "independent verification", "quarantine cascade", "sybil memory"]
last_updated: "2026-11-11"
source_basis: "Static inspection of DrNFRZM/provenance-aware-agent-memory at pinned commit e14bb1c618e51ed2f51c2bc60399d3690ff3e953: complete non-truncated 59-entry tree, README, research note, generated quick report, threat model, and selected retrieval, scoring, and quarantine implementation. Scout did not install or run the simulator, tests, benchmarks, optional LLM backend, or regenerate committed results."
</ai_context>

# Agent memory provenance needs independent verification

**Date:** 2026-11-11  
**Disposition:** new knowledge  
**Coverage:** static source and committed-result inspection at one pinned revision

**Repo:** https://github.com/DrNFRZM/provenance-aware-agent-memory  
**Pinned revision:** https://github.com/DrNFRZM/provenance-aware-agent-memory/commit/e14bb1c618e51ed2f51c2bc60399d3690ff3e953

## Observation

This repository is a deterministic research testbed for false claims entering and propagating through multi-agent memory. Its committed quick profile covers 2,200 runs across eight evaluation seeds in an invented 45-fact world. Five policies range from similarity-only retrieval through provenance scoring, independent verification, and verification-triggered quarantine. All reported answers come from a mock reader, not a real LLM.

The useful result is a separation between metadata and evidence:

- Against a careless fabricator whose citation cannot be resolved, provenance scoring reduced false retrieval from 0.711 to 0.122.
- When the attacker supplied valid-looking metadata, provenance-only false retrieval returned to 0.711 and its attack-success estimate was higher than naive retrieval's. Self-reported confidence did not help.
- At 50% verifier coverage, verification plus quarantine reduced forged-metadata false retrieval to 0.129 and attack success to 0.071, versus 0.432 and 0.153 for verification without quarantine.
- The quarantine ablation attributes most of that improvement to an origin-suspicion cascade: removing the cascade raised forged-metadata false retrieval from 0.129 to 0.432 and attack success from 0.071 to 0.145.
- The benefit vanished when the simulated attacker avoided claims the verifier could check. Against `sybil_evasive`, verification and quarantine had attack-success estimates of 0.537 and 0.552, respectively, and accepted all injected false entries.

The cascade also creates collateral risk. An attacker that impersonates an honest origin can cause other entries from that origin to be distrusted. In the forged-metadata scenario, quarantine rejected 3.0% of true entries versus 0.3% in the no-attack control. Verifier error raises the cost sharply: at 10% simulated verifier noise, quarantine clean accuracy fell from 0.939 to 0.840 while false-positive rejection rose to 0.181.

## Interpretation

A memory system should not treat provenance fields as proof merely because they are structured, signed by the same ingestion path, or fed into a numeric trust score. If the claimant can choose the origin, confidence, citation, hop count, or supporting identities, those fields are assertions from the attack surface.

The stronger pattern is an evidence lifecycle:

1. retain source and relay lineage for audit and retrieval;
2. distinguish claimant-supplied metadata from independently resolved evidence;
3. record verifier coverage and unknown results rather than treating unchecked as clean;
4. quarantine the refuted claim before extending distrust to an origin;
5. make origin-level cascades scoped, reversible, and reviewable because impersonation can damage unrelated true memories;
6. measure both false acceptance and useful-memory loss under verifier noise and adaptive evasion.

This also suggests that memory-poisoning evaluations need an adversary ladder. A policy that defeats malformed citations has not established resistance to forged metadata, fabricated identities, verifier-aware selection, or compromised verification sources. The verifier's reachable evidence surface is part of the security boundary and should be reported as a denominator.

## Limitations

The repository explicitly describes itself as a research testbed rather than a deployable agent-memory library or a new method. The world is small and static; claims are structured; trust weights are hand-set; the verifier is an oracle on the facts it covers; attackers adapt only through predefined tiers; and only eight evaluation seeds are reported. The mock reader cannot model how fluent false text affects real LLMs. Scout inspected producer-authored source and committed artifacts but did not execute the 70 tests, regenerate CSVs or figures, audit every raw run, use the optional live-model adapter, or independently validate the reported measurements. The finding supports an evaluation and control pattern, not a claim that the policy secures deployed agents.

## Inspected source

- [README and results summary](https://github.com/DrNFRZM/provenance-aware-agent-memory/blob/e14bb1c618e51ed2f51c2bc60399d3690ff3e953/README.md)
- [Research note](https://github.com/DrNFRZM/provenance-aware-agent-memory/blob/e14bb1c618e51ed2f51c2bc60399d3690ff3e953/docs/research_note.md)
- [Generated quick benchmark report](https://github.com/DrNFRZM/provenance-aware-agent-memory/blob/e14bb1c618e51ed2f51c2bc60399d3690ff3e953/results/quick/report.md)
- [Threat model](https://github.com/DrNFRZM/provenance-aware-agent-memory/blob/e14bb1c618e51ed2f51c2bc60399d3690ff3e953/docs/threat_model.md)
- [Retrieval policies](https://github.com/DrNFRZM/provenance-aware-agent-memory/blob/e14bb1c618e51ed2f51c2bc60399d3690ff3e953/src/provmem/retrieval.py)
- [Trust scoring](https://github.com/DrNFRZM/provenance-aware-agent-memory/blob/e14bb1c618e51ed2f51c2bc60399d3690ff3e953/src/provmem/scoring.py)
- [Quarantine and origin cascade](https://github.com/DrNFRZM/provenance-aware-agent-memory/blob/e14bb1c618e51ed2f51c2bc60399d3690ff3e953/src/provmem/quarantine.py)
