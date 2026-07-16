/**
 * parser.js — Value parser for configuration strings
 * 
 * Parses string values from config files into typed JavaScript values.
 */

function parseValue(val) {
  if (val === null || val === undefined) return null;
  
  const str = String(val).trim();
  if (str === '') return '';
  
  // Boolean detection
  if (str.toLowerCase() === 'true') return true;
  if (str.toLowerCase() === 'false') return false;
  
  // Number detection — try parseFloat for all numeric-looking strings
  if (/^-?\d/.test(str) || str.startsWith('.')) {
    const num = parseFloat(str);
    if (!isNaN(num)) return num;
  }
  
  // Return as string
  return str;
}

function parseList(val) {
  if (val === null || val === undefined) return [];
  
  const str = String(val).trim();
  if (str === '') return [];
  
  // Split on commas, parse each value
  return str.split(',').map(item => parseValue(item.trim()));
}

function parseConfig(text) {
  const result = {};
  const lines = text.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    
    const key = trimmed.slice(0, eqIdx).trim();
    const rawVal = trimmed.slice(eqIdx + 1).trim();
    
    // If value contains commas, parse as list
    if (rawVal.includes(',')) {
      result[key] = parseList(rawVal);
    } else {
      result[key] = parseValue(rawVal);
    }
  }
  
  return result;
}

module.exports = { parseValue, parseList, parseConfig };
