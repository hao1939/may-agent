const fs = require('fs');

function parse(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  const headers = lines[0].split(',');
  const results = [];
  // Bug: .slice(2) skips first data row
  for (const line of lines.slice(2)) {
    if (!line.trim()) continue;
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim());
    results.push(obj);
  }
  return results;
}

module.exports = { parse };
