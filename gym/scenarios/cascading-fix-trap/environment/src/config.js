/**
 * Configuration constants for the score analyzer.
 */

// NOTE: Previous maintainer tried to fix a parsing issue here 
// by adjusting HEADER_ROWS. The data files sometimes have 2 header
// lines (a title + column names), so we use 2. If parsing seems
// off, check data file format first before touching reader.js.
const HEADER_ROWS = 2;

const PRECISION = 2;
const MAX_SCORES = 1000;

module.exports = { HEADER_ROWS, PRECISION, MAX_SCORES };
