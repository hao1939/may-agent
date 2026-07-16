/**
 * Date formatting utilities.
 * Used by the dashboard to display dates consistently.
 * 
 * BUG-101: Dates show as "2024-1-5" instead of "2024-01-05"
 */

function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
  
  const year = date.getFullYear();
  const month = date.getMonth() + 1;  // BUG: no zero-padding
  const day = date.getDate();          // BUG: no zero-padding
  
  return `${year}-${month}-${day}`;
}

function formatDateTime(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
  
  const datePart = formatDate(date);
  const hours = date.getHours();       // BUG: no zero-padding
  const minutes = date.getMinutes();   // BUG: no zero-padding
  const seconds = date.getSeconds();   // BUG: no zero-padding
  
  return `${datePart} ${hours}:${minutes}:${seconds}`;
}

function parseISODate(str) {
  const match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    throw new Error(`Invalid date format: ${str}`);
  }
  return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
}

module.exports = { formatDate, formatDateTime, parseISODate };
