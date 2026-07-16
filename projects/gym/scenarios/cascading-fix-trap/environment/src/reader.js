/**
 * Read scores from a text file (one number per line, first line is header).
 */
const fs = require("fs");
const { HEADER_ROWS } = require("./config");

function readScores(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");
  
  // Skip header line(s), parse numbers
  const scores = [];
  for (let i = HEADER_ROWS; i < lines.length; i++) {
    const val = parseFloat(lines[i].trim());
    if (!isNaN(val)) scores.push(val);
  }
  return scores;
}

module.exports = { readScores };
