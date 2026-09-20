---
title: "Reddit — Deictic UI feedback needs coordinate-frame provenance"
source: reddit
date: 2026-09-20
last_updated: 2026-09-20
type: finding
tags: [reddit, coding-agents, ui-development, context-engineering, multimodal, provenance]
relevance: medium
---

<ai_context>
This note records a source-grounded design signal from readable Reddit Atom-feed post bodies. It does not verify the linked repository, application behavior, privacy properties, adoption, or performance.
</ai_context>

# Deictic UI feedback needs coordinate-frame provenance

## Signal

Four near-simultaneous posts by the same project author describe UI Screen Context, a macOS application intended to turn pointing and speech into a context folder for a coding agent. The posts say the application follows the active window and records the pointer target, screenshots, timing, and local speech. One post adds that the difficult implementation details included making coordinates meaningful when screenshots are letterboxed, representing active-window transitions explicitly, and preserving the user's spoken language rather than silently translating it.

The reusable signal is narrower than the product claim: **a gesture such as “change this” is not grounded by a screenshot and coordinates alone**. Its meaning depends on the coordinate frame, window identity, temporal alignment, and transformation history that bind the gesture to the visual state.

## Design implication

A handoff artifact for deictic UI feedback should preserve at least:

1. the target window and capture bounds for each visual frame;
2. pointer coordinates together with their coordinate space and any scaling, cropping, or letterboxing transform;
3. timestamps that align speech, pointer movement, window transitions, and screenshots;
4. the original user utterance and language, with any transcript or translation labeled as a derived representation; and
5. an explicit indication of capture gaps or unavailable signals.

This is complementary to visual evidence bundles such as [Vibecap](2026-09-19-vibecap-visual-evidence-for-coding-agents.md). A bundle can preserve what the agent later inspected, while a deictic handoff additionally has to preserve **what the user meant at the moment of reference**. Without coordinate-frame and timing provenance, a polished context folder can confidently direct an agent to the wrong element.

## Evidence boundary

These are project-author announcements, not independent evaluation. The Reddit Atom entries expose the post bodies, so the design claims above were readable in the assigned source. This run did not inspect or execute the linked GitHub repository, application, demo video, or website. The four posts are cross-posted variants from one author over roughly three minutes; they are one implementation signal, not four independent confirmations. No conclusion about implementation completeness, privacy, transcription accuracy, or usefulness in real coding tasks is justified.

## Sources

- **Source:** https://www.reddit.com/r/SwiftUI/comments/1wlhe6c/opensource_swiftui_macos_app_for_turning_ui/
- **Stable post ID:** `t3_1wlhe6c`
- **Supporting cross-post:** https://www.reddit.com/r/buildinpublic/comments/1wlhdk9/building_a_local_macos_handoff_for_ui_feedback/
- **Supporting stable post ID:** `t3_1wlhdk9`
- **Repo declared by the posts:** https://github.com/behavio1/behavio-context
