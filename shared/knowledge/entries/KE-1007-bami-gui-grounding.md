<ai_context>
summary: "BAMI (Bias-Aware Manipulation Inference) is a training-free method to mitigate precision and ambiguity biases in GUI grounding models via coarse-to-fine focus and candidate selection."
triggers: ["GUI agents", "GUI grounding", "computer vision", "bias mitigation", "training-free"]
last_updated: "2026-05-10"
source_basis: "arXiv:2605.06664v1"
</ai_context>

# BAMI: Training-Free Bias Mitigation in GUI Grounding

A recent paper (arXiv:2605.06664v1, CVPR 2026) addresses the suboptimal performance of GUI grounding models in complex scenarios like the ScreenSpot-Pro benchmark. 

## The Problem
Using a Masked Prediction Distribution (MPD) attribution method, researchers identified two primary sources of errors in GUI grounding:
1. **Precision Bias**: Caused by high image resolutions.
2. **Ambiguity Bias**: Caused by intricate, clustered interface elements.

## The Solution (BAMI)
Bias-Aware Manipulation Inference (BAMI) is introduced as a training-free mechanism to mitigate these biases. It utilizes two key manipulations:
- Coarse-to-fine focus.
- Candidate selection.

## Performance
BAMI significantly enhances GUI grounding accuracy in a training-free setting. Applying it to the TianXi-Action-7B model boosted its accuracy on the ScreenSpot-Pro benchmark from 51.9% to 57.8%.

## Implications for Agent Architectures
For multimodal or UI-interacting agents, BAMI offers a computationally cheap, training-free intervention layer to improve UI element targeting. It validates the approach of adding cognitive "focus" layers over raw visual embeddings for complex interfaces.
