# Prompt Trim Report — SOUL.md Analysis

**Date**: 2026-04-29
**Goal**: Identify SOUL.md files that exceed 800 tokens (~3200 chars) and recommend trimming

## Baseline Measurements

| Agent | Size (bytes) | Est. Tokens | Status |
|-------|-------------|-------------|--------|
| bob | 7,957 | ~1,989 | ⚠️ Over target |
| master | 6,834 | ~1,709 | ⚠️ Over target |
| amy | 6,446 | ~1,612 | ⚠️ Over target |
| qa | 5,865 | ~1,466 | ⚠️ Over target |
| evaluator | 5,823 | ~1,456 | ⚠️ Over target |
| tech-lead | 5,597 | ~1,399 | ⚠️ Over target |
| coach | 5,527 | ~1,382 | ⚠️ Over target |
| optimizer | 5,403 | ~1,351 | ⚠️ Over target |
| may | 4,146 | ~1,037 | ⚠️ Over target |
| amy-kimi | 2,861 | ~715 | ✅ At target |
| scout.bak | 2,540 | ~635 | ✅ At target |
| dev | 2,531 | ~633 | ✅ At target |
| judge | 2,261 | ~565 | ✅ At target |
| arc | 2,139 | ~535 | ✅ At target |
| scout | 2,015 | ~504 | ✅ At target |

**Total**: 67,945 bytes across 15 SOUL.md files
**Over target**: 9 files (60%)
**Target**: <3,200 bytes (~800 tokens) per file

## Top 3 Trim Candidates

### 1. bob/SOUL.md (7,957 bytes → target 3,200)
- **Potential savings**: ~4,757 bytes (60%)
- **Approach**: Remove verbose examples, condense rules to one-liners

### 2. master/SOUL.md (6,834 bytes → target 3,200)
- **Potential savings**: ~3,634 bytes (53%)
- **Approach**: Remove scenario descriptions, keep only decision rules

### 3. amy/SOUL.md (6,446 bytes → target 3,200)
- **Potential savings**: ~3,246 bytes (50%)
- **Approach**: Collapse multi-paragraph guidance into bullet points

## Total Potential Savings

If all 9 over-target files trimmed to 3,200 bytes:
- **Current total**: 54,598 bytes (over-target files)
- **Target total**: 28,800 bytes
- **Savings**: ~25,798 bytes (~6,450 tokens per system call)

## Recommendations

1. **Priority**: Trim bob, master, amy first (largest savings)
2. **Method**: Replace verbose explanations with actionable one-line rules
3. **Preserve**: Identity statements, critical constraints, tool usage patterns
4. **Remove**: Examples that repeat the rule, multi-sentence explanations of obvious behavior
