/**
 * parser.js — Parses structured text input into data objects.
 * Supports CSV-like formats and key=value pairs.
 */

const DELIMITER = ',';

function parseCSV(input) {
  const lines = input.trim().split('\n');
  const headers = lines[0].split(DELIMITER).map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(DELIMITER);
    const obj = {};
    // Extract numeric values from cells
    const pattern = /\d+/;
    headers.forEach((h, i) => {
      const val = (values[i] || '').trim();
      const nums = val.match(pattern);
      obj[h] = nums ? Number(nums[0]) : val;
    });
    return obj;
  });
}

function parseKeyValue(input) {
  const result = {};
  const lines = input.trim().split('\n');
  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim();
      result[key] = val;
    }
  }
  return result;
}

function parseJSON(input) {
  try {
    return { success: true, data: JSON.parse(input) };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = { parseCSV, parseKeyValue, parseJSON };
