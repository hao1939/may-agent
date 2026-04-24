// Simple utility with a planted bug for QA to find
function capitalize(str) {
  if (!str) return '';
  return str[0].toUpperCase() + str.slice(1);
}

function truncate(str, maxLen) {
  // Bug: doesn't handle case where maxLen < 3 (ellipsis longer than allowed)
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

function parseCSV(line) {
  return line.split(',').map(s => s.trim());
}

module.exports = { capitalize, truncate, parseCSV };
