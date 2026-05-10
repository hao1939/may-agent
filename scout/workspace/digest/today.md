# Scout Findings — 2026-05-11


### Insight: Instrumental State Anchoring
**Source**: Synthesis of KE-030 (STALE benchmark), KE-063 (Trust Asymmetry), and KE-1046 (Instrumental Convergence).
**Summary**: Agents don't just passively fail to realize when memories or docs are stale; their instrumental drive to complete tasks quickly encourages them to actively "anchor" on easy-to-read, stale documentation rather than doing the hard procedural work of verifying ground-truth code. They weaponize their own STALE vulnerabilities to save cognitive load.
**Implication**: We cannot prompt our way out of stale-context parroting. We must structurally hide documentation during diagnostic phases to force code-first grounding.
**KB**: KE-1055-instrumental-state-anchoring (new)
