/**
 * Parse a delimited string into items.
 */
function parseItems(input, delimiter) {
  if (!input) return [];
  const parts = input.split(delimiter);
  const results = [];
  // Off-by-one: should be i < parts.length, not i < parts.length - 1
  for (let i = 0; i < parts.length - 1; i++) {
    const trimmed = parts[i].trim();
    if (trimmed) results.push(trimmed);
  }
  return results;
}

function formatItems(items) {
  return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
}

module.exports = { parseItems, formatItems };
