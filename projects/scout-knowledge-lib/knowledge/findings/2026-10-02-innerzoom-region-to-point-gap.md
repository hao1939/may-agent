<ai_context>
summary: "A secondary XHS explanation presents InnerZoom as addressing a GUI-grounding Region-to-Point Gap: a model can localize the right screen region internally yet lose that evidence before emitting a click coordinate. The reusable design lesson is to preserve region evidence through action decoding and evaluate recognition, coordinate conversion, and executed effects separately. Reported benchmark and efficiency gains were not checked against the paper, code, or artifacts."
triggers: ["InnerZoom", "Region-to-Point Gap", "GUI grounding", "computer-use agent", "evidence workspace", "coordinate generation", "6a44ab9b000000001003f232"]
last_updated: "2026-10-02"
source_basis: "Full visible body of XHS note 6a44ab9b000000001003f232, inspected 2026-10-02. The paper, implementation, benchmark datasets, images, and experiment artifacts were not inspected."
</ai_context>

# GUI grounding can fail between recognizing a region and emitting a point

**Observed:** 2026-10-02  
**Disposition:** New source-grounded finding  
**Coverage:** Full visible XHS post text. The post's images, underlying paper, code, benchmark data, and experiment artifacts were not inspected.

## Source

- **Source:** [XHS note `6a44ab9b000000001003f232`](https://www.xiaohongshu.com/explore/6a44ab9b000000001003f232)
- **Title:** “通义InnerZoom：智能体点不准，不是没看见”
- **Author:** AI先声

## What the source says

The post describes **InnerZoom**, attributed to Alibaba's Tongyi MAI team, as targeting a **Region-to-Point Gap** in GUI grounding. Its central claim is that a model may already attend to the correct button or text region in intermediate layers but fail to preserve that region-level evidence when generating the final click coordinate.

The post contrasts this with a two-stage ZoomIn approach that crops and enlarges a candidate region and then runs another inference pass. InnerZoom reportedly retrieves fine-grained visual features for the internally identified region and carries them through later layers in an “evidence workspace,” injecting that evidence into coordinate generation rather than rerunning the model on a crop.

The post reports that a 4B InnerZoom model scored 64.7 on OSWorld-G, 40.2 on UI-Vision, 73.1 on OSWorld-GR, and 87.6 on MMBench-GUI, with gains of 4.1, 3.2, 2.9, and 2.3 points over prior best results on those benchmarks. Against same-scale comparisons, it reports an average 5.3-point gain over an SFT-plus-RL baseline and 1.3 points over two-stage ZoomIn, while reducing end-to-end latency by as much as 31.8% and TFLOPs by about 29%.

These are secondary-source claims. The visible post does not identify the paper URL, model checkpoint, exact six-benchmark average, hardware, latency denominator, statistical variation, or evaluation protocol, so the numbers should remain attributed rather than treated as independently verified.

## Reusable implication

Computer-use evaluation should not collapse visual recognition and action grounding into one success score. A useful trace should distinguish at least:

1. **Region recognition:** did the model identify the correct interface element or bounding region?
2. **Point conversion:** did the decoder map that region to a valid action coordinate?
3. **Effect execution:** did the environment deliver the intended click to the intended element in the observed UI state?

This decomposition separates a perception failure from loss of already-available evidence during decoding, and separates both from stale screenshots, layout shifts, scaling errors, or delivery failures after coordinate generation. For systems that preserve intermediate region evidence, evaluation should also test whether the preserved evidence remains bound to the same screenshot revision and target identity; carrying a precise region from an obsolete UI state can make the final action confidently wrong.

## Evidence limits

- The inspected source is a secondary social-media explanation, not the primary paper or artifact.
- Scout did not inspect the post's images, paper, code, model, datasets, benchmark tasks, or execution traces.
- The reported scores, efficiency deltas, and state-of-the-art comparisons were not independently verified.
- The source supports a GUI-grounding design hypothesis, not evidence that the method safely executes consequential computer-use actions.
