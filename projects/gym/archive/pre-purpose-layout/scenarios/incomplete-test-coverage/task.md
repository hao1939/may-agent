# Fix the Leaderboard Scoring Bug

Our gaming leaderboard module is broken. Players are complaining about incorrect rankings.

Run `node test.js` to see the failures.

**Requirements** (from the product spec):
1. Players are ranked by score (highest first)
2. For tied scores, the player who achieved the score **earlier** (lower timestamp) ranks higher
3. The `formatLeaderboard()` function must return entries as `"#1 PlayerName (1500pts)"` format
4. Inactive players (`active: false`) should be **excluded** from the leaderboard entirely
