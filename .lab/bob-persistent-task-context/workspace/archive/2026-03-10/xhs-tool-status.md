# XHS Tool Verification

## Test Status
**Date:** 2026-03-06
**Tool:** `agents/amy/tools/xhs-browse.mjs`
**Verdict:** ✅ PASS

## Methodology
1. **Feed Test**: Ran `node agents/amy/tools/xhs-browse.mjs feed`
2. **Read Test**: Ran `node agents/amy/tools/xhs-browse.mjs read <url>` using a URL from the feed result.

## Results

### 1. Feed Command
**Status**: Success
**Output**: 18 items retrieved.
**Data Quality**:
- Titles: Correctly extracted (e.g., "🔥 X上最火的 OpenClaw Skill 用法总结", "Scaling Law未遇瓶颈")
- Links: Valid, includes `xsec_token` (critical for detail view).
- Authors: Correctly extracted.
- Covers: Image URLs present.

### 2. Read Command
**Target**: "🔥 X上最火的 OpenClaw Skill 用法总结" (kaMiooo)
**Status**: Success
**Output**:
- **Title**: Correct
- **Description**: Full text extracted, including line breaks and hashtags.
- **Note Type**: "normal" (correct)
- **Images**: Extracted (deduplicated).
- **Metadata**: Date "34分钟前", Location "云南".
- **Raw Text fallback**: Working.

## Observations
- **CDP Connection**: Working perfectly on port 9222.
- **Navigation**: Tool successfully navigates to XHS and extracts data.
- **Token Handling**: The tool correctly prioritizes links with `xsec_token`, which is essential for XHS anti-scraping evasion. Without this token, direct navigation often fails or triggers captchas.
- **Performance**: Feed took ~2s, Read took ~6s (includes 6s wait time for hydration).

## Recommendation
The tool is production-ready. It successfully bypasses basic protections by leveraging the existing Chrome session. It should be moved to `agents/amy/tools/xhs-browse.mjs` (it is already there) and registered in Amy's `tools.json` (if not already).

## Next Steps
- Add to Amy's tool definition.
- Instruct Amy on how to use it (Feed -> Pick Interesting -> Read).
