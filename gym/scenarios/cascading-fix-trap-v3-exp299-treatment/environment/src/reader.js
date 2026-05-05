/**
 * CSV Reader — loads grade records from file.
 */
const fs = require("fs");

function loadGrades(filepath) {
  const content = fs.readFileSync(filepath, "utf-8");
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",");

  return lines.slice(1).map(line => {
    const fields = line.split(",");
    const record = {};
    headers.forEach((h, i) => {
      record[h.trim()] = fields[i].trim();
    });
    // Parse numeric fields
    record.score = parseFloat(record.score);
    record.max_score = parseFloat(record.max_score);
    record.late_days = parseInt(record.late_days, 10);
    return record;
  });
}

module.exports = { loadGrades };
