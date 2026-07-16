/**
 * Grading Policy Configuration
 *
 * Assignment weights and late penalty rules.
 */
module.exports = {
  // Weight categories for final grade calculation
  weights: {
    homework: 0.40,     // 40% — all hw assignments combined
    midterm:  0.25,     // 25%
    final:    0.35,     // 35%
  },

  // Late submission penalty: percentage points deducted per day late
  // Applied during normalization (normalizer subtracts penalty from raw %)
  late_penalty_per_day: 5,

  // Maximum late penalty (cap)
  max_late_penalty: 25,

  // Grade thresholds (percentage)
  grade_scale: {
    "A":  90,
    "B":  80,
    "C":  70,
    "D":  60,
    "F":  0,
  },

  // Drop lowest N homework scores before averaging
  drop_lowest_hw: 1,
};
