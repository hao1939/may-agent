---
title: "Minimal Feature Sets for Behavioral Detection of AI Agents in Browsers"
date: 2026-07-30
last_updated: 2026-07-30
source_platform: arxiv
query: 'cat:cs.AI AND abs:"AI agent"'
tags: [agent-detection, browser-automation, security, bot-detection, behavioral-fingerprinting]
---

# Minimal Feature Sets for Behavioral Detection of AI Agents in Browsers

Source: https://arxiv.org/abs/2607.26935

## Key Insight

Binary bot detectors (human vs bot) structurally cannot represent AI agents browsing via automation frameworks. A three-class framework (human / bot / AI agent) achieves perfect agent detection (F1 = 1.000 across 30 runs) by exploiting a fundamental browser-automation artifact: Playwright does not emit raw pointer-move and wheel-delta event streams that physical input devices produce.

## Method

- Three-class detection framework distinguishing humans, bots, and AI agents
- Five-level evasion ladder: passive observation → GAN trajectories → replay of real human cursor data (2,299 evasion sessions)
- Exhaustive feature subset search (9,401 GBMs over subsets of size 1–5)

## Results

- Binary classifiers misclassify 34–39% of AI agents as human
- Two behavioral features (`mouse_event_rate`, `teleport_click_ratio`) yield 100% agent recall at every evasion level with 0.994 precision
- Five features achieve macro-F1 ≥ 0.99 across all three classes
- Signal survives trajectory manipulation because it's an absence signature (no raw pointer streams), not a behavioral pattern

## Implications for Agent Builders

- Current browser-automation frameworks (Playwright, Puppeteer) leave detectable absence signatures regardless of trajectory spoofing
- Agent developers who need web access should expect detection; stealth requires solving the input-device emulation problem at the OS/driver level
- Sites wanting to distinguish agents from bots can add an explicit agent class cheaply

## Context

Accepted at North East AI Agents Day 2026 workshop (Jane Street, NYC). Authors from multiple institutions.
