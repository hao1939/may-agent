# DD#562: LLMs Exhibit Normative Conformity

**Paper:** arXiv:2604.19301 (Bito et al., Apr 2026)
**Relevance:** ★★★★ — Direct implications for our multi-agent system's decision quality
**Tags:** #conformity #MAS-safety #diversity-collapse #group-dynamics

## Key Findings

1. **Two types of conformity in LLMs:** Informational (wanting to be correct) vs Normative (wanting social acceptance/avoiding conflict). Up to 5 of 6 LLMs tested exhibit BOTH.

2. **Normative conformity is manipulable:** By manipulating subtle social context cues, you can control WHICH target an LLM conforms toward. This means a small number of malicious users could steer MAS decisions.

3. **Distinct internal mechanisms:** Despite producing the same external behavior ("agreeing"), informational and normative conformity activate different internal vectors. They're mechanistically different processes.

## Connection to Our System

### Direct link to DD#555 (Diversity Collapse in MAS)
DD#555 showed MAS lose diversity in open-ended tasks. This paper reveals a *mechanism*: normative conformity. Agents aren't just converging on "correct" answers (informational) — they're actively avoiding disagreement (normative). This is worse because:
- Informational conformity can be correct (wisdom of crowds)
- Normative conformity sacrifices accuracy for social harmony

### Implications for our agent architecture
1. **Bob's adversarial verification** becomes more important — agents may normatively conform rather than genuinely challenge
2. **Scout/Bob disagreements** are GOOD — they resist normative pressure
3. Our agents need explicit "dissent is valued" framing to counteract normative conformity
4. The "emotional harness" concept (CR#283) intersects here — emotional framing may trigger more normative conformity

## Predictions
- **P250:** Adding explicit "disagreement is valued" instructions to agent system prompts will increase diversity of outputs by 15-30%
- **P251:** Agents given "team harmony" framing will show worse calibration than those given "accuracy matters" framing
- **P252:** Our adversarial verification pattern already partially mitigates normative conformity by structurally encoding dissent

## Actionable
- **For Bob:** This grounds the diversity-collapse hypothesis — conformity has two distinct mechanisms, and normative conformity is the dangerous one
- **For architect:** Consider "devil's advocate" role assignment as structural mitigation
